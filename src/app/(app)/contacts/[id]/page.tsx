import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, History, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { getContactDetail } from "@/lib/data/contacts";
import { listCompanies } from "@/lib/data/companies";
import { listCommunities } from "@/lib/data/communities";
import { getServerTranslation } from "@/lib/i18n/server";
import { ContactHeader } from "@/components/contacts/contact-header";
import { ContactInsightsPanel } from "@/components/contacts/contact-insights-panel";
import { AddNoteForm } from "@/components/contacts/add-note-form";
import { InteractionTimeline } from "@/components/contacts/interaction-timeline";
import { MiniNetworkGraph } from "@/components/graph/mini-network-graph";
import type { ContactCategory } from "@/generated/prisma/enums";

type ContactPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return {};

  const contact = await getContactDetail(session.user.id, id);
  return { title: contact ? `${contact.fullName} — Knowledge Graph CRM` : "Contact — CRM" };
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [contact, companies, communities, { t }] = await Promise.all([
    getContactDetail(session.user.id, id),
    listCompanies(session.user.id),
    listCommunities(session.user.id),
    getServerTranslation(),
  ]);
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
    category: col.category as ContactCategory,
    relationship: t("relationship.colleague"),
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
          {t("contact.backToNetwork")}
        </Link>
      </div>

      {/* Identity header — who this contact is, always visible first */}
      <ContactHeader contact={contact} companies={companies} communities={communities} />

      {/* Add Note + Interaction Chain — the primary "what's happening with this
          person" view, placed immediately after identity so it's reachable
          without scrolling past secondary content on phones. */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white uppercase tracking-wider">
          <Plus className="size-3 text-zinc-400" />
          {t("addNote.newNoteTitle")}
        </div>
        <AddNoteForm contactId={contact.id} />
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white uppercase tracking-wider">
          <History className="size-3.5 text-zinc-400" />
          {t("timeline.title")}
        </div>
        <InteractionTimeline interactions={contact.interactions} />
      </div>

      {/* Secondary: profile insights, connections, and the mini graph */}
      <ContactInsightsPanel contact={contact} />

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
      </div>
    </div>
  );
}
