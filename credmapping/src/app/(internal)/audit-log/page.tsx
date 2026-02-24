import { AuditLogClient } from "~/components/audit-log/AuditLogClient";

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Track and search all system changes and user activities
        </p>
      </div>

      <AuditLogClient />
    </div>
  );
}
