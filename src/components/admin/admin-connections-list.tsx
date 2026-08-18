"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

export interface AdminConnectionRow {
  id: string;
  fromName: string;
  toName: string;
  relationship: string | null;
  strength: number;
}

export function AdminConnectionsList({ userId, connections }: { userId: string; connections: AdminConnectionRow[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<AdminConnectionRow | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-heading text-sm font-semibold text-foreground">
        Connections <span className="text-xs font-normal text-muted-foreground">({connections.length})</span>
      </h2>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 font-medium">From</th>
              <th className="px-3 py-2 font-medium">To</th>
              <th className="px-3 py-2 font-medium">Relationship</th>
              <th className="px-3 py-2 font-medium">Strength</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {connections.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No connections.
                </td>
              </tr>
            ) : (
              connections.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted">
                  <td className="px-3 py-2 font-medium text-foreground">{c.fromName}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{c.toName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.relationship ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{c.strength}/5</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setDeleting(c)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDeleteDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          description={`Delete the connection between ${deleting.fromName} and ${deleting.toName}?`}
          onConfirm={async () => {
            const res = await fetch(`/api/admin/users/${userId}/connections/${deleting.id}`, { method: "DELETE" });
            if (!res.ok) {
              toast.error("Failed to delete connection.");
              return;
            }
            toast.success("Connection deleted.");
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
