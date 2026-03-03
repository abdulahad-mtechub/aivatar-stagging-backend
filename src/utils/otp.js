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
  <div style="font-family: Arial, sans-serif; color: #222;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:20px 0;">
          <div style="max-width:600px;width:100%;border:1px solid #e9e9e9;border-radius:8px;overflow:hidden;">
            <div style="background:#0b74de;padding:18px 24px;color:#fff;text-align:left;">
              <h1 style="margin:0;font-size:20px;font-weight:600;">${appName}</h1>
            </div>
            <div style="padding:32px 24px;background:#fff;">
              <p style="margin:0 0 16px 0;font-size:15px;">Hello,</p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#555;">Use the verification code below to continue. This code will expire in <strong>${expiryMinutes} minutes</strong>.</p>

              <div style="text-align:center;margin:18px 0;">
                <div style="display:inline-flex;gap:12px;align-items:center;justify-content:center;background:#ffffff;border:1px solid #e6eefc;padding:14px 20px;border-radius:12px;box-shadow:0 1px 4px rgba(11,116,222,0.06);">
                  ${otp.split('').map(d => `
                    <span style="display:inline-block;width:50px;height:50px;line-height:50px;background:#f0f8ff;border:1px solid #dfe9f6;border-radius:8px;font-weight:800;font-size:24px;color:#0b74de;text-align:center;font-family: 'Courier New', monospace;">${d}</span>
                  `).join('')}
                </div>
              </div>

              ${frontendVerifyUrl ? `<p style="text-align:center;margin:18px 0;"><a href="${frontendVerifyUrl}" style="background:#0b74de;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Verify account</a></p>` : ''}

              <p style="margin:22px 0 0 0;font-size:13px;color:#888;">If you did not request this code, you can safely ignore this email.</p>
              <p style="margin:8px 0 0 0;font-size:13px;color:#888;">Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#0b74de;text-decoration:none;">${supportEmail}</a>.</p>
            </div>
            <div style="background:#fafafa;padding:12px 24px;text-align:center;color:#9aa3ad;font-size:12px;">© ${new Date().getFullYear()} ${appName}. All rights reserved.</div>
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
