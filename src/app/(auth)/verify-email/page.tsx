import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { verifyEmailToken } from "@/lib/email/verification";
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

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  const { t } = await getServerTranslation();

  const ok = token ? await verifyEmailToken(token) : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {ok ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <XCircle className="size-4 text-destructive" />
          )}
          {ok ? t("auth.verify.successTitle") : t("auth.verify.invalidTitle")}
        </CardTitle>
        <CardDescription>{ok ? t("auth.verify.successBody") : t("auth.verify.invalidBody")}</CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter>
        <Button className="w-full" render={<Link href="/login" />} nativeButton={false}>
          {t("auth.verify.goToLogin")}
        </Button>
      </CardFooter>
    </Card>
  );
}
