"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resendVerificationAction } from "@/lib/actions/auth-actions";
import { useTranslation } from "@/lib/i18n/context";

export function ResendVerificationLink({ email }: { email: string }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const handleClick = () => {
    startTransition(async () => {
      await resendVerificationAction(email);
      setSent(true);
      toast.success(t("auth.login.resendSent"));
    });
  };

  if (sent) {
    return <p className="text-xs text-muted-foreground">{t("auth.login.resendSent")}</p>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-left text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
    >
      {t("auth.login.resendLink")}
    </button>
  );
}
