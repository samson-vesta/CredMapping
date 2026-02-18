export default function DashboardPage() {
  return (
    // NOTE: this page is just a placeholder for now, we can add some useful stuff or quick links here later
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard Overview</h1>
      <p className="text-muted-foreground">
        Welcome to CredMapping+. Select a tab from the sidebar to manage your agents or facilities.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Agents</div>
          <div className="text-2xl font-bold">128</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Active Facilities</div>
          <div className="text-2xl font-bold">12</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Pending Workflows</div>
          <div className="text-2xl font-bold">5</div>
        </div>
      </div>
    </div>
  );
}