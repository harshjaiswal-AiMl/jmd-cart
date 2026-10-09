import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/modules/audit/audit.service";
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

// In-memory lockout tracker by phone number
const loginAttempts = new Map<string, FailedAttemptTracker>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  /**
   * Authenticate a user with phone and password.
   * Handles attempt rate-limiting / lockout and audit logging.
   */
  async authenticateWithCredentials(phone: string, password: string, ip?: string) {
    const cleanPhone = phone.trim();
    const now = Date.now();

    // 1. Check account lockout
    const tracker = loginAttempts.get(cleanPhone);
    if (tracker?.lockedUntil && tracker.lockedUntil > now) {
      const minutesRemaining = Math.ceil((tracker.lockedUntil - now) / 60000);
      throw new AccountLockedError(minutesRemaining);
    }

    // 2. Lookup user by phone
    const user = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (!user || !user.active) {
      await this.recordFailedAttempt(cleanPhone, null, ip);
      throw new InvalidCredentialsError();
    }

    // 3. Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(cleanPhone, user.id, ip);
      throw new InvalidCredentialsError();
    }

    // 4. Successful login: clear lockout tracker
    loginAttempts.delete(cleanPhone);

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
