-- AlterEnum: Add FAST2SMS and TWILIO to MessageProviderType
ALTER TYPE "MessageProviderType" ADD VALUE IF NOT EXISTS 'FAST2SMS';
ALTER TYPE "MessageProviderType" ADD VALUE IF NOT EXISTS 'TWILIO';
