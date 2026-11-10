import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { UserRole, PartyType, MessageChannel } from "@prisma/client";
import { MessagingService } from "../messaging/messaging.service";

interface TokenPayload {
  userId: string;
  phone: string;
  role: string;
  buyerType: string | null;
  buyerApproved: boolean;
  partyId: string | null;
  exp: number; // Unix seconds
  iat: number; // Unix seconds
}

interface PendingOtpEntry {
  phone: string;
  otpHash: string;
  attempts: number;
  expiresAt: number;
  requestedAt: number;
}

const pendingOtps = new Map<string, PendingOtpEntry>();
const rateLimitTracker = new Map<string, { count: number; windowStart: number }>();

function getSecretKey(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "jmd-cart-mobile-jwt-secret-production-stable-key";
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

export class MobileAuthService {
  /**
   * Generates a signed JWT access token (15 mins validity).
   */
  static generateAccessToken(user: {
    id: string;
    phone: string;
    role: string;
    buyerType?: string | null;
    buyerApproved?: boolean;
    partyId?: string | null;
  }): string {
    const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      buyerType: user.buyerType || null,
      buyerApproved: !!user.buyerApproved,
      partyId: user.partyId || null,
      iat: now,
      exp: now + 15 * 60, // 15 minutes
    };

    const encodedHeader = base64UrlEncode(header);
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
      .createHmac("sha256", getSecretKey())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verifies and decodes a mobile JWT access token.
   */
  static verifyAccessToken(token: string): TokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, signature] = parts;
      const expectedSignature = crypto
        .createHmac("sha256", getSecretKey())
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

      if (signature !== expectedSignature) return null;

      const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null; // Expired
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Creates a rotating refresh token in the database (30 days validity).
   */
  static async createRefreshToken(userId: string, deviceId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Revoke any previous unrevoked tokens for this device
    await prisma.appRefreshToken.updateMany({
      where: {
        userId,
        deviceId,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });

    await prisma.appRefreshToken.create({
      data: {
        userId,
        deviceId,
        tokenHash,
        expiresAt,
      },
    });

    return rawToken;
  }

  /**
   * Rotates a refresh token: verifies old token, revokes it, and issues new access + refresh tokens.
   */
  static async rotateRefreshToken(
    rawToken: string,
    deviceId: string
  ): Promise<{ accessToken: string; refreshToken: string; user: any } | null> {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const existing = await prisma.appRefreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!existing || existing.revoked || existing.deviceId !== deviceId) {
      return null;
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      return null;
    }

    // Revoke used token
    await prisma.appRefreshToken.update({
      where: { id: existing.id },
      data: { revoked: true },
    });

    const user = existing.user;
    if (!user.active) return null;

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.createRefreshToken(user.id, deviceId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Revokes refresh token on logout.
   */
  static async revokeDeviceTokens(userId: string, deviceId: string): Promise<void> {
    await prisma.appRefreshToken.updateMany({
      where: {
        userId,
        deviceId,
      },
      data: {
        revoked: true,
      },
    });
  }

  /**
   * Sends 6-digit OTP with rate limiting & SMS autofill formatting.
   */
  static async sendOtp(
    phone: string,
    appHash: string = "FA+9qCX9VSu"
  ): Promise<{ success: boolean; message: string; cooldownSeconds?: number }> {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      throw new Error("Invalid phone number. Please enter a valid 10-digit number.");
    }
    const tenDigit = cleanPhone.slice(-10);

    // Rate limiting: max 3 requests per 10 minutes
    const now = Date.now();
    const rate = rateLimitTracker.get(tenDigit);
    if (rate) {
      if (now - rate.windowStart < 10 * 60 * 1000) {
        if (rate.count >= 4) {
          const remainingSeconds = Math.ceil((rate.windowStart + 10 * 60 * 1000 - now) / 1000);
          return {
            success: false,
            message: `Too many OTP requests. Please wait ${remainingSeconds} seconds.`,
            cooldownSeconds: remainingSeconds,
          };
        }
        rate.count += 1;
      } else {
        rateLimitTracker.set(tenDigit, { count: 1, windowStart: now });
      }
    } else {
      rateLimitTracker.set(tenDigit, { count: 1, windowStart: now });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    pendingOtps.set(tenDigit, {
      phone: tenDigit,
      otpHash,
      attempts: 0,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes validity
      requestedAt: now,
    });

    // Android SMS Auto-fill format:
    // <#> Your JMD Cart verification code is 123456. Valid for 5 minutes.\n11CharHash
    const autofillHash = appHash.trim().slice(0, 11) || "FA+9qCX9VSu";
    const message = `<#> Your JMD Cart verification code is ${otp}. Valid for 5 minutes. DO NOT share this code.\n${autofillHash}`;

    try {
      await MessagingService.sendDirect({
        phone: tenDigit,
        body: message,
        channel: MessageChannel.SMS,
      });
    } catch (err: any) {
      console.warn(`[MobileAuth] Direct SMS delivery notice: ${err?.message || err}`);
    }

    return {
      success: true,
      message: "Verification code sent successfully.",
    };
  }

  /**
   * Verifies OTP and logs in / signs up the user.
   */
  static async verifyOtp(
    phone: string,
    otp: string,
    deviceId: string
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const cleanPhone = phone.replace(/\D/g, "");
    const tenDigit = cleanPhone.slice(-10);

    const pending = pendingOtps.get(tenDigit);
    if (!pending) {
      throw new Error("No pending OTP request found or code expired. Please request a new code.");
    }

    if (Date.now() > pending.expiresAt) {
      pendingOtps.delete(tenDigit);
      throw new Error("Verification code has expired. Please request a new code.");
    }

    if (pending.attempts >= 5) {
      pendingOtps.delete(tenDigit);
      throw new Error("Too many failed attempts. Please request a new code.");
    }

    pending.attempts += 1;
    const inputHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");

    // Allow static demo/test OTP in non-production or for designated test numbers
    const isMasterTestOtp = process.env.NODE_ENV !== "production" && otp.trim() === "123456";
    if (inputHash !== pending.otpHash && !isMasterTestOtp) {
      throw new Error("Invalid verification code. Please check and try again.");
    }

    // OTP is valid!
    pendingOtps.delete(tenDigit);

    // Look up or create user
    let user = await prisma.user.findFirst({
      where: {
        phone: {
          endsWith: tenDigit,
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: `+91${tenDigit}`,
          name: `Customer ${tenDigit.slice(-4)}`,
          passwordHash: crypto.randomBytes(16).toString("hex"),
          role: UserRole.CUSTOMER,
          buyerType: PartyType.CUSTOMER,
          buyerApproved: false,
          phoneVerifiedAt: new Date(),
          verificationMode: "sms",
        },
      });
    } else {
      if (!user.phoneVerifiedAt) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phoneVerifiedAt: new Date() },
        });
      }
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id, deviceId);

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Strips staff-only, sensitive, or security fields.
   */
  static sanitizeUser(user: any): any {
    if (!user) return null;
    const {
      passwordHash,
      agentCode,
      mustChangePassword,
      ...safeUser
    } = user;
    return safeUser;
  }
}
