import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { History, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { getContactDetail } from "@/lib/data/contacts";
import { listCompanies } from "@/lib/data/companies";
import { listCommunities } from "@/lib/data/communities";
import { getServerTranslation } from "@/lib/i18n/server";
import { ContactHeader } from "@/components/contacts/contact-header";
import { ContactInsightsPanel } from "@/components/contacts/contact-insights-panel";
import { ContactProfileBody } from "@/components/contacts/contact-profile-body";
import { AddNoteForm } from "@/components/contacts/add-note-form";
import { TimelineView } from "@/components/timeline/timeline-view";
import { entityKey, type TimelineEvent } from "@/lib/timeline-entity";
import { ContactLocalGraph } from "@/components/graph/contact-local-graph";
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

  const contactEntity = { id: contact.id, fullName: contact.fullName, category: contact.category };
  const timelineEvents: TimelineEvent[] = contact.interactions.map((i) => ({
    id: i.id,
    type: i.type,
    rawText: i.rawText,
    followUp: i.followUp,
    followUpDate: i.followUpDate?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    parentInteractionId: i.parentInteractionId,
    entity: { kind: "contact", contact: contactEntity },
  }));

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11.5px] text-[#8c8c86]">
        <Link href="/contacts" className="font-medium hover:text-foreground transition-colors">
          {t("contact.breadcrumb")}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{contact.fullName}</span>
      </div>

      {/* One unified card: tinted identity header, then a two-column body —
          Fields/Summary/Interactions on the left, Relationships on the right. */}
      <div className="rounded-[18px] border border-border bg-card overflow-hidden">
        <ContactHeader contact={contact} companies={companies} communities={communities} />

        <div className="grid lg:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-5 border-b border-border p-5 lg:border-b-0 lg:border-r">
            <ContactProfileBody contact={contact} />

            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
                <Plus className="size-3 text-muted-foreground" />
                {t("addNote.newNoteTitle")}
              </div>
              <AddNoteForm contactId={contact.id} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
                <History className="size-3.5 text-muted-foreground" />
                {t("timeline.title")}
              </div>
              <TimelineView
                events={timelineEvents}
                onlyEntityKey={entityKey({ kind: "contact", contact: contactEntity })}
                showRangeControl={false}
              />
            </div>
          </div>

          <div className="p-5">
            <ContactInsightsPanel contact={contact} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ContactLocalGraph
          currentContact={{
            id: contact.id,
            fullName: contact.fullName,
            role: contact.role,
            category: contact.category,
            companyName: contact.company?.name || null,
          }}
          connectedContacts={connectedContacts}
          colleagues={colleagues}
          otherAvailableContacts={contact.otherContacts}
        />
      </div>
    </div>
  );
}
