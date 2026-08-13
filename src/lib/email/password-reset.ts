import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/mailer";
import type { Locale } from "@/lib/i18n/dictionary";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function buildEmail(resetUrl: string, locale: Locale) {
  const isUk = locale === "uk";
  const subject = isUk ? "Відновлення пароля — Nexus CRM" : "Reset your password — Nexus CRM";
  const heading = isUk ? "Відновлення пароля" : "Reset your password";
  const body = isUk
    ? "Ми отримали запит на відновлення пароля для вашого акаунта Nexus CRM. Натисніть кнопку нижче, щоб встановити новий пароль. Посилання дійсне 1 годину. Якщо це були не ви — просто ігноруйте цей лист."
    : "We received a request to reset the password for your Nexus CRM account. Click the button below to set a new password. This link is valid for 1 hour. If this wasn't you, you can safely ignore this email.";
  const button = isUk ? "Встановити новий пароль" : "Set new password";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 12px;">${heading}</h2>
      <p style="color:#444; line-height:1.5;">${body}</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${button}</a>
      </p>
      <p style="color:#888; font-size:12px; word-break: break-all;">${resetUrl}</p>
    </div>
  `.trim();
  const text = `${heading}\n\n${body}\n\n${resetUrl}`;

  return { subject, html, text };
}

export async function createAndSendPasswordResetEmail(userId: string, email: string, locale: Locale) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const { subject, html, text } = buildEmail(resetUrl, locale);

  await sendMail({ to: email, subject, html, text });
}

export async function checkPasswordResetToken(token: string): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  return Boolean(record && record.expiresAt >= new Date());
}
