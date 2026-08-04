"use client";

import { useActionState } from "react";
import Link from "next/link";

import { loginAction } from "@/lib/actions/auth-actions";
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

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Вхід</CardTitle>
        <CardDescription>Увійдіть у свій Personal CRM.</CardDescription>
        <CardAction>
          <Button variant="link" nativeButton={false} render={<Link href="/register" />}>
            Реєстрація
          </Button>
        </CardAction>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4">
          <SubmitButton className="w-full" pendingText="Вхід...">
            Увійти
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
