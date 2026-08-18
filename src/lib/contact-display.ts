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
    hex: "#E9A15F",
    dot: "#E9A15F",
    bg: "rgba(233, 161, 95, 0.1)",
    border: "rgba(233, 161, 95, 0.25)",
    text: "#8A5A1F",
    badgeClass: "bg-card text-foreground border-border",
  },
  INVESTOR: {
    hex: "#43A883",
    dot: "#43A883",
    bg: "rgba(67, 168, 131, 0.1)",
    border: "rgba(67, 168, 131, 0.25)",
    text: "#1F6349",
    badgeClass: "bg-card text-foreground border-border",
  },
  LEAD: {
    hex: "#5B8DEF",
    dot: "#5B8DEF",
    bg: "rgba(91, 141, 239, 0.1)",
    border: "rgba(91, 141, 239, 0.25)",
    text: "#254B8C",
    badgeClass: "bg-card text-foreground border-border",
  },
  COLLEAGUE: {
    hex: "#6E7480",
    dot: "#6E7480",
    bg: "rgba(110, 116, 128, 0.1)",
    border: "rgba(110, 116, 128, 0.25)",
    text: "#3A3C42",
    badgeClass: "bg-card text-foreground border-border",
  },
  FRIEND: {
    hex: "#EF8163",
    dot: "#EF8163",
    bg: "rgba(239, 129, 99, 0.1)",
    border: "rgba(239, 129, 99, 0.25)",
    text: "#8A3A22",
    badgeClass: "bg-card text-foreground border-border",
  },
  HR: {
    hex: "#9B7BE0",
    dot: "#9B7BE0",
    bg: "rgba(155, 123, 224, 0.1)",
    border: "rgba(155, 123, 224, 0.25)",
    text: "#4E3487",
    badgeClass: "bg-card text-foreground border-border",
  },
  OTHER: {
    hex: "#9A9A94",
    dot: "#9A9A94",
    bg: "rgba(154, 154, 148, 0.1)",
    border: "rgba(154, 154, 148, 0.25)",
    text: "#5C5F66",
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
  MEETING: "Meeting",
  CALL: "Call",
  INTRO: "Intro",
  EMAIL: "Email",
  WORKSHOP: "Workshop",
  MEMO: "Memo",
};

export const INTERACTION_KIND_STYLE: Record<InteractionType, { color: string; tint: string }> = {
  MEETING: { color: "#7C9CF0", tint: "#EDF2FD" },
  CALL: { color: "#5FB79A", tint: "#EBF7F2" },
  INTRO: { color: "#E9A15F", tint: "#FDF3E8" },
  EMAIL: { color: "#A98BE3", tint: "#F3EDFC" },
  WORKSHOP: { color: "#E58AA6", tint: "#FCEDF2" },
  MEMO: { color: "#8C93A3", tint: "#F1F2F5" },
};

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/// Contact channel fields accept a bare handle/number ("andriy_k",
/// "+380501234567"), a schemeless domain ("linkedin.com/in/andriy" — how
/// people usually paste these), or a full URL — normalize all three into an
/// openable link. Checking the domain before falling back to "bare handle"
/// matters: without it, a schemeless domain gets the handle-prefix
/// prepended too, doubling the path (e.g. ".../in/linkedin.com/in/andriy").
function toChannelUrl(value: string, domainPattern: RegExp, handlePrefix: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (domainPattern.test(trimmed)) return `https://${trimmed.replace(/^www\./i, "")}`;
  return `${handlePrefix}${trimmed.replace(/^@/, "")}`;
}

export function linkedinUrl(value: string): string {
  return toChannelUrl(value, /^(www\.)?linkedin\.com/i, "https://linkedin.com/in/");
}

export function telegramUrl(value: string): string {
  return toChannelUrl(value, /^(www\.)?t\.me/i, "https://t.me/");
}

export function instagramUrl(value: string): string {
  return toChannelUrl(value, /^(www\.)?instagram\.com/i, "https://instagram.com/");
}

export function whatsappUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.)?wa\.me/i.test(trimmed)) return `https://${trimmed.replace(/^www\./i, "")}`;
  return `https://wa.me/${trimmed.replace(/[^\d]/g, "")}`;
}
