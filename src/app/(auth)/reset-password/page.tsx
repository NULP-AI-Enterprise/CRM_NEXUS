import Link from "next/link";
import { XCircle } from "lucide-react";

import { checkPasswordResetToken } from "@/lib/email/password-reset";
import { getServerTranslation } from "@/lib/i18n/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const { t } = await getServerTranslation();

  const isValid = token ? await checkPasswordResetToken(token) : false;

  if (!isValid || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="size-4 text-destructive" />
            {t("auth.resetPassword.invalidTitle")}
          </CardTitle>
          <CardDescription>{t("auth.resetPassword.invalidBody")}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter>
          <Button className="w-full" render={<Link href="/forgot-password" />} nativeButton={false}>
            {t("auth.resetPassword.requestNewLink")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} />;
}
