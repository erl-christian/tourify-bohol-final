import 'dotenv/config';
import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) sgMail.setApiKey(apiKey);

export async function sendMail({ to, subject, html }) {
  if (!apiKey) {
    console.warn('Skipping email send: missing SENDGRID_API_KEY');
    return;
  }
  try {
    const resp = await sgMail.send({
      to,
      from: process.env.MAIL_FROM || 'no-reply@tourify.com',
      subject,
      html,
    });
    const msgId = resp?.[0]?.headers?.['x-message-id'];
    console.log('[mail] sent', { to, messageId: msgId });
    return resp;
  } catch (err) {
    console.error('[mail] failed', {
      to,
      subject,
      message: err?.message,
      code: err?.code,
      response: err?.response?.body,
    });
    throw err;
  }
}
