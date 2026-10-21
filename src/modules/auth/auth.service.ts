import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/modules/audit/audit.service";
import { settingsService } from "@/modules/settings/settings.service";
import { defaultSmsProvider } from "@/lib/sms";
import { assertPermission, Permission } from "./permissions";

export class InvalidCredentialsError extends Error {
  constructor(message: string = "Invalid phone number or password") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export class AccountLockedError extends Error {
  constructor(public readonly lockoutMinutes: number = 15) {
    super(`Account temporarily locked due to repeated failed login attempts. Please try again after ${lockoutMinutes} minutes.`);
    this.name = "AccountLockedError";
  }
}

interface FailedAttemptTracker {
  count: number;
  lockedUntil: number | null;
}

interface OtpTracker {
  hash: string;
  expiresAt: number;
  attempts: number;
}

// In-memory lockout tracker by phone number
const loginAttempts = new Map<string, FailedAttemptTracker>();

// In-memory OTP tracker by phone number
const otpStore = new Map<string, OtpTracker>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  /**
   * Authenticate a user with phone or email and password.
   * Handles attempt rate-limiting / lockout and audit logging.
   */
  async authenticateWithCredentials(phoneOrEmail: string, password: string, ip?: string) {
    const cleanInput = phoneOrEmail.trim();
    const now = Date.now();

    // 1. Check account lockout
    const tracker = loginAttempts.get(cleanInput.toLowerCase());
    if (tracker?.lockedUntil && tracker.lockedUntil > now) {
      const minutesRemaining = Math.ceil((tracker.lockedUntil - now) / 60000);
      throw new AccountLockedError(minutesRemaining);
    }

    // 2. Lookup user by phone OR email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanInput },
          ...(cleanInput.includes("@")
            ? [{ email: { equals: cleanInput, mode: "insensitive" as const } }]
            : []),
        ],
      },
    });

    if (!user || !user.active) {
      await this.recordFailedAttempt(cleanInput.toLowerCase(), null, ip);
      throw new InvalidCredentialsError();
    }

    // Also check lockout by canonical phone
    const phoneTracker = loginAttempts.get(user.phone);
    if (phoneTracker?.lockedUntil && phoneTracker.lockedUntil > now) {
      const minutesRemaining = Math.ceil((phoneTracker.lockedUntil - now) / 60000);
      throw new AccountLockedError(minutesRemaining);
    }

    // 3. Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(cleanInput.toLowerCase(), user.id, ip);
      if (cleanInput.toLowerCase() !== user.phone) {
        await this.recordFailedAttempt(user.phone, user.id, ip);
      }
      throw new InvalidCredentialsError();
    }

    // 4. Successful login: clear lockout tracker
    loginAttempts.delete(cleanInput.toLowerCase());
    loginAttempts.delete(user.phone);

    // 5. Write audit log
    await auditService.log({
      actorId: user.id,
      action: "USER_LOGIN_SUCCESS",
      entity: "User",
      entityId: user.id,
      after: { name: user.name, role: user.role },
      ip,
    });

    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  /**
   * Change user password. Clears the mustChangePassword flag.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new InvalidCredentialsError("Current password does not match");
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    await auditService.log({
      actorId: userId,
      action: "PASSWORD_CHANGED",
      entity: "User",
      entityId: userId,
      ip,
    });
  }

  /**
   * Create a new staff account (Admin only). Sets mustChangePassword to true.
   */
  async createStaffUser(
    actorRole: UserRole,
    actorId: string,
    data: { name: string; phone: string; email?: string; role: UserRole; tempPassword?: string },
    ip?: string
  ) {
    assertPermission(actorRole, Permission.MANAGE_USERS);

    const initialPassword = data.tempPassword || "TempPass123!";
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        passwordHash,
        role: data.role,
        mustChangePassword: true,
      },
    });

    await auditService.log({
      actorId,
      action: "USER_CREATED",
      entity: "User",
      entityId: newUser.id,
      after: { name: newUser.name, phone: newUser.phone, role: newUser.role },
      ip,
    });

    return newUser;
  }

  /**
   * Verify owner (Super Admin) credentials for high-privilege operational overrides
   * (such as credit limit override or discount limit bypass).
   */
  async verifyOwnerCredentials(phoneOrEmail: string, password: string) {
    const clean = phoneOrEmail.trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: clean },
          { email: clean },
        ],
        role: UserRole.SUPER_ADMIN,
        active: true,
      },
    });

    if (!user) {
      return { success: false as const, error: "Authorized owner account not found" };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return { success: false as const, error: "Incorrect owner password" };
    }

    return {
      success: true as const,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Register a new buyer (CUSTOMER role).
   * Depending on settings.verification_mode:
   * - "off": phoneVerifiedAt is set immediately.
   * - "admin": phoneVerifiedAt is null (pending admin phone verification).
   * - "sms": phoneVerifiedAt is null, and OTP is generated & sent via SmsProvider.
   */
  async registerBuyer(
    data: {
      name: string;
      phone: string;
      password: string;
      email?: string | null;
      gstin?: string | null;
      address?: string | null;
    },
    ip?: string
  ) {
    const cleanPhone = data.phone.trim();
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      throw new Error("Invalid 10-digit Indian phone number");
    }
    if (!data.name || data.name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }
    if (!data.password || data.password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Check duplicate phone
    const existing = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });
    if (existing) {
      throw new Error("An account with this phone number already exists");
    }

    // Get current verification mode setting
    const verificationSetting = await settingsService.getVerificationSettings();
    const mode = verificationSetting.mode; // "admin" | "off" | "sms"

    const passwordHash = await bcrypt.hash(data.password, 10);
    const now = new Date();
    const phoneVerifiedAt = mode === "off" ? now : null;

    // Create party record if not existing, or link existing by phone
    let party = await prisma.party.findFirst({
      where: { phone: cleanPhone },
    });

    if (!party) {
      party = await prisma.party.create({
        data: {
          name: data.name.trim(),
          phone: cleanPhone,
          email: data.email?.trim() || null,
          gstin: data.gstin?.trim() || null,
          address: data.address?.trim() || null,
          type: "CUSTOMER",
          creditEnabled: false,
        },
      });
    }

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        phone: cleanPhone,
        email: data.email?.trim() || null,
        passwordHash,
        role: UserRole.CUSTOMER,
        mustChangePassword: false,
        active: true,
        phoneVerifiedAt,
        verificationMode: mode,
        partyId: party.id,
      },
    });

    await auditService.log({
      actorId: user.id,
      action: "BUYER_REGISTERED",
      entity: "User",
      entityId: user.id,
      after: {
        name: user.name,
        phone: user.phone,
        verificationMode: mode,
        isVerified: Boolean(phoneVerifiedAt),
      },
      ip,
    });

    // If SMS mode, send initial OTP
    if (mode === "sms") {
      await this.sendPhoneVerificationOtp(cleanPhone);
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        phoneVerifiedAt: user.phoneVerifiedAt,
        verificationMode: user.verificationMode,
      },
      verificationMode: mode,
      requiresVerification: !phoneVerifiedAt,
    };
  }

  /**
   * Admin verifies buyer phone (e.g. after calling customer to confirm order/account).
   */
  async verifyBuyerPhoneByAdmin(
    actorRole: UserRole,
    actorId: string,
    targetUserId: string,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.MANAGE_USERS);

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new Error("User not found");
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        phoneVerifiedAt: new Date(),
        verificationMode: "admin",
      },
    });

    await auditService.log({
      actorId,
      action: "BUYER_PHONE_VERIFIED_BY_ADMIN",
      entity: "User",
      entityId: targetUserId,
      after: { verifiedPhone: updated.phone, verifiedAt: updated.phoneVerifiedAt },
      ip,
    });

    return updated;
  }

  /**
   * Send 6-digit OTP via SmsProvider (for SMS verification mode).
   */
  async sendPhoneVerificationOtp(phone: string) {
    const cleanPhone = phone.trim();
    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 6);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(cleanPhone, {
      hash: otpHash,
      expiresAt,
      attempts: 0,
    });

    // Dispatch via SmsProvider
    await defaultSmsProvider.sendSms({
      toPhone: cleanPhone,
      message: `Your IDMS verification code is ${otp}. Valid for 5 minutes.`,
    });

    return { success: true };
  }

  /**
   * Verify buyer phone using OTP.
   */
  async verifyPhoneWithOtp(phone: string, otp: string, ip?: string) {
    const cleanPhone = phone.trim();
    const entry = otpStore.get(cleanPhone);

    if (!entry || entry.expiresAt < Date.now()) {
      otpStore.delete(cleanPhone);
      throw new Error("OTP has expired or was not requested. Please request a new code.");
    }

    if (entry.attempts >= 5) {
      otpStore.delete(cleanPhone);
      throw new Error("Maximum OTP verification attempts exceeded. Please request a new code.");
    }

    entry.attempts += 1;

    const isValid = await bcrypt.compare(otp.trim(), entry.hash);
    if (!isValid) {
      throw new Error("Invalid verification code. Please check and try again.");
    }

    otpStore.delete(cleanPhone);

    // Update user phone verified timestamp
    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phoneVerifiedAt: new Date(),
          verificationMode: "sms",
        },
      });

      await auditService.log({
        actorId: user.id,
        action: "BUYER_PHONE_VERIFIED_BY_SMS",
        entity: "User",
        entityId: user.id,
        after: { phone: user.phone },
        ip,
      });
    }

    return { success: true };
  }

  /**
   * Record a failed login attempt and apply temporary lockout if threshold breached.
   */
  private async recordFailedAttempt(phone: string, userId: string | null, ip?: string) {
    const tracker = loginAttempts.get(phone) ?? { count: 0, lockedUntil: null };
    tracker.count += 1;

    if (tracker.count >= MAX_FAILED_ATTEMPTS) {
      tracker.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }

    loginAttempts.set(phone, tracker);

    // Record in audit log
    await auditService.log({
      actorId: userId,
      action: "USER_LOGIN_FAILED",
      entity: "User",
      entityId: userId,
      after: { phone, failedAttempts: tracker.count, locked: Boolean(tracker.lockedUntil) },
      ip,
    });
  }
}

export const authService = new AuthService();
