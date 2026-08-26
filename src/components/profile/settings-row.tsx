import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared container for a group of SettingsRows — rounded card, hairline dividers between rows. */
export const settingsGroupClassName = "mt-4 divide-y divide-line rounded-xl border border-line bg-card";

type SettingsRowProps = {
  icon: LucideIcon;
  label: string;
  /** Pass the paired control's id to render a real `<label>`; omit for a read-only row (renders a `<span>` instead — a `<label>` with no control confuses assistive tech). */
  htmlFor?: string;
  children: ReactNode;
};

/** One label+content row: fixed-width label column with an icon on `sm:` and up, stacked on mobile. */
export function SettingsRow({ icon: Icon, label, htmlFor, children }: SettingsRowProps) {
  const labelContent = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      {label}
    </>
  );

  return (
    <div className="grid gap-1.5 px-4 py-3.5 sm:grid-cols-[152px_1fr] sm:items-center sm:gap-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium text-ink">
          {labelContent}
        </label>
      ) : (
        <span className="flex items-center gap-2 text-sm font-medium text-ink">{labelContent}</span>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
