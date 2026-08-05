import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendMail(params: { to: string; subject: string; html: string; text: string }) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USERNAME,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}
