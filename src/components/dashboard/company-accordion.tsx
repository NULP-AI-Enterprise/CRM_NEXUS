import { Building2, Users } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ContactCard } from "@/components/dashboard/contact-card";
import type { CompanyModel, ContactModel } from "@/generated/prisma/models";

type CompanyWithContacts = CompanyModel & { contacts: ContactModel[] };

const UNASSIGNED_VALUE = "__unassigned";

export function CompanyAccordion({
  companies,
  unassignedContacts,
}: {
  companies: CompanyWithContacts[];
  unassignedContacts: ContactModel[];
}) {
  if (companies.length === 0 && unassignedContacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/40 p-10 text-center text-xs text-zinc-400">
        <Building2 className="mx-auto size-6 text-zinc-600 mb-2" />
        Немає збережених контактів. Додайте перший запис у полі вище.
      </div>
    );
  }

  const defaultValue = [
    ...companies.map((company) => company.id),
    ...(unassignedContacts.length > 0 ? [UNASSIGNED_VALUE] : []),
  ];

  return (
    <Accordion defaultValue={defaultValue} className="space-y-2">
      {companies.map((company) => (
        <AccordionItem
          key={company.id}
          value={company.id}
          className="rounded-xl border border-white/[0.07] bg-zinc-900/30 px-4 transition-colors hover:border-white/[0.12]"
        >
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex flex-wrap items-center gap-2 text-left">
              <div className="flex size-6 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                <Building2 className="size-3.5" />
              </div>
              <span className="font-medium text-white text-xs tracking-tight">{company.name}</span>
              {company.industry && (
                <span className="text-[11px] text-zinc-500 font-normal">({company.industry})</span>
              )}
              <span className="ml-1 inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                <Users className="size-2.5 text-zinc-500" />
                {company.contacts.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3.5 pt-0.5">
            <div className="grid gap-2 sm:grid-cols-2">
              {company.contacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}

      {unassignedContacts.length > 0 && (
        <AccordionItem
          value={UNASSIGNED_VALUE}
          className="rounded-xl border border-white/[0.07] bg-zinc-900/30 px-4 transition-colors hover:border-white/[0.12]"
        >
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2 text-left">
              <div className="flex size-6 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                <Users className="size-3.5" />
              </div>
              <span className="font-medium text-zinc-300 text-xs">Без компанії</span>
              <span className="rounded-md border border-white/[0.06] bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                {unassignedContacts.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3.5 pt-0.5">
            <div className="grid gap-2 sm:grid-cols-2">
              {unassignedContacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
}
