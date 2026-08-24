interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Muted meta shown to the right of the value (e.g. "across 5 types"). */
  unit?: string;
  unitClassName?: string;
  /** Accent delta shown next to the value (e.g. green "+7 this month"). */
  delta?: React.ReactNode;
  /** Colour class for the delta — defaults to the green accent. */
  deltaClassName?: string;
  /** Optional pill rendered at the top-right of the label row. */
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

// Reference stat card: white surface, 16px radius, hairline border, whisper
// shadow. Label is plain sans (#8c8c86), the value is a tight 30px numeral.
export function StatCard({ label, value, unit, unitClassName, delta, deltaClassName, badge, children }: StatCardProps) {
  return (
    <div className="rounded-[16px] border border-border bg-card px-[18px] py-[17px] flex flex-col">
      <div className="mb-[9px] flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium text-[#8c8c86]">{label}</span>
        {badge}
      </div>
      <div className="flex items-baseline gap-[7px]">
        <span className="text-[30px] font-semibold leading-none tracking-[-1px] text-foreground tabular-nums">
          {value}
        </span>
        {delta && <span className={`text-[11px] font-semibold ${deltaClassName ?? "text-[#43a883]"}`}>{delta}</span>}
        {unit && <span className={unitClassName ?? "text-[11px] text-muted-foreground"}>{unit}</span>}
      </div>
      {children && <div className="mt-[13px]">{children}</div>}
    </div>
  );
}
