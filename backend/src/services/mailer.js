import 'dotenv/config';
import nodemailer from 'nodemailer';

const createTransporter = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
};

export async function sendMail({ to, subject, html }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('Skipping email send: missing SMTP_USER/SMTP_PASS');
    return;
  }
  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}
