"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AuthFormState = { error: string } | null;

const loginSchema = z.object({
  email: z.string().email("Введіть правильну електронну адресу."),
  password: z.string().min(1, "Введіть пароль."),
});

const registerSchema = z.object({
  name: z.string().trim().max(100).nullish(),
  email: z.string().email("Введіть правильну електронну адресу."),
  password: z.string().min(8, "Пароль має містити щонайменше 8 символів."),
});

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Помилка валідації." };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Невірний email або пароль." };
    }
    throw error;
  }

  return null;
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Помилка валідації." };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Користувач з таким email вже існує." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, passwordHash, name: name || null },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Обліковий запис створено, але автоматичний вхід не вдався. Спробуйте увійти вручну.",
      };
    }
    throw error;
  }

  return null;
}
