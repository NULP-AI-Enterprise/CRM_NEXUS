"use client";

import { useActionState } from "react";
import Link from "next/link";

import { registerAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Реєстрація</CardTitle>
        <CardDescription>Створіть акаунт Personal CRM.</CardDescription>
        <CardAction>
          <Button variant="link" nativeButton={false} render={<Link href="/login" />}>
            Вхід
          </Button>
        </CardAction>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Ім&apos;я</Label>
            <Input id="name" name="name" placeholder="Ваше ім'я" autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
            <p className="text-xs text-muted-foreground">Щонайменше 8 символів.</p>
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4">
          <SubmitButton className="w-full" pendingText="Створення...">
            Створити акаунт
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
