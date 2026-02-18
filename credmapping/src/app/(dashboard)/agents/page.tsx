import { Plus, Filter } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function AgentsPage() {
  // NOTE: this page is just a placeholder for now, we can add some useful stuff or quick links here later
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your credentialing agents.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter size={16} />
            Filter
          </Button>
          <Button size="sm" className="gap-2">
            <Plus size={16} />
            Create Agent
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 h-[400px] flex flex-col items-center justify-center text-center p-8">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Plus className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No agents found</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            You haven&apos;t added any agents yet. Start by creating your first one.
          </p>
          <Button size="sm">Add Agent</Button>
        </div>
      </div>
    </div>
  );
}