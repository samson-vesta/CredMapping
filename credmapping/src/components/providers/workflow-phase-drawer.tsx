"use client";

import { useMemo } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Button } from "~/components/ui/button";

type WorkflowTimelineItem = {
  id: string;
  phaseName: string;
  status: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  agentName: string | null;
};

type EditableWorkflow = {
  id: string;
  phaseName: string;
  status: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  facilityName: string;
  providerCredentialId: string;
};

const statusOptions = ["Pending", "In Progress", "Blocked", "Completed"];

export function WorkflowPhaseDrawer({
  workflow,
  timeline,
  updateAction,
}: {
  workflow: EditableWorkflow;
  timeline: WorkflowTimelineItem[];
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const timelineByPhase = useMemo(
    () => timeline.filter((item) => item.phaseName === workflow.phaseName),
    [timeline, workflow.phaseName],
  );

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button size="sm" variant="outline">
          Open drawer
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-full sm:max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>{workflow.phaseName}</DrawerTitle>
          <DrawerDescription>
            Edit this workflow phase and review all timeline entries for this phase.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-6 overflow-y-auto px-4 pb-4">
          <section className="rounded-md border p-4">
            <p className="text-muted-foreground text-xs uppercase">Workflow update</p>
            <form action={updateAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="workflowId" type="hidden" value={workflow.id} />
              <input name="providerCredentialId" type="hidden" value={workflow.providerCredentialId} />

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Phase name</span>
                <input
                  className="bg-background h-9 w-full rounded-md border px-3"
                  defaultValue={workflow.phaseName}
                  name="phaseName"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Status</span>
                <select
                  className="bg-background h-9 w-full rounded-md border px-3"
                  defaultValue={workflow.status ?? "Pending"}
                  name="status"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Start date</span>
                <input
                  className="bg-background h-9 w-full rounded-md border px-3"
                  defaultValue={workflow.startDate ?? ""}
                  name="startDate"
                  type="date"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Due date</span>
                <input
                  className="bg-background h-9 w-full rounded-md border px-3"
                  defaultValue={workflow.dueDate ?? ""}
                  name="dueDate"
                  type="date"
                />
              </label>

              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Completed date</span>
                <input
                  className="bg-background h-9 w-full rounded-md border px-3"
                  defaultValue={workflow.completedAt ?? ""}
                  name="completedAt"
                  type="date"
                />
              </label>

              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                  Facility: {workflow.facilityName}
                </p>
                <Button type="submit">Save update</Button>
              </div>
            </form>
          </section>

          <section className="rounded-md border p-4">
            <p className="text-muted-foreground text-xs uppercase">Phase timeline</p>
            {timelineByPhase.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">No timeline entries available.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="py-1 pr-2">status</th>
                      <th className="py-1 pr-2">start</th>
                      <th className="py-1 pr-2">due</th>
                      <th className="py-1 pr-2">completed</th>
                      <th className="py-1 pr-2">owner</th>
                      <th className="py-1">updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineByPhase.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-1 pr-2">{item.status ?? "—"}</td>
                        <td className="py-1 pr-2">{item.startDate ?? "—"}</td>
                        <td className="py-1 pr-2">{item.dueDate ?? "—"}</td>
                        <td className="py-1 pr-2">{item.completedAt ?? "—"}</td>
                        <td className="py-1 pr-2">{item.agentName ?? "Unassigned"}</td>
                        <td className="py-1">{item.updatedAt ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <DrawerClose asChild>
            <Button className="w-full" variant="outline">
              Close
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
