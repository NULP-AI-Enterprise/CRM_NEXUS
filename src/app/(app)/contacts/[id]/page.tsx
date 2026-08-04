import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, History, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { getContactDetail } from "@/lib/data/contacts";
import { ContactProfileCard } from "@/components/contacts/contact-profile-card";
import { AddNoteForm } from "@/components/contacts/add-note-form";
import { InteractionTimeline } from "@/components/contacts/interaction-timeline";
import { MiniNetworkGraph } from "@/components/graph/mini-network-graph";

type ContactPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return {};

  const contact = await getContactDetail(session.user.id, id);
  return { title: contact ? `${contact.fullName} — Knowledge Graph CRM` : "Контакт — CRM" };
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const contact = await getContactDetail(session.user.id, id);
  if (!contact) {
    notFound();
  }

  // Extract direct connections for MiniNetworkGraph
  const connectedContacts = [
    ...contact.outgoingConnections.map((c) => ({
      id: c.toContact.id,
      fullName: c.toContact.fullName,
      role: c.toContact.role,
      category: c.toContact.category,
      relationship: c.relationship,
      companyName: c.toContact.company?.name || null,
    })),
    ...contact.incomingConnections.map((c) => ({
      id: c.fromContact.id,
      fullName: c.fromContact.fullName,
      role: c.fromContact.role,
      category: c.fromContact.category,
      relationship: c.relationship,
      companyName: c.fromContact.company?.name || null,
    })),
  ];

  // Extract company colleagues
  const colleagues = (contact.company?.contacts || []).map((col) => ({
    id: col.id,
    fullName: col.fullName,
    role: col.role,
    category: col.category as any,
    relationship: "Колега",
  }));

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Header back button */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors bg-zinc-900/60 px-2.5 py-1 rounded-md border border-white/[0.06]"
        >
          <ArrowLeft className="size-3" />
          Назад до мережі
        </Link>
      </div>

      {/* Main Profile Info */}
      <ContactProfileCard contact={contact as any} />

      {/* Mini Network Graph Section */}
      <div className="grid gap-5 lg:grid-cols-2">
        <MiniNetworkGraph
          currentContact={{
            id: contact.id,
            fullName: contact.fullName,
            role: contact.role,
            category: contact.category,
            companyName: contact.company?.name || null,
            usefulnessScore: contact.usefulnessScore,
          }}
          connectedContacts={connectedContacts}
          colleagues={colleagues}
          otherAvailableContacts={contact.otherContacts}
        />

        {/* Add Note Form */}
        <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white uppercase tracking-wider">
            <Plus className="size-3 text-zinc-400" />
            Додати нотатку
          </div>
          <AddNoteForm contactId={contact.id} />
        </div>
      </div>

      {/* Interaction Timeline */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white uppercase tracking-wider">
          <History className="size-3.5 text-zinc-400" />
          Історія взаємодій
        </div>
        <InteractionTimeline interactions={contact.interactions} />
      </div>
    </div>
  );
}
