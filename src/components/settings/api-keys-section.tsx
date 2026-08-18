"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { uk, enUS } from "date-fns/locale";
import { KeyRound, Loader2, Plus, Copy, Check } from "lucide-react";
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
import type { ApiKeySummary } from "@/lib/data/api-keys";
import type { ApiKeyScope } from "@/generated/prisma/enums";

type ExpiryDays = 90 | 365 | null;

/** Dates arrive as real `Date`s in `initialKeys` (server-rendered props) but
 * as ISO strings from subsequent client fetch() responses — this widens the
 * date fields so both sources fit the same state shape without re-parsing. */
type ApiKeyRow = Omit<ApiKeySummary, "expiresAt" | "lastUsedAt" | "revokedAt" | "createdAt"> & {
  expiresAt: string | Date | null;
  lastUsedAt: string | Date | null;
  revokedAt: string | Date | null;
  createdAt: string | Date;
};

export function ApiKeysSection({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const { t, locale } = useTranslation();
  const dateLocale = locale === "uk" ? uk : enUS;

  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ name: string; rawKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiKeyScope>("READ");
  const [redactSensitive, setRedactSensitive] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState<ExpiryDays>(90);
  const [isPending, startTransition] = useTransition();

  const formatDate = (value: string | Date | null) =>
    value ? format(new Date(value), "d MMM yyyy", { locale: dateLocale }) : null;

  const resetForm = () => {
    setName("");
    setScope("READ");
    setRedactSensitive(true);
    setExpiresInDays(90);
  };

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error(t("settings.apiKeys.nameRequired"));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/api-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), scope, redactSensitive, expiresInDays }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? t("common.unknownError"));
        }
        setKeys((prev) => [data.apiKey, ...prev]);
        setIsCreateOpen(false);
        resetForm();
        setRevealedKey({ name: data.apiKey.name, rawKey: data.rawKey });
        setCopied(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      const res = await fetch(`/api/api-keys/${revokeTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("common.unknownError"));
      setKeys((prev) =>
        prev.map((k) => (k.id === revokeTarget.id ? { ...k, revokedAt: new Date().toISOString() } : k)),
      );
      toast.success(t("settings.apiKeys.revoked"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  const handleCopy = async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey.rawKey);
      setCopied(true);
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
            <KeyRound className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              {t("settings.apiKeys.title")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("settings.apiKeys.description")}</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-md"
        >
          <Plus className="size-3" />
          {t("settings.apiKeys.generate")}
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {keys.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">{t("settings.apiKeys.empty")}</p>
        )}
        {keys.map((key) => {
          const isRevoked = Boolean(key.revokedAt);
          return (
            <div
              key={key.id}
              className={`rounded-lg border border-border bg-muted/50 p-3 flex flex-wrap items-center justify-between gap-2 ${isRevoked ? "opacity-50" : ""}`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{key.name}</span>
                  <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {key.scope === "READ_WRITE" ? t("settings.apiKeys.scopeReadWrite") : t("settings.apiKeys.scopeRead")}
                  </span>
                  {key.redactSensitive && (
                    <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {t("settings.apiKeys.redactBadge")}
                    </span>
                  )}
                  {isRevoked && (
                    <span className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      {t("settings.apiKeys.revokedBadge")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground font-mono">
                  <span>•••• {key.keyPreview}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span>
                    {key.lastUsedAt
                      ? `${t("settings.apiKeys.lastUsed")} ${formatDate(key.lastUsedAt)}`
                      : t("settings.apiKeys.neverUsed")}
                  </span>
                  <span className="text-muted-foreground/60">·</span>
                  <span>
                    {key.expiresAt
                      ? `${t("settings.apiKeys.expiresAt")} ${formatDate(key.expiresAt)}`
                      : t("settings.apiKeys.neverExpires")}
                  </span>
                </div>
              </div>
              {!isRevoked && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRevokeTarget(key)}
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
              {t("settings.apiKeys.generate")}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("settings.apiKeys.generate")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 py-1 text-xs">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-muted-foreground">{t("settings.apiKeys.name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("settings.apiKeys.namePlaceholder")}
                className="bg-muted border-border text-base md:text-xs h-8 rounded-md"
                disabled={isPending}
                autoFocus
              />
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-muted-foreground">{t("settings.apiKeys.scope")}</Label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as ApiKeyScope)}
                  className="w-full rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent h-8"
                  disabled={isPending}
                >
                  <option value="READ">{t("settings.apiKeys.scopeRead")}</option>
                  <option value="READ_WRITE">{t("settings.apiKeys.scopeReadWrite")}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-muted-foreground">{t("settings.apiKeys.expiry")}</Label>
                <select
                  value={expiresInDays ?? "never"}
                  onChange={(e) => setExpiresInDays(e.target.value === "never" ? null : (Number(e.target.value) as 90 | 365))}
                  className="w-full rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent h-8"
                  disabled={isPending}
                >
                  <option value={90}>{t("settings.apiKeys.expiry90")}</option>
                  <option value={365}>{t("settings.apiKeys.expiry365")}</option>
                  <option value="never">{t("settings.apiKeys.expiryNever")}</option>
                </select>
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-md border border-border bg-muted px-2.5 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={redactSensitive}
                onChange={(e) => setRedactSensitive(e.target.checked)}
                disabled={isPending}
                className="mt-0.5 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">{t("settings.apiKeys.redact")}</span>
                <span className="text-[11px] text-muted-foreground">{t("settings.apiKeys.redactHint")}</span>
              </span>
            </label>
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
              {isPending ? t("common.saving") : t("settings.apiKeys.generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time reveal dialog */}
      <Dialog open={Boolean(revealedKey)} onOpenChange={(open) => !open && setRevealedKey(null)}>
        <DialogContent className="sm:max-w-md border border-border bg-card text-foreground backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground">
              {t("settings.apiKeys.revealTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("settings.apiKeys.revealWarning")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <code className="flex-1 text-xs font-mono text-foreground break-all select-all">
              {revealedKey?.rawKey}
            </code>
            <Button
              size="icon"
              variant="outline"
              onClick={handleCopy}
              className="size-7 shrink-0 border-border bg-card text-muted-foreground hover:text-foreground"
              title={t("settings.apiKeys.copy")}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          </div>

          <DialogFooter className="border-t border-border pt-2.5">
            <Button
              size="sm"
              onClick={() => setRevealedKey(null)}
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
        description={t("settings.apiKeys.revokeConfirm", { name: revokeTarget?.name ?? "" })}
        onConfirm={handleRevoke}
      />
    </div>
  );
}
