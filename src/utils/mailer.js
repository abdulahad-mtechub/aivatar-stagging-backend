const nodemailer = require('nodemailer');
const logger = require('./logger');

// Lazy transporter singleton
let transporter = null;

function createTransporter() {
  if (transporter) return transporter;

  // Support both SMTP_* and EMAIL_* env var names
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = process.env.SMTP_PORT
    ? Number(process.env.SMTP_PORT)
    : process.env.EMAIL_PORT
    ? Number(process.env.EMAIL_PORT)
    : undefined;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  // Allow explicit secure flag via EMAIL_SECURE or infer from port
  const secureEnv = process.env.SMTP_SECURE || process.env.EMAIL_SECURE;
  const secure = secureEnv !== undefined ? secureEnv === 'true' || secureEnv === '1' : port === 465;

  if (!host || !port || !user || !pass) {
    logger.warn('SMTP not fully configured (SMTP_HOST/PORT/USER/PASS). Falling back to logger.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: !!secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  // verify connection
  transporter.verify().then(() => {
    logger.info('SMTP transporter verified');
  }).catch(err => {
    logger.error('SMTP verify failed:', err.message);
  });

  return transporter;
}

/**
 * Send an email. Returns a promise that resolves with send result.
 */
async function sendMail({ to, subject, text, html, from }) {
  const t = createTransporter();

  // If transporter is not configured, fall back to logging
  if (!t) {
    logger.info(`Email fallback — to: ${to}, subject: ${subject}, text: ${text}`);
    return { accepted: [to], messageId: 'logger-fallback' };
  }

  const mailOptions = {
    from: from || process.env.FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  };

  try {
    const result = await t.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${result.messageId}`);
    return result;
  } catch (err) {
    logger.error(`Error sending email to ${to}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendMail };
