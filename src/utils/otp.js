/**
 * OTP helper utilities
 */
const logger = require("./logger");
const { sendMail } = require("./mailer");

function generateOtp(length = 4) {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

// Stubbed sendOtp function. In production replace with real email/SMS provider.
async function sendOtp({ to, otp }) {
  const appName = process.env.APP_NAME || 'Aivatar';
  const subject = process.env.OTP_SUBJECT || `${appName} verification code`;
  const expiryMinutes = process.env.OTP_EXPIRE_MINUTES
    ? Number(process.env.OTP_EXPIRE_MINUTES)
    : 10;
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || 'support@' + (process.env.FRONTEND_URL ? new URL(process.env.FRONTEND_URL).hostname : 'example.com');
  const frontendVerifyUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '') + (process.env.VERIFY_PATH || '/verify');

  const text = `Hello,\n\nYour ${appName} verification code is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes. If you did not request this, please ignore this message or contact ${supportEmail}.\n\nThanks,\nThe ${appName} Team`;

  const html = `
  <div style="font-family: 'Arial', sans-serif; background:#111111; margin:0; padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#111111;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <div style="max-width:580px;width:100%;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">

            <!-- Header -->
            <div style="background:#1a1a1a;padding:28px 32px 20px 32px;border-bottom:1px solid #2a2a2a;text-align:center;">
              <img src="https://res.cloudinary.com/djvoptc2y/image/upload/f_png/v1772540418/fto3jlcer8v1bosqtzar.png" alt="${appName}" style="height:120px; width:auto; display:block; margin:0 auto; border:0; max-width:100%;">
              <p style="margin:6px 0 0 0;font-size:12px;color:#666;letter-spacing:2px;text-transform:uppercase;">Verification</p>
            </div>

            <!-- Body -->
            <div style="padding:36px 32px;">
              <p style="margin:0 0 12px 0;font-size:16px;color:#ffffff;font-weight:600;">Verify Your Identity</p>
              <p style="margin:0 0 28px 0;font-size:14px;color:#999999;line-height:1.6;">
                Use the one-time code below to complete your verification. This code expires in <strong style="color:#F5A623;">${expiryMinutes} minutes</strong>.
              </p>

              <!-- OTP digits -->
              <div style="text-align:center;margin:24px 0;">
                <div style="display:inline-block;background:#111111;border:1px solid #2e2e2e;padding:20px 28px;border-radius:14px;">
                  <div style="display:flex;gap:10px;align-items:center;justify-content:center;">
                    ${otp.split('').map(d => `<span style="display:inline-block;width:52px;height:56px;line-height:56px;background:#222222;border:2px solid #F5A623;border-radius:10px;font-weight:800;font-size:26px;color:#F5A623;text-align:center;font-family:'Courier New',monospace;letter-spacing:0;">${d}</span>`).join('<span style="color:#555;font-size:20px;margin:0 2px;">&#8203;</span>')}
                  </div>
                </div>
              </div>

              ${frontendVerifyUrl ? `
              <div style="text-align:center;margin:28px 0 20px 0;">
                <a href="${frontendVerifyUrl}" style="background:#F5A623;color:#111111;padding:13px 36px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700;font-size:14px;letter-spacing:0.5px;">Verify Account</a>
              </div>` : ''}

              <p style="margin:24px 0 0 0;font-size:12px;color:#555555;text-align:center;">If you did not request this code, you can safely ignore this email.</p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#555555;text-align:center;">Need help? <a href="mailto:${supportEmail}" style="color:#F5A623;text-decoration:none;">${supportEmail}</a></p>
            </div>

            <!-- Footer -->
            <div style="background:#111111;padding:16px 32px;text-align:center;border-top:1px solid #2a2a2a;">
              <p style="margin:0;font-size:11px;color:#444444;">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            </div>

          </div>
        </td>
      </tr>
    </table>
  </div>
  `;

  // If SMTP configured, send email via mailer; otherwise log and return otp (useful for dev)
  try {
    const result = await sendMail({ to, subject, text, html });

    // If sendMail returned a result with accepted recipients or included messageId, consider success
    const success = !!(result && (result.accepted || result.messageId));

    return {
      success,
      // Only expose OTP in non-production for testing convenience
      otp: process.env.NODE_ENV === 'production' ? undefined : otp,
      sendResult: result,
    };
  } catch (err) {
    logger.error(`Failed to send OTP email to ${to}: ${err.message}`);
    return {
      success: false,
      otp: process.env.NODE_ENV === 'production' ? undefined : otp,
      error: err.message,
    };
  }
}

module.exports = {
  generateOtp,
  sendOtp,
};
