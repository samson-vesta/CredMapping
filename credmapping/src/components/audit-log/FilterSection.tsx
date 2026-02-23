"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

interface FilterSectionProps {
  timestamp?: string;
  user?: string;
  action?: "all" | "insert" | "update" | "delete";
  tableName?: string;
  recordId?: string;
  dataContent?: string;
  fromDate?: string;
  toDate?: string;
  onTimestampChange?: (value: string) => void;
  onUserChange?: (value: string) => void;
  onActionChange?: (value: "all" | "insert" | "update" | "delete") => void;
  onTableNameChange?: (value: string) => void;
  onRecordIdChange?: (value: string) => void;
  onDataContentChange?: (value: string) => void;
  onFromDateChange?: (value: string) => void;
  onToDateChange?: (value: string) => void;
  onClearAll?: () => void;
  onLoad?: () => void;
  isLoading?: boolean;
}

export function FilterSection({
  timestamp,
  user,
  action = "all",
  tableName,
  recordId,
  dataContent,
  fromDate,
  toDate,
  onTimestampChange,
  onUserChange,
  onActionChange,
  onTableNameChange,
  onRecordIdChange,
  onDataContentChange,
  onFromDateChange,
  onToDateChange,
  onClearAll,
  onLoad,
  isLoading = false,
}: FilterSectionProps) {
  return (
    <Card className="mb-6">
      <div className="space-y-4 p-6">
      
        <div className="grid grid-cols-3 gap-4">
      
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Timestamp
            </label>
            <Input
              placeholder="Search by date/time..."
              value={timestamp ?? ""}
              onChange={(e) => onTimestampChange?.(e.target.value)}
            />
          </div>

   
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">User</label>
            <Input
              placeholder="Search by user email..."
              value={user ?? ""}
              onChange={(e) => onUserChange?.(e.target.value)}
            />
          </div>

        
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Action
            </label>
            <Select
              value={action}
              onValueChange={(value) =>
                onActionChange?.(
                  value as "all" | "insert" | "update" | "delete"
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="insert">Insert</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

     
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Table
            </label>
            <Select
              value={tableName ?? "all"}
              onValueChange={(value) =>
                onTableNameChange?.(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                <SelectItem value="facilities">facilities</SelectItem>
                <SelectItem value="providers">providers</SelectItem>
                <SelectItem value="comm_logs">comm_logs</SelectItem>
                <SelectItem value="certifications">certifications</SelectItem>
                <SelectItem value="doctor_facility_assignments">
                  doctor_facility_assignments
                </SelectItem>
                <SelectItem value="agents">agents</SelectItem>
              </SelectContent>
            </Select>
          </div>

      
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Record ID
            </label>
            <Input
              placeholder="Search by record ID..."
              value={recordId ?? ""}
              onChange={(e) => onRecordIdChange?.(e.target.value)}
            />
          </div>

 
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Data Content
            </label>
            <Input
              placeholder="Search within data content..."
              value={dataContent ?? ""}
              onChange={(e) => onDataContentChange?.(e.target.value)}
            />
          </div>
        </div>

       
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">From:</label>
            <Input
              type="date"
              value={fromDate ?? ""}
              onChange={(e) => onFromDateChange?.(e.target.value)}
              className="max-w-[160px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">To:</label>
            <Input
              type="date"
              value={toDate ?? ""}
              onChange={(e) => onToDateChange?.(e.target.value)}
              className="max-w-[160px]"
            />
          </div>

          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              disabled={isLoading}
            >
              Clear All Filters
            </Button>
            <Button
              size="sm"
              onClick={onLoad}
              disabled={isLoading}
              className="bg-primary text-primary-foreground"
            >
              {isLoading ? "Loading..." : "Load"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
