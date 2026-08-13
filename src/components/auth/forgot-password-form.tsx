"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { forgotPasswordAction } from "@/lib/actions/auth-actions";
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

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [state, formAction] = useActionState(forgotPasswordAction, null);

  if (state?.submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="size-4" />
            {t("auth.forgotPassword.checkInboxTitle")}
          </CardTitle>
          <CardDescription>{t("auth.forgotPassword.checkInboxBody")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" className="w-full" render={<Link href="/login" />} nativeButton={false}>
            {t("auth.verify.backToLogin")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.forgotPassword.title")}</CardTitle>
        <CardDescription>{t("auth.forgotPassword.description")}</CardDescription>
        <CardAction>
          <Button variant="link" nativeButton={false} render={<Link href="/login" />}>
            {t("auth.register.loginLink")}
          </Button>
        </CardAction>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("auth.login.email")}</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required autoFocus />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4">
          <SubmitButton className="w-full" pendingText={t("auth.forgotPassword.submitPending")}>
            {t("auth.forgotPassword.submit")}
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
