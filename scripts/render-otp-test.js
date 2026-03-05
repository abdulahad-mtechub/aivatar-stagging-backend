const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../src/utils/emailTemplates');

// Usage: node scripts/render-otp-test.js [otp]
const otp = process.argv[2] || '1234';
const expiry = process.env.OTP_EXPIRE_MINUTES || 10;
const supportEmail = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || 'support@example.com';

const otpDigitsHtml = otp.split('').map(d =>
  `<span style="display:inline-block;width:50px;height:50px;line-height:50px;background:#f0f8ff;border:1px solid #dfe9f6;border-radius:8px;font-weight:800;font-size:24px;color:#0b74de;text-align:center;font-family: 'Courier New', monospace;margin:0 4px;">${d}</span>`
).join('');

const verifyButton = `<p style="text-align:center;margin:18px 0;"><a href="${(process.env.FRONTEND_URL||'').replace(/\/$/, '') + '/verify'}" style="background:#0b74de;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Verify account</a></p>`;

const html = renderTemplate('otp-template', {
  APP_NAME: process.env.APP_NAME || 'Aivatar',
  EXPIRY_MINUTES: expiry,
  SUPPORT_EMAIL: supportEmail,
  OTP_DIGITS_HTML: otpDigitsHtml,
  FRONTEND_VERIFY_BUTTON: verifyButton,
});

const out = path.join(__dirname, '..', 'tmp', 'otp-preview.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf8');
console.log('OTP preview written to', out);
