"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndSendVerificationEmail } from "@/lib/email/verification";
import { getServerTranslation } from "@/lib/i18n/server";

export type AuthFormState =
  | { error: string; unverified?: boolean; email?: string; awaitingVerification?: never }
  | { awaitingVerification: true; email: string; error?: never }
  | null;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().trim().max(100).nullish(),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { t } = await getServerTranslation();

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: t("auth.login.validationError") };
  }
  const { email, password } = parsed.data;

  // Checked ahead of signIn purely to give a precise, actionable message —
  // the real security gate is the emailVerified check inside authorize().
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && !existingUser.emailVerified) {
    const passwordMatches = await bcrypt.compare(password, existingUser.passwordHash);
    if (passwordMatches) {
      return { error: t("auth.login.unverified"), unverified: true, email };
    }
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t("auth.login.invalidCredentials") };
    }
    throw error;
  }

  return null;
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { t, locale } = await getServerTranslation();

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "email") {
      return { error: t("auth.register.emailInvalid") };
    }
    if (issue?.path[0] === "password") {
      return { error: t("auth.register.passwordTooShort") };
    }
    return { error: t("auth.register.validationError") };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t("auth.register.emailExists") };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name || null },
  });

  try {
    await createAndSendVerificationEmail(user.id, user.email, locale);
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }

  return { awaitingVerification: true, email: user.email };
}

export async function resendVerificationAction(email: string): Promise<{ ok: boolean }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    return { ok: false };
  }

  const { locale } = await getServerTranslation();

  try {
    await createAndSendVerificationEmail(user.id, user.email, locale);
    return { ok: true };
  } catch (error) {
    console.error("Failed to resend verification email:", error);
    return { ok: false };
  }
}
