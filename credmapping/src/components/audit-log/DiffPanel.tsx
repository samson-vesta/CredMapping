"use client";

import { cn } from "~/lib/utils";

interface DiffPanelProps {
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  action: "insert" | "update" | "delete";
}

interface FieldDiff {
  key: string;
  oldVal: unknown;
  newVal: unknown;
  changed: boolean;
}

function getAllFields(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined
): FieldDiff[] {
  const old = oldData ?? {};
  const new_ = newData ?? {};
  const allKeys = Array.from(
    new Set([...Object.keys(old), ...Object.keys(new_)])
  );

  const fields = allKeys.map((key) => ({
    key,
    oldVal: key in old ? old[key] : undefined,
    newVal: key in new_ ? new_[key] : undefined,
    changed: JSON.stringify(old[key]) !== JSON.stringify(new_[key]),
  }));

  return fields.sort((a, b) => {
    if (a.changed && !b.changed) return -1;
    if (!a.changed && b.changed) return 1;
    return 0;
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export function DiffPanel({ oldData, newData, action }: DiffPanelProps) {
  const fields = getAllFields(oldData, newData);

  if (fields.length === 0) {
    return (
      <div className="border-t border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        No changes recorded
      </div>
    );
  }

  if (action === "insert") {
    return (
      <div className="border-t border-border bg-muted/30">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-400"></div>
            <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              New Record
            </h4>
          </div>
          <span className="text-xs text-muted-foreground/60 font-mono">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="p-4">
          <div className="space-y-0">
            {fields.map((field, index) => (
              <div key={field.key} className={cn(
                "flex border-b border-border/30 last:border-0",
                index % 2 === 0 ? "bg-transparent" : "bg-muted/10"
              )}>
         
                <div className="min-w-[140px] border-r border-border/50 bg-muted/20 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  {field.key}:
                </div>
           
                <div className="flex-1 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  <span className="italic opacity-50">null</span>
                </div>
  
                <div className="px-2 py-1.5 text-xs text-muted-foreground/30">→</div>
     
                <div className="flex-1 px-3 py-1.5 font-mono text-xs text-green-400">
                  {formatValue(field.newVal) !== "" ? (
                    formatValue(field.newVal)
                  ) : (
                    <span className="italic opacity-50">null</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (action === "delete") {
    return (
      <div className="border-t border-border bg-muted/30">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-destructive"></div>
            <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deleted Record
            </h4>
          </div>
          <span className="text-xs text-muted-foreground/60 font-mono">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-0 p-4">
          {fields.map((field, index) => (
            <div key={field.key} className={cn(
              "flex border-b border-border/30 last:border-0",
              index % 2 === 0 ? "bg-transparent" : "bg-muted/10"
            )}>
     
              <div className="min-w-[140px] border-r border-border/50 bg-muted/20 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                {field.key}:
              </div>
           
              <div className="flex-1 px-3 py-1.5 font-mono text-xs text-destructive">
                {formatValue(field.oldVal) !== "" ? (
                  formatValue(field.oldVal)
                ) : (
                  <span className="italic opacity-50">null</span>
                )}
              </div>
           
              <div className="px-2 py-1.5 text-xs text-muted-foreground/30">→</div>
          
              <div className="flex-1 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <span className="italic opacity-50">null</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // UPDATE action - show all fields with highlighting for changes
  const changedCount = fields.filter((f) => f.changed).length;

  return (
    <div className="border-t border-border bg-muted/30">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-yellow-400"></div>
          <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Field Changes
          </h4>
        </div>
        <span className="text-xs text-muted-foreground/60 font-mono">{changedCount} field{changedCount !== 1 ? 's' : ''} changed</span>
      </div>
      <div className="space-y-0 p-4">
        {fields.map((field, index) => {
          const formattedOld = formatValue(field.oldVal);
          const formattedNew = formatValue(field.newVal);

          return (
            <div key={field.key} className={cn(
              "flex border-b border-border/30 last:border-0",
              index % 2 === 0 ? "bg-transparent" : "bg-muted/10"
            )}>
       
              <div className="min-w-[140px] border-r border-border/50 bg-muted/20 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                {field.key}:
              </div>
      
              <div
                className={cn(
                  "flex-1 px-3 py-1.5 font-mono text-xs",
                  field.changed
                    ? "bg-destructive/5 text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {formattedOld !== "" ? (
                  formattedOld
                ) : (
                  <span className="italic opacity-50">null</span>
                )}
              </div>
      
              <div className="px-2 py-1.5 text-xs text-muted-foreground/30">→</div>
         
              <div
                className={cn(
                  "flex-1 px-3 py-1.5 font-mono text-xs",
                  field.changed ? "bg-green-500/5 text-green-400" : "text-muted-foreground"
                )}
              >
                {formattedNew !== "" ? (
                  formattedNew
                ) : (
                  <span className="italic opacity-50">null</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
