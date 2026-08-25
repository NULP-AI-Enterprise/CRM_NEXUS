import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedRedirectUri } from "@/lib/mcp/oauth";
import { getServerTranslation } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Authorize — Nexus CRM" };

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const { t } = await getServerTranslation();

  const responseType = firstValue(raw.response_type);
  const clientId = firstValue(raw.client_id);
  const redirectUri = firstValue(raw.redirect_uri);
  const state = firstValue(raw.state);
  const codeChallenge = firstValue(raw.code_challenge);
  const codeChallengeMethod = firstValue(raw.code_challenge_method);

  // redirect_uri must be validated on its own, in isolation, before anything
  // else is trusted enough to bounce back to it — an unvalidated redirect
  // target is an open-redirect primitive.
  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("oauth.authorize.errorTitle")}</CardTitle>
          <CardDescription>{t("oauth.authorize.invalidRedirect")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const bounce = (error: string) => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    if (state) url.searchParams.set("state", state);
    redirect(url.toString());
  };

  if (responseType !== "code" || !codeChallenge || codeChallengeMethod !== "S256") {
    bounce("invalid_request");
  }

  const client = clientId
    ? await prisma.oAuthClient.findUnique({ where: { clientId }, select: { id: true, name: true, revokedAt: true } })
    : null;
  if (!client || client.revokedAt) {
    bounce("invalid_client");
  }

  const session = await auth();
  if (!session?.user) {
    const here = new URL("/oauth/authorize", "http://placeholder");
    for (const [key, value] of Object.entries(raw)) {
      const v = firstValue(value);
      if (v) here.searchParams.set(key, v);
    }
    redirect(`/login?callbackUrl=${encodeURIComponent(here.pathname + here.search)}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("oauth.authorize.title", { name: client!.name })}</CardTitle>
        <CardDescription>{t("oauth.authorize.description")}</CardDescription>
      </CardHeader>
      <form action="/api/oauth/authorize" method="POST">
        <input type="hidden" name="client_id" value={clientId!} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="code_challenge" value={codeChallenge!} />
        <input type="hidden" name="code_challenge_method" value={codeChallengeMethod!} />
        {state && <input type="hidden" name="state" value={state} />}
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t("oauth.authorize.redirectsTo")} <span className="font-mono text-foreground">{redirectUri}</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("oauth.authorize.scope")}</Label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="scope" value="READ" defaultChecked className="accent-primary" />
              {t("settings.apiKeys.scopeRead")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="scope" value="READ_WRITE" className="accent-primary" />
              {t("settings.apiKeys.scopeReadWrite")}
            </label>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border bg-muted px-2.5 py-2 text-xs">
            <input type="checkbox" name="redactSensitive" value="true" defaultChecked className="mt-0.5 accent-primary" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">{t("settings.apiKeys.redact")}</span>
              <span className="text-muted-foreground">{t("settings.apiKeys.redactHint")}</span>
            </span>
          </label>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
            {t("oauth.authorize.deny")}
          </Button>
          <Button type="submit" name="decision" value="allow" className="flex-1">
            {t("oauth.authorize.allow")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
