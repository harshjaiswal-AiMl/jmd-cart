import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/modules/audit/audit.service";
import { settingsService } from "@/modules/settings/settings.service";
import { defaultSmsProvider } from "@/lib/sms";
import { assertPermission, Permission } from "./permissions";
import { sendRegistrationOtpEmail, sendPasswordResetOtpEmail } from "@/lib/email";

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

interface PendingRegistration {
  name: string;
  phone: string;
  email: string;
  password: string;
  gstin?: string | null;
  address?: string | null;
  otpHash: string;
  expiresAt: number;
  attempts: number;
}

interface PasswordResetEntry {
  userId: string;
  email: string;
  name: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
}

const pendingRegistrations = new Map<string, PendingRegistration>();
const passwordResetStore = new Map<string, PasswordResetEntry>();

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
      throw new Error("An account with this phone number already exists. Please log in or use another number.");
    }

    // Check duplicate email
    const cleanEmail = data.email?.trim().toLowerCase() || null;
    if (cleanEmail) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: { equals: cleanEmail, mode: "insensitive" } },
      });
      if (existingEmail) {
        throw new Error("An account with this email address already exists. Please log in or use another email.");
      }
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

    // Auto-create initial saved address for 1-click checkout
    if (data.address?.trim()) {
      await prisma.userAddress.create({
        data: {
          userId: user.id,
          name: data.name.trim(),
          phone: cleanPhone,
          addressLine: data.address.trim(),
          area: "Purab Bazar",
          city: "Saharsa",
          state: "Bihar",
          pincode: "852201",
          type: "SHOP",
          isDefault: true,
        },
      });
    }

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

  /**
   * Step 1: Initiate buyer registration with Email OTP verification.
   * Checks duplicate phone and email, generates 6-digit OTP, stores pending registration,
   * and sends an email via Gmail SMTP.
   */
  async initiateRegistrationWithEmailOtp(
    data: {
      name: string;
      phone: string;
      email: string;
      password: string;
      gstin?: string | null;
      address?: string | null;
    }
  ) {
    const cleanPhone = data.phone.trim();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();

    if (!cleanName || cleanName.length < 2) {
      throw new Error("Name must be at least 2 characters long");
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      throw new Error("Please enter a valid 10-digit Indian mobile number");
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("Please enter a valid email address");
    }
    if (!data.password || data.password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Check duplicate phone
    const existingPhone = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });
    if (existingPhone) {
      throw new Error("An account with this phone number already exists. Please log in or use another number.");
    }

    // Check duplicate email
    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });
    if (existingEmail) {
      throw new Error("An account with this email address already exists. Please log in or use another email.");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 6);

    pendingRegistrations.set(cleanEmail, {
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      password: data.password,
      gstin: data.gstin?.trim() || null,
      address: data.address?.trim() || null,
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
    });

    try {
      await sendRegistrationOtpEmail(cleanEmail, cleanName, otp);
    } catch (err) {
      console.error("[Email OTP] Failed to send registration email:", err);
      throw new Error("Failed to send verification email. Please verify your email address and try again.");
    }

    return {
      success: true,
      email: cleanEmail,
      phone: cleanPhone,
    };
  }

  /**
   * Step 2: Verify email OTP and finalize account creation.
   */
  async verifyRegistrationEmailOtp(email: string, otp: string, ip?: string) {
    const cleanEmail = email.trim().toLowerCase();
    const entry = pendingRegistrations.get(cleanEmail);

    if (!entry) {
      throw new Error("No pending registration found for this email, or the code has expired. Please sign up again.");
    }

    if (Date.now() > entry.expiresAt) {
      pendingRegistrations.delete(cleanEmail);
      throw new Error("Verification code has expired. Please sign up again to receive a fresh code.");
    }

    if (entry.attempts >= 5) {
      pendingRegistrations.delete(cleanEmail);
      throw new Error("Too many failed attempts. Please sign up again to request a new code.");
    }

    entry.attempts += 1;

    const isValid = await bcrypt.compare(otp.trim(), entry.otpHash);
    if (!isValid) {
      throw new Error("Invalid verification code. Please check your email and try again.");
    }

    pendingRegistrations.delete(cleanEmail);

    // Hash user password
    const passwordHash = await bcrypt.hash(entry.password, 10);
    const now = new Date();

    // Link or create party
    let party = await prisma.party.findFirst({
      where: { phone: entry.phone },
    });

    if (!party) {
      party = await prisma.party.create({
        data: {
          name: entry.name,
          phone: entry.phone,
          email: entry.email,
          gstin: entry.gstin,
          address: entry.address,
          type: "CUSTOMER",
          creditEnabled: false,
        },
      });
    }

    // Create verified user
    const user = await prisma.user.create({
      data: {
        name: entry.name,
        phone: entry.phone,
        email: entry.email,
        passwordHash,
        role: UserRole.CUSTOMER,
        mustChangePassword: false,
        active: true,
        phoneVerifiedAt: now,
        emailVerifiedAt: now,
        verificationMode: "email_otp",
        partyId: party.id,
      },
    });

    if (entry.address) {
      await prisma.userAddress.create({
        data: {
          userId: user.id,
          name: entry.name,
          phone: entry.phone,
          addressLine: entry.address,
          area: "Purab Bazar",
          city: "Saharsa",
          state: "Bihar",
          pincode: "852201",
          type: "HOME",
          isDefault: true,
        },
      });
    }

    await auditService.log({
      actorId: user.id,
      action: "BUYER_REGISTERED_WITH_EMAIL_OTP",
      entity: "User",
      entityId: user.id,
      after: {
        name: user.name,
        phone: user.phone,
        email: user.email,
      },
      ip,
    });

    return { success: true, user, phone: entry.phone, password: entry.password };
  }

  /**
   * Request password reset OTP sent to user's registered email.
   */
  async requestPasswordReset(emailOrPhone: string) {
    const cleanInput = emailOrPhone.trim();

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

    if (!user) {
      throw new Error("No account found matching this phone number or email.");
    }

    if (!user.email) {
      throw new Error("This account does not have a registered email address. Please contact customer care.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 6);

    passwordResetStore.set(user.id, {
      userId: user.id,
      email: user.email,
      name: user.name,
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
    });

    try {
      await sendPasswordResetOtpEmail(user.email, user.name, otp);
    } catch (err) {
      console.error("[Password Reset OTP] Failed to send email:", err);
      throw new Error("Failed to send password reset email. Please try again later.");
    }

    const [u, domain] = user.email.split("@");
    const masked = `${u.slice(0, 2)}***@${domain}`;

    return {
      success: true,
      userId: user.id,
      maskedEmail: masked,
    };
  }

  /**
   * Verify password reset OTP and set new password.
   */
  async verifyPasswordResetAndSetNewPassword(userId: string, otp: string, newPassword: string, ip?: string) {
    const entry = passwordResetStore.get(userId);

    if (!entry) {
      throw new Error("Password reset request has expired. Please request a new code.");
    }

    if (Date.now() > entry.expiresAt) {
      passwordResetStore.delete(userId);
      throw new Error("Password reset code has expired. Please request a new code.");
    }

    if (entry.attempts >= 5) {
      passwordResetStore.delete(userId);
      throw new Error("Too many failed attempts. Please request a new reset code.");
    }

    entry.attempts += 1;

    const isValid = await bcrypt.compare(otp.trim(), entry.otpHash);
    if (!isValid) {
      throw new Error("Invalid 6-digit verification code. Please check your email.");
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long.");
    }

    passwordResetStore.delete(userId);

    const newHash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    await auditService.log({
      actorId: userId,
      action: "USER_PASSWORD_RESET_VIA_OTP",
      entity: "User",
      entityId: userId,
      after: { email: entry.email },
      ip,
    });

    return { success: true, phone: updated.phone };
  }
}

export const authService = new AuthService();
