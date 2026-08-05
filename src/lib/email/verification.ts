import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email/mailer";
import type { Locale } from "@/lib/i18n/dictionary";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function buildEmail(verifyUrl: string, locale: Locale) {
  const isUk = locale === "uk";
  const subject = isUk ? "Підтвердіть ваш email — Nexus CRM" : "Confirm your email — Nexus CRM";
  const heading = isUk ? "Підтвердіть свій email" : "Confirm your email";
  const body = isUk
    ? "Натисніть кнопку нижче, щоб підтвердити email і активувати акаунт Nexus CRM. Посилання дійсне 24 години."
    : "Click the button below to confirm your email and activate your Nexus CRM account. This link is valid for 24 hours.";
  const button = isUk ? "Підтвердити email" : "Confirm email";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 12px;">${heading}</h2>
      <p style="color:#444; line-height:1.5;">${body}</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${button}</a>
      </p>
      <p style="color:#888; font-size:12px; word-break: break-all;">${verifyUrl}</p>
    </div>
  `.trim();
  const text = `${heading}\n\n${body}\n\n${verifyUrl}`;

  return { subject, html, text };
}

export async function createAndSendVerificationEmail(userId: string, email: string, locale: Locale) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  const { subject, html, text } = buildEmail(verifyUrl, locale);

  await sendMail({ to: email, subject, html, text });
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    return false;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return true;
}
