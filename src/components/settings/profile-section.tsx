"use client";

import { useState, useTransition } from "react";
import { User, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/context";

export function ProfileSection({ initialName, email }: { initialName: string | null; email: string }) {
  const { t } = useTranslation();

  const [name, setName] = useState(initialName ?? "");
  const [isSavingName, startSavingName] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, startSavingPassword] = useTransition();

  const handleSaveName = () => {
    startSavingName(async () => {
      try {
        const res = await fetch("/api/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? t("common.unknownError"));
        setName(data.user.name ?? "");
        toast.success(t("settings.profile.nameSaved"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  const handleChangePassword = () => {
    if (newPassword.length < 8) {
      toast.error(t("settings.profile.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.profile.passwordMismatch"));
      return;
    }

    startSavingPassword(async () => {
      try {
        const res = await fetch("/api/account/password", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          const message =
            data?.error === "invalid_current_password"
              ? t("settings.profile.wrongCurrentPassword")
              : t("common.unknownError");
          throw new Error(message);
        }
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast.success(t("settings.profile.passwordChanged"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-secondary border border-border">
          <User className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">{t("settings.profile.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("settings.profile.description")}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium text-muted-foreground">{t("settings.profile.name")}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.profile.namePlaceholder")}
            className="bg-muted border-border text-base md:text-xs h-8 rounded-md"
            disabled={isSavingName}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium text-muted-foreground">{t("settings.profile.email")}</Label>
          <Input value={email} disabled className="bg-muted border-border text-base md:text-xs h-8 rounded-md opacity-70" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          onClick={handleSaveName}
          disabled={isSavingName || name.trim() === (initialName ?? "")}
          className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-md"
        >
          {isSavingName && <Loader2 className="size-3 animate-spin" />}
          {t("settings.profile.saveName")}
        </Button>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          {t("settings.profile.changePassword")}
        </h3>
        <div className="mt-3 grid gap-3.5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">{t("settings.profile.currentPassword")}</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-muted border-border text-base md:text-xs h-8 rounded-md"
              disabled={isSavingPassword}
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">{t("settings.profile.newPassword")}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-muted border-border text-base md:text-xs h-8 rounded-md"
              disabled={isSavingPassword}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">{t("settings.profile.confirmPassword")}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-muted border-border text-base md:text-xs h-8 rounded-md"
              disabled={isSavingPassword}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={handleChangePassword}
            disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-md"
          >
            {isSavingPassword && <Loader2 className="size-3 animate-spin" />}
            {t("settings.profile.savePassword")}
          </Button>
        </div>
      </div>
    </div>
  );
}
