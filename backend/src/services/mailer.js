import 'dotenv/config';
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || 'no-reply@tourify.com';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter();

  if (!tx) {
    console.warn('[mail] skipped: missing SMTP config (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)');
    return null;
  }

  try {
    const info = await tx.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text: text || (html ? html.replace(/<[^>]+>/g, ' ') : ''),
    });

    console.log('[mail] sent', { to, messageId: info?.messageId, provider: 'smtp' });
    return info;
  } catch (err) {
    console.error('[mail] failed', {
      to,
      subject,
      message: err?.message,
      code: err?.code,
      response: err?.response,
    });
    throw err;
  }
}
