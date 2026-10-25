import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER || "info.jmdcart@gmail.com";
  const pass = process.env.SMTP_PASS || "nmhclrsybqxnnjoq";
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

const FROM_EMAIL = process.env.SMTP_FROM || "JMD Cart <info.jmdcart@gmail.com>";

export async function sendRegistrationOtpEmail(email: string, name: string, otp: string) {
  const transporter = getTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your JMD Cart Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f6f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1b1b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f6f5; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e6e2e0;" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="background-color: #5c0c1e; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">JMD CART</h1>
              <p style="margin: 4px 0 0 0; color: #f5b8c6; font-size: 12px; font-weight: 500;">Saharsa FMCG Retail &amp; Wholesale Distribution</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="margin: 0 0 12px 0; color: #1c1b1b; font-size: 20px; font-weight: 700;">Verify Your Email Address</h2>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #494544;">
                Namaste <strong>${name}</strong>,<br>
                Thank you for creating an account with JMD Cart. Please use the 6-digit One-Time Password (OTP) below to verify your email address and activate your account:
              </p>
              
              <!-- OTP Box -->
              <div style="background-color: #fdf5f6; border: 2px dashed #5c0c1e; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #5c0c1e;">${otp}</span>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #7d7573; font-weight: 500;">Valid for 10 minutes. Never share this code with anyone.</p>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.5; color: #7d7573;">
                If you did not request this verification code, please ignore this email or contact our support team at <a href="mailto:info.jmdcart@gmail.com" style="color: #5c0c1e; text-decoration: underline;">info.jmdcart@gmail.com</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fcf9f8; padding: 18px 24px; text-align: center; border-top: 1px solid #f0ecea;">
              <p style="margin: 0; font-size: 11px; color: #9c9492;">
                © ${new Date().getFullYear()} JMD Cart Saharsa. Ward 1–20 Express FMCG Delivery.<br>
                D.B. Road, Purab Bazar, Saharsa, Bihar - 852201
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: `${otp} is your JMD Cart verification code`,
    text: `Namaste ${name},\n\nYour JMD Cart verification code is ${otp}. Valid for 10 minutes.\n\nJMD Cart Saharsa`,
    html,
  });
}

export async function sendPasswordResetOtpEmail(email: string, name: string, otp: string) {
  const transporter = getTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your JMD Cart Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f6f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1b1b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f6f5; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e6e2e0;" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="background-color: #5c0c1e; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">JMD CART</h1>
              <p style="margin: 4px 0 0 0; color: #f5b8c6; font-size: 12px; font-weight: 500;">Saharsa FMCG Retail &amp; Wholesale Distribution</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="margin: 0 0 12px 0; color: #1c1b1b; font-size: 20px; font-weight: 700;">Password Reset Request</h2>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #494544;">
                Namaste <strong>${name}</strong>,<br>
                We received a request to reset your password for your JMD Cart account. Use the 6-digit OTP code below to verify your identity and set a new password:
              </p>
              
              <!-- OTP Box -->
              <div style="background-color: #fdf5f6; border: 2px dashed #5c0c1e; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #5c0c1e;">${otp}</span>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #7d7573; font-weight: 500;">Valid for 10 minutes. Do not share this code.</p>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.5; color: #7d7573;">
                If you did not make this request, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fcf9f8; padding: 18px 24px; text-align: center; border-top: 1px solid #f0ecea;">
              <p style="margin: 0; font-size: 11px; color: #9c9492;">
                © ${new Date().getFullYear()} JMD Cart Saharsa. Ward 1–20 Express FMCG Delivery.<br>
                D.B. Road, Purab Bazar, Saharsa, Bihar - 852201
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: `${otp} is your JMD Cart password reset code`,
    text: `Namaste ${name},\n\nYour JMD Cart password reset code is ${otp}. Valid for 10 minutes.\n\nJMD Cart Saharsa`,
    html,
  });
}
