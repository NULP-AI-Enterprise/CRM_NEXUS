"use server";

import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndSendVerificationEmail } from "@/lib/email/verification";
import { createAndSendPasswordResetEmail } from "@/lib/email/password-reset";
import { getServerTranslation } from "@/lib/i18n/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type AuthFormState =
  | { error: string; unverified?: boolean; email?: string; awaitingVerification?: never }
  | { awaitingVerification: true; email: string; error?: never }
  | null;

export type ResendVerificationFormState = { error: string; submitted?: never } | { submitted: true; error?: never } | null;

export type ForgotPasswordFormState = { error: string; submitted?: never } | { submitted: true; error?: never } | null;

export type ResetPasswordFormState = { error: string; success?: never } | { success: true; error?: never } | null;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().trim().max(100).nullish(),
  email: z.string().email(),
  password: z.string().min(8),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { t } = await getServerTranslation();

  const ip = getClientIp(await headers());
  if (checkRateLimit("authLogin", ip).limited) {
    return { error: t("common.rateLimited") };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: t("auth.login.validationError") };
  }
  const { email, password } = parsed.data;

  if (checkRateLimit("authLoginPerEmail", email).limited) {
    return { error: t("common.rateLimited") };
  }

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

  const ip = getClientIp(await headers());
  if (checkRateLimit("authRegister", ip).limited) {
    return { error: t("common.rateLimited") };
  }

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
  const ip = getClientIp(await headers());
  if (checkRateLimit("authResendVerification", ip).limited) {
    return { ok: false };
  }
  if (checkRateLimit("authResendVerificationPerEmail", email).limited) {
    return { ok: false };
  }

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

export async function resendVerificationFormAction(
  _prevState: ResendVerificationFormState,
  formData: FormData,
): Promise<ResendVerificationFormState> {
  const { t } = await getServerTranslation();

  const parsed = resendVerificationSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: t("auth.forgotPassword.emailInvalid") };
  }

  // resendVerificationAction() already no-ops silently for unknown/already-verified
  // emails, so this stays quiet about account existence too.
  await resendVerificationAction(parsed.data.email);

  return { submitted: true };
}

export async function forgotPasswordAction(
  _prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const { t, locale } = await getServerTranslation();

  const ip = getClientIp(await headers());
  if (checkRateLimit("authForgotPassword", ip).limited) {
    return { error: t("common.rateLimited") };
  }

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: t("auth.forgotPassword.emailInvalid") };
  }

  // Keyed by the target email (not just IP) so a distributed sender can't
  // bypass the IP bucket above and still flood one victim's inbox.
  if (checkRateLimit("authForgotPasswordPerEmail", parsed.data.email).limited) {
    return { submitted: true };
  }

  // Always report success regardless of whether the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    try {
      await createAndSendPasswordResetEmail(user.id, user.email, locale);
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  }

  return { submitted: true };
}

export async function resetPasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const { t } = await getServerTranslation();

  const ip = getClientIp(await headers());
  if (checkRateLimit("authResetPassword", ip).limited) {
    return { error: t("common.rateLimited") };
  }

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "password") {
      return { error: t("auth.resetPassword.passwordTooShort") };
    }
    return { error: t("auth.resetPassword.invalidLink") };
  }
  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    return { error: t("auth.resetPassword.invalidLink") };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { success: true };
}
