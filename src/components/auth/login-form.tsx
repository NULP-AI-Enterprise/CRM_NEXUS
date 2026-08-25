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
import { useTranslation } from "@/lib/i18n/context";
import { ResendVerificationLink } from "@/components/auth/resend-verification-link";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const { t } = useTranslation();
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.login.title")}</CardTitle>
        <CardDescription>{t("auth.login.description")}</CardDescription>
        <CardAction>
          <Button variant="link" nativeButton={false} render={<Link href="/register" />}>
            {t("auth.login.registerLink")}
          </Button>
        </CardAction>
      </CardHeader>
      <form action={formAction}>
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("auth.login.email")}</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("auth.login.password")}</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground underline hover:text-foreground">
                {t("auth.login.forgotPasswordLink")}
              </Link>
            </div>
            <Input id="password" name="password" type="password" required />
          </div>
          {state?.error && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
              {state.unverified && state.email && <ResendVerificationLink email={state.email} />}
            </div>
          )}
        </CardContent>
        <CardFooter className="mt-4 flex flex-col gap-3">
          <SubmitButton className="w-full" pendingText={t("auth.login.submitPending")}>
            {t("auth.login.submit")}
          </SubmitButton>
          <Link
            href="/resend-verification"
            className="text-center text-xs text-muted-foreground underline hover:text-foreground"
          >
            {t("auth.login.resendVerificationEntryLink")}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
