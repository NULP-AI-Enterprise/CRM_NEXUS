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
    hex: "#D97706",
    dot: "#F59E0B",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.2)",
    text: "#FCD34D",
    badgeClass: "bg-zinc-900 text-zinc-300 border-zinc-800",
  },
  INVESTOR: {
    hex: "#059669",
    dot: "#10B981",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.2)",
    text: "#6EE7B7",
    badgeClass: "bg-zinc-900 text-zinc-300 border-zinc-800",
  },
  LEAD: {
    hex: "#0284C7",
    dot: "#38BDF8",
    bg: "rgba(56, 189, 248, 0.08)",
    border: "rgba(56, 189, 248, 0.2)",
    text: "#7DD3FC",
    badgeClass: "bg-zinc-900 text-zinc-300 border-zinc-800",
  },
  COLLEAGUE: {
    hex: "#4F46E5",
    dot: "#818CF8",
    bg: "rgba(129, 140, 248, 0.08)",
    border: "rgba(129, 140, 248, 0.2)",
    text: "#C7D2FE",
    badgeClass: "bg-zinc-900 text-zinc-300 border-zinc-800",
  },
  FRIEND: {
    hex: "#E11D48",
    dot: "#FB7185",
    bg: "rgba(251, 113, 133, 0.08)",
    border: "rgba(251, 113, 133, 0.2)",
    text: "#FECDD3",
    badgeClass: "bg-zinc-900 text-zinc-300 border-zinc-800",
  },
  HR: {
    hex: "#9333EA",
    dot: "#C084FC",
    bg: "rgba(192, 132, 252, 0.08)",
    border: "rgba(192, 132, 252, 0.2)",
    text: "#E9D5FF",
    badgeClass: "bg-zinc-900 text-zinc-300 border-zinc-800",
  },
  OTHER: {
    hex: "#71717A",
    dot: "#A1A1AA",
    bg: "rgba(161, 161, 170, 0.08)",
    border: "rgba(161, 161, 170, 0.2)",
    text: "#E4E4E7",
    badgeClass: "bg-zinc-900 text-zinc-300 border-zinc-800",
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
