"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import { ShieldCheck, Loader2, Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useTranslation } from "@/lib/i18n/context";
import type { OAuthClientSummary } from "@/lib/data/oauth-clients";

/** Dates arrive as real `Date`s in `initialClients` (server-rendered props)
 * but as ISO strings from subsequent client fetch() responses. */
type OAuthClientRow = Omit<OAuthClientSummary, "revokedAt" | "createdAt" | "accessTokens"> & {
  revokedAt: string | Date | null;
  createdAt: string | Date;
  accessTokens: { lastUsedAt: string | Date | null }[];
};

export function OAuthClientSection({
  initialClients,
  allowedRedirectUris,
}: {
  initialClients: OAuthClientSummary[];
  allowedRedirectUris: readonly string[];
}) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;

  const [clients, setClients] = useState<OAuthClientRow[]>(initialClients);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<OAuthClientRow | null>(null);
  const [revealed, setRevealed] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [copiedField, setCopiedField] = useState<"clientId" | "clientSecret" | null>(null);

  const [name, setName] = useState("Claude");
  const [isPending, startTransition] = useTransition();

  const formatDate = (value: string | Date | null) =>
    value ? format(new Date(value), "d MMM yyyy", { locale: dateLocale }) : null;

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error(t("settings.oauthClients.nameRequired"));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/oauth-clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? t("common.unknownError"));
        setClients((prev) => [{ ...data.client, accessTokens: [] }, ...prev]);
        setIsCreateOpen(false);
        setName("Claude");
        setRevealed({ clientId: data.client.clientId, clientSecret: data.clientSecret });
        setCopiedField(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      const res = await fetch(`/api/oauth-clients/${revokeTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("common.unknownError"));
      setClients((prev) =>
        prev.map((c) => (c.id === revokeTarget.id ? { ...c, revokedAt: new Date().toISOString() } : c)),
      );
      toast.success(t("settings.oauthClients.revoked"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  const handleCopy = async (value: string, field: "clientId" | "clientSecret") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(t("settings.apiKeys.copied"));
    } catch {
      toast.error(t("common.unknownError"));
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-secondary border border-border">
            <ShieldCheck className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              {t("settings.oauthClients.title")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("settings.oauthClients.description")}</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-md"
        >
          <Plus className="size-3" />
          {t("settings.oauthClients.create")}
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {clients.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">{t("settings.oauthClients.empty")}</p>
        )}
        {clients.map((client) => {
          const isRevoked = Boolean(client.revokedAt);
          const lastUsedAt = client.accessTokens[0]?.lastUsedAt ?? null;
          return (
            <div
              key={client.id}
              className={`rounded-lg border border-border bg-muted/50 p-3 flex flex-wrap items-center justify-between gap-2 ${isRevoked ? "opacity-50" : ""}`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{client.name}</span>
                  {isRevoked && (
                    <span className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      {t("settings.apiKeys.revokedBadge")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground font-mono">
                  <span>{client.clientId}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span>
                    {lastUsedAt
                      ? `${t("settings.apiKeys.lastUsed")} ${formatDate(lastUsedAt)}`
                      : t("settings.apiKeys.neverUsed")}
                  </span>
                </div>
              </div>
              {!isRevoked && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRevokeTarget(client)}
                  className="h-7 px-2.5 text-xs border-border bg-card text-muted-foreground hover:text-destructive"
                >
                  {t("settings.apiKeys.revoke")}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md border border-border bg-card text-foreground backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground">
              {t("settings.oauthClients.create")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("settings.oauthClients.createHint")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 py-1 text-xs">
            <Label className="text-xs font-medium text-muted-foreground">{t("settings.apiKeys.name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted border-border text-base md:text-xs h-8 rounded-md"
              disabled={isPending}
              autoFocus
            />
          </div>

          <DialogFooter className="border-t border-border pt-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={isPending}
              className="border-border bg-card text-muted-foreground hover:bg-muted h-7 text-xs"
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isPending || !name.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-7 text-xs font-medium"
            >
              {isPending && <Loader2 className="size-3 animate-spin" />}
              {isPending ? t("common.saving") : t("settings.oauthClients.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time secret reveal dialog */}
      <Dialog open={Boolean(revealed)} onOpenChange={(open) => !open && setRevealed(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md border border-border bg-card text-foreground backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground">
              {t("settings.oauthClients.revealTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("settings.apiKeys.revealWarning")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">{t("settings.oauthClients.clientId")}</Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <code className="flex-1 font-mono text-foreground break-all select-all">{revealed?.clientId}</code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => revealed && handleCopy(revealed.clientId, "clientId")}
                  className="size-7 shrink-0 border-border bg-card text-muted-foreground hover:text-foreground"
                  title={t("settings.apiKeys.copy")}
                >
                  {copiedField === "clientId" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">{t("settings.oauthClients.clientSecret")}</Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <code className="flex-1 font-mono text-foreground break-all select-all">{revealed?.clientSecret}</code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => revealed && handleCopy(revealed.clientSecret, "clientSecret")}
                  className="size-7 shrink-0 border-border bg-card text-muted-foreground hover:text-foreground"
                  title={t("settings.apiKeys.copy")}
                >
                  {copiedField === "clientSecret" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">{t("settings.oauthClients.redirectUri")}</Label>
              {allowedRedirectUris.map((uri) => (
                <code key={uri} className="rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-[11px] text-foreground break-all">
                  {uri}
                </code>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-2.5">
            <Button
              size="sm"
              onClick={() => setRevealed(null)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs font-medium"
            >
              {t("settings.apiKeys.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        description={t("settings.oauthClients.revokeConfirm", { name: revokeTarget?.name ?? "" })}
        onConfirm={handleRevoke}
      />
    </div>
  );
}
