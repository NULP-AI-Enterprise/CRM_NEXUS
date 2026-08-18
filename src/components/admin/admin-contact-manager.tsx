"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ContactCategory } from "@/generated/prisma/enums";
import type { ContactModel } from "@/generated/prisma/models";

const CATEGORIES: ContactCategory[] = ["VIP", "HR", "INVESTOR", "LEAD", "COLLEAGUE", "FRIEND", "OTHER"];

interface AdminContactManagerProps {
  userId: string;
  contacts: ContactModel[];
  companies: Array<{ id: string; name: string }>;
}

export function AdminContactManager({ userId, contacts, companies }: AdminContactManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<ContactModel | "new" | null>(null);
  const [deleting, setDeleting] = useState<ContactModel | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-foreground">
          Contacts <span className="text-xs font-normal text-muted-foreground">({contacts.length})</span>
        </h2>
        <Button size="sm" onClick={() => setEditing("new")} className="h-7 gap-1.5 px-2.5 text-xs">
          <Plus className="size-3" />
          Add contact
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No contacts.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted">
                  <td className="px-3 py-2 font-medium text-foreground">{c.fullName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.role ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.companyName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.category}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{c.usefulnessScore ?? "—"}</td>
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
        <AdminContactDialog
          userId={userId}
          contact={editing === "new" ? null : editing}
          companies={companies}
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
          description={`Delete ${deleting.fullName}? This removes all their interactions and connections.`}
          onConfirm={async () => {
            const res = await fetch(`/api/admin/users/${userId}/contacts/${deleting.id}`, { method: "DELETE" });
            if (!res.ok) {
              toast.error("Failed to delete contact.");
              return;
            }
            toast.success("Contact deleted.");
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AdminContactDialog({
  userId,
  contact,
  companies,
  onOpenChange,
  onSaved,
}: {
  userId: string;
  contact: ContactModel | null;
  companies: Array<{ id: string; name: string }>;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEditMode = Boolean(contact);
  const [fullName, setFullName] = useState(contact?.fullName ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [companyId, setCompanyId] = useState(contact?.companyId ?? "");
  const [category, setCategory] = useState<ContactCategory>(contact?.category ?? "OTHER");
  const [usefulnessScore, setUsefulnessScore] = useState(
    contact?.usefulnessScore != null ? String(contact.usefulnessScore) : "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast.error("Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        role: role.trim() || null,
        companyId: companyId || null,
        category,
        usefulnessScore: usefulnessScore ? Number(usefulnessScore) : null,
      };
      const res = await fetch(
        isEditMode ? `/api/admin/users/${userId}/contacts/${contact!.id}` : `/api/admin/users/${userId}/contacts`,
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
      toast.success(isEditMode ? "Contact updated." : "Contact created.");
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
            {isEditMode ? "Edit contact" : "Add contact"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-8 text-xs" autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Company</Label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-muted px-2 text-xs text-foreground outline-none focus:border-accent"
              >
                <option value="">None</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ContactCategory)}
                className="h-8 w-full rounded-md border border-border bg-muted px-2 text-xs text-foreground outline-none focus:border-accent"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Score (1-10)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={usefulnessScore}
              onChange={(e) => setUsefulnessScore(e.target.value)}
              className="h-8 text-xs"
            />
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
