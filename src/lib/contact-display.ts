import { ContactCategory, InteractionType } from "@/generated/prisma/enums";

export const CATEGORY_LABELS: Record<ContactCategory, string> = {
  VIP: "VIP",
  HR: "HR",
  INVESTOR: "Інвестор",
  LEAD: "Лід",
  COLLEAGUE: "Колега",
  FRIEND: "Друг",
  OTHER: "Інше",
};

export const CATEGORY_COLORS: Record<
  ContactCategory,
  {
    hex: string;
    dot: string;
    bg: string;
    border: string;
    text: string;
    badgeClass: string;
  }
> = {
  VIP: {
    hex: "#B8862E",
    dot: "#B8862E",
    bg: "rgba(184, 134, 46, 0.1)",
    border: "rgba(184, 134, 46, 0.25)",
    text: "#8C6620",
    badgeClass: "bg-card text-foreground border-border",
  },
  INVESTOR: {
    hex: "#6B8F5C",
    dot: "#6B8F5C",
    bg: "rgba(107, 143, 92, 0.1)",
    border: "rgba(107, 143, 92, 0.25)",
    text: "#4F6B43",
    badgeClass: "bg-card text-foreground border-border",
  },
  LEAD: {
    hex: "#5E7A8C",
    dot: "#5E7A8C",
    bg: "rgba(94, 122, 140, 0.1)",
    border: "rgba(94, 122, 140, 0.25)",
    text: "#465C6B",
    badgeClass: "bg-card text-foreground border-border",
  },
  COLLEAGUE: {
    hex: "#8C7A5E",
    dot: "#8C7A5E",
    bg: "rgba(140, 122, 94, 0.1)",
    border: "rgba(140, 122, 94, 0.25)",
    text: "#6B5C45",
    badgeClass: "bg-card text-foreground border-border",
  },
  FRIEND: {
    hex: "#B06A5A",
    dot: "#B06A5A",
    bg: "rgba(176, 106, 90, 0.1)",
    border: "rgba(176, 106, 90, 0.25)",
    text: "#8A4F42",
    badgeClass: "bg-card text-foreground border-border",
  },
  HR: {
    hex: "#8B6B8F",
    dot: "#8B6B8F",
    bg: "rgba(139, 107, 143, 0.1)",
    border: "rgba(139, 107, 143, 0.25)",
    text: "#6B4F6F",
    badgeClass: "bg-card text-foreground border-border",
  },
  OTHER: {
    hex: "#8A8175",
    dot: "#8A8175",
    bg: "rgba(138, 129, 117, 0.1)",
    border: "rgba(138, 129, 117, 0.25)",
    text: "#6B6356",
    badgeClass: "bg-card text-foreground border-border",
  },
};

/// Dictionary keys (see src/lib/i18n/dictionary.ts) for the relationship-type
/// preset buttons in AddConnectionDialog. Resolve with t(key) for display;
/// the *translated* text is what gets stored as Connection.relationship, so
/// existing rows stay plain human-readable strings in whichever language
/// they were created in.
export const RELATIONSHIP_PRESET_KEYS = [
  "relationship.colleague",
  "relationship.partner",
  "relationship.investor",
  "relationship.cofounder",
  "relationship.referral",
  "relationship.client",
  "relationship.advisor",
  "relationship.friend",
  "relationship.contractor",
  "relationship.jointProject",
] as const;

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  CALL: "Дзвінок",
  MEET: "Зустріч",
  ZOOM: "Zoom",
  OFFLINE: "Офлайн",
  NOTE: "Нотатка",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
