import 'dotenv/config';
import nodemailer from 'nodemailer';

const createTransporter = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465; // Gmail: 465=true, 587=false

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });
};

export async function sendMail({ to, subject, html }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('Skipping email send: missing SMTP_USER/SMTP_PASS');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log('[mail] sent', { to, messageId: info?.messageId });
    return info;
  } catch (err) {
    console.error('[mail] failed', {
      to,
      subject,
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
    });
    throw err;
  }
}
