import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { adminListUsers } from "@/lib/data/admin";

export default async function AdminUsersPage() {
  const users = await adminListUsers();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-lg font-semibold text-foreground">
        Users <span className="text-sm font-normal text-muted-foreground">({users.length})</span>
      </h1>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Verified</th>
              <th className="px-3 py-2 font-medium">Contacts</th>
              <th className="px-3 py-2 font-medium">Companies</th>
              <th className="px-3 py-2 font-medium">Communities</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted">
                <td className="px-3 py-2 font-medium text-foreground">{u.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.name ?? "—"}</td>
                <td className="px-3 py-2">
                  {u.emailVerified ? (
                    <span className="text-foreground">Yes</span>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{u.contactCount}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{u.companyCount}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{u.communityCount}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {new Date(u.createdAt).toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    View
                    <ChevronRight className="size-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
