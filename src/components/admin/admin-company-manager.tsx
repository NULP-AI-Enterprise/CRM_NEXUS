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
import type { CompanyModel } from "@/generated/prisma/models";

export function AdminCompanyManager({ userId, companies }: { userId: string; companies: CompanyModel[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CompanyModel | "new" | null>(null);
  const [deleting, setDeleting] = useState<CompanyModel | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-foreground">
          Companies <span className="text-xs font-normal text-muted-foreground">({companies.length})</span>
        </h2>
        <Button size="sm" onClick={() => setEditing("new")} className="h-7 gap-1.5 px-2.5 text-xs">
          <Plus className="size-3" />
          Add company
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Industry</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No companies.
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted">
                  <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.industry ?? "—"}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-muted-foreground">{c.description ?? "—"}</td>
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
        <AdminCompanyDialog
          userId={userId}
          company={editing === "new" ? null : editing}
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
          description={`Delete ${deleting.name}? Its contacts become unassigned.`}
          onConfirm={async () => {
            const res = await fetch(`/api/admin/users/${userId}/companies/${deleting.id}`, { method: "DELETE" });
            if (!res.ok) {
              toast.error("Failed to delete company.");
              return;
            }
            toast.success("Company deleted.");
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AdminCompanyDialog({
  userId,
  company,
  onOpenChange,
  onSaved,
}: {
  userId: string;
  company: CompanyModel | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEditMode = Boolean(company);
  const [name, setName] = useState(company?.name ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [description, setDescription] = useState(company?.description ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        industry: industry.trim() || null,
        description: description.trim() || null,
      };
      const res = await fetch(
        isEditMode ? `/api/admin/users/${userId}/companies/${company!.id}` : `/api/admin/users/${userId}/companies`,
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error === "duplicate" ? "A company with this name already exists." : data?.error ?? "Something went wrong.");
      toast.success(isEditMode ? "Company updated." : "Company created.");
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
            {isEditMode ? "Edit company" : "Add company"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Industry</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-8 text-xs" />
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
