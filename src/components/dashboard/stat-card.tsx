import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  icon: LucideIcon;
  value: React.ReactNode;
  unit?: string;
  unitClassName?: string;
  children?: React.ReactNode;
}

export function StatCard({ label, icon: Icon, value, unit, unitClassName, children }: StatCardProps) {
  return (
    <div className="rounded-[16px] border border-border bg-card px-[18px] py-[17px] flex flex-col">
      <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium mb-[9px]">
        <span>{label}</span>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex items-baseline gap-[7px]">
        <span className="text-[30px] font-semibold tracking-[-1px] text-foreground tabular-nums leading-none">
          {value}
        </span>
        {unit && <span className={unitClassName ?? "text-[11px] text-muted-foreground"}>{unit}</span>}
      </div>
      {children && <div className="mt-[13px]">{children}</div>}
    </div>
  );
}
