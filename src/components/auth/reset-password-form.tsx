"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { resetPasswordAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
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

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useTranslation();
  const [state, formAction] = useActionState(resetPasswordAction, null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  if (state?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            {t("auth.resetPassword.successTitle")}
          </CardTitle>
          <CardDescription>{t("auth.resetPassword.successBody")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" render={<Link href="/login" />} nativeButton={false}>
            {t("auth.verify.goToLogin")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.resetPassword.title")}</CardTitle>
        <CardDescription>{t("auth.resetPassword.description")}</CardDescription>
      </CardHeader>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (mismatch) e.preventDefault();
        }}
      >
        <input type="hidden" name="token" value={token} />
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("auth.resetPassword.newPassword")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("auth.register.passwordHint")}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">{t("auth.resetPassword.confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {mismatch && (
              <p className="text-xs text-destructive">{t("auth.resetPassword.passwordMismatch")}</p>
            )}
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4">
          <SubmitButton className="w-full" pendingText={t("auth.resetPassword.submitPending")}>
            {t("auth.resetPassword.submit")}
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
