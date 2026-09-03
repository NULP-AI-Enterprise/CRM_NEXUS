"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";

// Shared chrome for the People / Companies / Communities list screens, lifted
// verbatim from the reference template so all three read as one family:
//   ListHeader  — tinted glyph tile + title/subtitle + primary action
//   FilterBar   — the white rounded search/filter rail
//   SearchField — tinted search input with the magnifier glyph
//   FilterSelect— warm-grey pill <select>
//   FilterMeta  — "N results" + Reset, divided by a hairline
//   ListEmpty   — dashed empty-state card

export function ListHeader({
  icon,
  tint,
  title,
  count,
  subtitle,
  action,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  count?: number;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className="flex size-[30px] flex-none items-center justify-center rounded-[10px]"
          style={{ background: tint }}
        >
          {icon}
        </div>
        <div>
          <h1 className="font-heading text-[22px] font-semibold tracking-[-0.4px] text-foreground">
            {title}
            {count != null && <span className="ml-1.5 font-normal text-[#a6a6a0]">{count}</span>}
          </h1>
          {subtitle && <div className="mt-0.5 text-[11.5px] text-[#8c8c86]">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function AddButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-[10px] bg-[#1b1d21] px-[15px] py-[9px] text-[12.5px] font-semibold text-white transition-colors hover:bg-[#33363d] ${
        disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center gap-[9px] rounded-[14px] border border-[#ecebe7] bg-card px-[13px] py-[11px]"
      style={{ boxShadow: "0 1px 2px rgba(27,29,33,.03)" }}
    >
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex min-w-0 w-full flex-1 basis-[160px] items-center gap-2 rounded-[9px] border border-[#edece8] bg-[#f7f7f4] px-[11px] py-[7px]">
      <svg width="13" height="13" viewBox="0 0 13 13" className="flex-none">
        <circle cx="5.5" cy="5.5" r="4" fill="none" stroke="#9A9A94" strokeWidth="1.4" />
        <line x1="8.6" y1="8.6" x2="12" y2="12" stroke="#9A9A94" strokeWidth="1.4" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-none bg-transparent text-[12.5px] text-[#1b1d21] outline-none placeholder:text-[#a6a6a0]"
      />
    </div>
  );
}

export function FilterSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="cursor-pointer rounded-[9px] border border-[#edece8] bg-[#f7f7f4] px-[9px] py-[7px] text-[12px] text-[#3a3c42] outline-none"
    />
  );
}

export function FilterMeta({
  resultLabel,
  isFiltered,
  onReset,
  resetLabel,
}: {
  resultLabel: string;
  isFiltered: boolean;
  onReset: () => void;
  resetLabel: string;
}) {
  return (
    <div className="ml-auto flex items-center gap-[7px] border-l border-[#efeeea] pl-2 pr-1">
      <span className="text-[11px] text-[#8c8c86]">{resultLabel}</span>
      {isFiltered && (
        <button onClick={onReset} className="text-[11px] font-semibold text-[#5b8def] hover:underline">
          {resetLabel}
        </button>
      )}
    </div>
  );
}

export function ListEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-dashed border-[#deddd7] bg-card px-5 py-14 text-center text-[12.5px] text-[#8c8c86]">
      {children}
    </div>
  );
}

// ── Entity glyphs (16px) reused for list headers, matching the sidebar set ──
export const EntityGlyph = {
  people: (color = "#EF8163") => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.6" r="2.9" stroke={color} strokeWidth="1.5" />
      <path d="M2.6 14.2c0-3.2 2.4-5 5.4-5s5.4 1.8 5.4 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  companies: (color = "#43A883") => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.8 14.2V3.2h6.4v11" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.2 14.2V6.6h4v7.6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4.9 5.9h2.2M4.9 8.5h2.2M4.9 11.1h2.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  communities: (color = "#9B7BE0") => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.2" cy="6.1" r="2.1" stroke={color} strokeWidth="1.5" />
      <circle cx="10.8" cy="6.1" r="2.1" stroke={color} strokeWidth="1.5" />
      <circle cx="8" cy="11.2" r="2.3" stroke={color} strokeWidth="1.5" />
    </svg>
  ),
};

/** Category tints used for the list-header glyph tiles. */
export const HEADER_TINT = {
  people: "#fdede7",
  companies: "#e8f6f0",
  communities: "#f1ebfc",
} as const;
