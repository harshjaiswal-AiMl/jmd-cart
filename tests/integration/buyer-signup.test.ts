import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { authService } from "@/modules/auth/auth.service";
import { settingsService } from "@/modules/settings/settings.service";
import { ConsoleSmsProvider } from "@/lib/sms";
import { UserRole } from "@prisma/client";

describe("Task 3.1 Integration Tests: Buyer Signup, Phone Verification & Verification Modes", () => {
  const testPhoneAdminMode = "9800011111";
  const testPhoneOffMode = "9800022222";
  const testPhoneSmsMode = "9800033333";
  let adminUserId: string;

  beforeEach(async () => {
    ConsoleSmsProvider.clearSentMessages();

    const admin = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.SUPER_ADMIN },
    });
    adminUserId = admin.id;

    // Clean up test buyers
    await prisma.user.deleteMany({
      where: {
        phone: { in: [testPhoneAdminMode, testPhoneOffMode, testPhoneSmsMode] },
      },
    });
    await prisma.party.deleteMany({
      where: {
        phone: { in: [testPhoneAdminMode, testPhoneOffMode, testPhoneSmsMode] },
      },
    });
  });

  it("registers buyer in admin verification mode (default): phoneVerifiedAt is null, requires phone call", async () => {
    // 1. Ensure verification mode is 'admin'
    await settingsService.updateVerificationSettings(UserRole.SUPER_ADMIN, adminUserId, {
      mode: "admin",
    });

    // 2. Register buyer
    const result = await authService.registerBuyer({
      name: "Maa Durga Kirana Store",
      phone: testPhoneAdminMode,
      password: "password123",
      address: "Main Bazar, Saharsa",
    });

    expect(result.user.role).toBe(UserRole.CUSTOMER);
    expect(result.verificationMode).toBe("admin");
    expect(result.user.phoneVerifiedAt).toBeNull();
    expect(result.requiresVerification).toBe(true);

    // 3. Verify user in database
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { phone: testPhoneAdminMode },
      include: { party: true },
    });
    expect(dbUser.phoneVerifiedAt).toBeNull();
    expect(dbUser.partyId).toBeDefined();
    expect(dbUser.party?.name).toBe("Maa Durga Kirana Store");

    // 4. Admin performs phone verification
    const verified = await authService.verifyBuyerPhoneByAdmin(
      UserRole.SUPER_ADMIN,
      adminUserId,
      dbUser.id
    );
    expect(verified.phoneVerifiedAt).not.toBeNull();
  });

  it("registers buyer in 'off' verification mode: phoneVerifiedAt is set immediately", async () => {
    // 1. Set verification mode to 'off'
    await settingsService.updateVerificationSettings(UserRole.SUPER_ADMIN, adminUserId, {
      mode: "off",
    });

    // 2. Register buyer
    const result = await authService.registerBuyer({
      name: "Gupta Ji General Store",
      phone: testPhoneOffMode,
      password: "password123",
    });

    expect(result.verificationMode).toBe("off");
    expect(result.user.phoneVerifiedAt).not.toBeNull();
    expect(result.requiresVerification).toBe(false);

    // 3. Verify in database
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { phone: testPhoneOffMode },
    });
    expect(dbUser.phoneVerifiedAt).not.toBeNull();
  });

  it("registers buyer in 'sms' verification mode: sends OTP, blocks until verified", async () => {
    // 1. Set verification mode to 'sms'
    await settingsService.updateVerificationSettings(UserRole.SUPER_ADMIN, adminUserId, {
      mode: "sms",
    });

    // 2. Register buyer
    const result = await authService.registerBuyer({
      name: "Singh Provision Store",
      phone: testPhoneSmsMode,
      password: "password123",
    });

    expect(result.verificationMode).toBe("sms");
    expect(result.user.phoneVerifiedAt).toBeNull();
    expect(result.requiresVerification).toBe(true);

    // 3. Verify OTP sent via ConsoleSmsProvider
    const sentMessages = ConsoleSmsProvider.getSentMessages(testPhoneSmsMode);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].message).toMatch(/Your IDMS verification code is \d{6}/);

    const otpMatch = sentMessages[0].message.match(/\d{6}/);
    expect(otpMatch).not.toBeNull();
    const otp = otpMatch![0];

    // 4. Verify invalid OTP fails
    await expect(
      authService.verifyPhoneWithOtp(testPhoneSmsMode, "000000")
    ).rejects.toThrow("Invalid verification code");

    // 5. Verify valid OTP succeeds
    const verifyResult = await authService.verifyPhoneWithOtp(testPhoneSmsMode, otp);
    expect(verifyResult.success).toBe(true);

    // 6. Verify phoneVerifiedAt is now stamped in DB
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { phone: testPhoneSmsMode },
    });
    expect(dbUser.phoneVerifiedAt).not.toBeNull();

    // Reset verification mode to default 'admin'
    await settingsService.updateVerificationSettings(UserRole.SUPER_ADMIN, adminUserId, {
      mode: "admin",
    });
  });

  it("rejects duplicate phone registration with friendly error", async () => {
    await settingsService.updateVerificationSettings(UserRole.SUPER_ADMIN, adminUserId, {
      mode: "admin",
    });

    await authService.registerBuyer({
      name: "Original Store",
      phone: testPhoneAdminMode,
      password: "password123",
    });

    await expect(
      authService.registerBuyer({
        name: "Duplicate Phone Store",
        phone: testPhoneAdminMode,
        password: "differentpassword",
      })
    ).rejects.toThrow("An account with this phone number already exists");
  });

  it("authenticates buyer credentials and allows login", async () => {
    await authService.registerBuyer({
      name: "Buyer For Auth Test",
      phone: testPhoneOffMode,
      password: "validPassword123",
    });

    const sessionUser = await authService.authenticateWithCredentials(
      testPhoneOffMode,
      "validPassword123"
    );

    expect(sessionUser.id).toBeDefined();
    expect(sessionUser.role).toBe(UserRole.CUSTOMER);
    expect(sessionUser.phone).toBe(testPhoneOffMode);
  });
});
