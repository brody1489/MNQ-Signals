"use client";

interface WidgetShellProps {
  id: string;
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Class name for the header so Rnd can use it as drag handle */
  dragHandleClassName?: string;
}

export default function WidgetShell({
  id,
  title,
  onRemove,
  children,
  className = "",
  dragHandleClassName = "",
}: WidgetShellProps) {
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm ${className}`}
      data-widget-id={id}
    >
      <div
        className={`flex shrink-0 cursor-grab items-center justify-between border-b border-border bg-card/95 px-3 py-2 active:cursor-grabbing ${dragHandleClassName}`}
      >
        <span className="border-l-2 border-accent pl-2 text-xs font-semibold uppercase tracking-wide text-foreground/90">
          {title}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded p-1.5 text-foreground/50 hover:bg-border hover:text-foreground"
            aria-label="Remove widget"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2.5">{children}</div>
    </div>
  );
}
