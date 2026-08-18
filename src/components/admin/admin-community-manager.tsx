"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import type { CommunityModel } from "@/generated/prisma/models";

export function AdminCommunityManager({ userId, communities }: { userId: string; communities: CommunityModel[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CommunityModel | "new" | null>(null);
  const [deleting, setDeleting] = useState<CommunityModel | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-foreground">
          Communities <span className="text-xs font-normal text-muted-foreground">({communities.length})</span>
        </h2>
        <Button size="sm" onClick={() => setEditing("new")} className="h-7 gap-1.5 px-2.5 text-xs">
          <Plus className="size-3" />
          Add community
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {communities.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  No communities.
                </td>
              </tr>
            ) : (
              communities.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted">
                  <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                  <td className="max-w-sm truncate px-3 py-2 text-muted-foreground">{c.description ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <AdminCommunityDialog
          userId={userId}
          community={editing === "new" ? null : editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {deleting && (
        <ConfirmDeleteDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          description={`Delete ${deleting.name}?`}
          onConfirm={async () => {
            const res = await fetch(`/api/admin/users/${userId}/communities/${deleting.id}`, { method: "DELETE" });
            if (!res.ok) {
              toast.error("Failed to delete community.");
              return;
            }
            toast.success("Community deleted.");
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AdminCommunityDialog({
  userId,
  community,
  onOpenChange,
  onSaved,
}: {
  userId: string;
  community: CommunityModel | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEditMode = Boolean(community);
  const [name, setName] = useState(community?.name ?? "");
  const [description, setDescription] = useState(community?.description ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null };
      const res = await fetch(
        isEditMode
          ? `/api/admin/users/${userId}/communities/${community!.id}`
          : `/api/admin/users/${userId}/communities`,
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error === "duplicate" ? "A community with this name already exists." : data?.error ?? "Something went wrong.");
      toast.success(isEditMode ? "Community updated." : "Community created.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground">
            {isEditMode ? "Edit community" : "Add community"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16 text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving} className="h-7 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSaving} className="h-7 text-xs">
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
