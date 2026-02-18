import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const relatedTypeEnum = pgEnum("facility_or_provider", ["facility", "provider"]);
export const initialOrRenewalEnum = pgEnum("initial_or_renewal", ["initial", "renewal"]);
export const agentRoleEnum = pgEnum("agent_role", ["user", "admin", "superadmin"]);
export const teamEnum = pgEnum("team_enum", ["IN", "US"]);

const isAdminOrSuperAdmin = sql`exists (
  select 1
  from public.agents a
  where lower(a.email) = lower((auth.jwt() ->> 'email'))
    and a.role in ('admin', 'superadmin')
)`;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  team: teamEnum("team").notNull(),
  teamNumber: integer("team_number"),
  role: agentRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tableName: text("table_name").notNull(),
    recordId: uuid("record_id"),

    action: text("action").notNull(),

    actorId: uuid("actor_id").references(() => agents.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    oldData: jsonb("old_data").default(sql`'{}'::jsonb`),
    newData: jsonb("new_data").default(sql`'{}'::jsonb`),
  },
);

export const facilities = pgTable("facilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  state: text("state"),
  proxy: text("proxy"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  email: text("email"),
  address: text("address"),
});

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  middleName: text("middle_name"),
  degree: text("degree"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  notes: text("notes"),
});

export const workflowPhases = pgTable("workflow_phases", {
  id: uuid("id").defaultRandom().primaryKey(),
  phaseNum: bigint("phase_num", { mode: "number" }).notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").default("Pending"),
  completedAt: date("completed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const commLogs = pgTable(
  "comm_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    relatedType: relatedTypeEnum("related_type"),
    relatedId: uuid("related_id"),
    kind: text("kind"),
    subject: text("subject"),
    status: text("status"),
    requestedAt: date("requested_at"),
    lastFollowupAt: date("last_followup_at"),
    nextFollowupAt: date("next_followup_at"),
    receivedAt: date("received_at"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => agents.id),
    lastUpdatedBy: uuid("last_updated_by").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    zohoTicketId: text("zoho_ticket_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  });

export const configEnums = pgTable("config_enums", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const facilityContacts = pgTable("facility_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  facilityId: uuid("facility_id")
    .notNull()
    .references(() => facilities.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const incidentLogs = pgTable("incident_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: text("category"),
  criticality: text("criticality"),
  reportedBy: text("reported_by"),
  responsibleOwner: text("responsible_owner"),
  occurredAt: date("occurred_at"),
  escalatedTo: text("escalated_to"),
  immediateAction: text("immediate_action"),
  finalResolution: text("final_resolution"),
  rootCauseFlag: boolean("root_cause_flag"),
  rootCauseSummary: text("root_cause_summary"),
  preventiveActions: text("preventive_actions"),
  followupNeeded: boolean("followup_needed"),
  followupDate: date("followup_date"),
  notes: text("notes"),
  relatedType: text("related_type"),
  relatedId: uuid("related_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const providerFacilityCredentials = pgTable("provider_facility_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id),
  facilityId: uuid("facility_id").references(() => facilities.id),
  priority: text("priority"),
  status: text("status"),
  privileges: text("privileges"),
  requestedAt: date("requested_at"),
  submittedAt: date("submitted_at"),
  completedAt: date("completed_at"),
  decision: text("decision"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const pfcWorkflows = pgTable("pfc_workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  pfcId: uuid("pfc_id").references(() => providerFacilityCredentials.id),
  facilityType: text("facility_type"),
  status: text("status"),
  privileges: text("privileges"),
  dueDate: date("due_date"),
  startedAt: date("started_at"),
  sentForReviewAt: date("sent_for_review_at"),
  reviewerFirst: text("reviewer_first"),
  reviewerSecond: text("reviewer_second"),
  reviewerFinal: text("reviewer_final"),
  nonCriticalErrors: integer("non_critical_errors"),
  criticalErrors: integer("critical_errors"),
  submittedAt: date("submitted_at"),
  decisionDate: date("decision_date"),
  decision: text("decision"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  applicationRequired: boolean("application_required"),
  activePhaseId: uuid("active_phase_id").references(() => workflowPhases.id),
});

export const prelivePipeline = pgTable("prelive_pipeline", {
  id: uuid("id").defaultRandom().primaryKey(),
  facilityId: uuid("facility_id").references(() => facilities.id),
  priority: text("priority"),
  goLiveDate: date("go_live_date"),
  boardMeetingDate: date("board_meeting_date"),
  tempsPossible: boolean("temps_possible"),
  rolesNeeded: jsonb("roles_needed"),
  payorEnrollmentRequired: boolean("payor_enrollment_required"),
  yearlyVolume: bigint("yearly_volume", { mode: "number" }),
  modalities: text("modalities").array(),
  tatSla: text("tat_sla"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  credentialingDueDate: date("credentialing_due_date"),
  activePhaseId: uuid("active_phase_id").references(() => workflowPhases.id),
});

export const providerVestaPrivileges = pgTable("provider_vesta_privileges", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id),
  privilegeTier: text("privilege_tier"),
  tempApprovedAt: date("temp_approved_at"),
  tempExpiresAt: date("temp_expires_at"),
  initialApprovedAt: date("initial_approved_at"),
  initialExpiresAt: date("initial_expires_at"),
  termDate: date("term_date"),
  termReason: text("term_reason"),
  pastPrivileges: jsonb("past_privileges"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const stateLicenseWorkflows = pgTable("state_license_workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id),
  state: text("state"),
  path: text("path"),
  priority: text("priority"),
  initialOrRenewal: initialOrRenewalEnum("initial_or_renewal"),
  requestedAt: date("requested_at"),
  submittedAt: date("submitted_at"),
  approvedAt: date("approved_at"),
  agentAssigned: uuid("agent_assigned").references(() => agents.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  activePhaseId: uuid("active_phase_id").references(() => workflowPhases.id),
});

export const stateLicenses = pgTable("state_licenses", {
  id: uuid("id").primaryKey().notNull(),
  providerId: uuid("provider_id").references(() => providers.id),
  state: text("state"),
  status: text("status"),
  issuedAt: date("issued_at"),
  expiresAt: date("expires_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  renewalDate: date("renewal_date"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  number: text("number"),
});

export const teamAndAgentTasks = pgTable("team_and_agent_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  relatedType: text("related_type"),
  relatedId: uuid("related_id"),
  title: text("title"),
  description: text("description"),
  priority: text("priority"),
  dueAt: date("due_at"),
  status: text("status"),
  ownerUser: text("owner_user"),
  ownerTeam: text("owner_team"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const nowSql = sql`now()`;

// export const commLogsSelectAdmin = pgPolicy("comm_logs_admin_all", {
//   for: "all",
//   to: authenticatedRole,
//   using: isAdminOrSuperAdmin,
// }).link(commLogs);



const isAgent = sql`
  EXISTS (
    SELECT 1
    FROM agents a
    WHERE a.user_id = auth.uid()
  )
`;



//agentsPolicy
export const agentsPolicy = pgPolicy("agents_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(agents);

//audit_log policy
export const auditLogPolicy = pgPolicy("audit_log_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(auditLog);

//comm_logs policy: 
export const commLogsPolicy = pgPolicy("comm_logs_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(commLogs);

//config_enums policy
export const configEnumsPolicy = pgPolicy("config_enums_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(configEnums);

//facilities policy
export const facilitiesPolicy = pgPolicy("facilities_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(facilities);

//facility_contacts policy
export const facilityContactsPolicy = pgPolicy("facility_contacts_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(facilityContacts);

//incident_logs policy
export const incidentLogsPolicy = pgPolicy("incident_logs_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(incidentLogs);

//pfc_workflows policy
export const pfcWorkflowsPolicy = pgPolicy("pfc_workflows_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(pfcWorkflows);

//prelive_pipeline policy
export const prelivePipelinePolicy = pgPolicy("prelive_pipeline_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(prelivePipeline);

//provider_facility_credentials policy
export const providerFacilityCredentialsPolicy = pgPolicy("provider_facility_credentials_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(providerFacilityCredentials);

//provider_vesta_privileges policy
export const providerVestaPrivilegesPolicy = pgPolicy("provider_vesta_privileges_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(providerVestaPrivileges);

//providers policy
export const providersPolicy = pgPolicy("providers_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(providers);

//state_license_workflows policy
export const stateLicenseWorkflowsPolicy = pgPolicy("state_license_workflows_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(stateLicenseWorkflows);

//state_licenses policy
export const stateLicensesPolicy = pgPolicy("state_licenses_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(stateLicenses);

//team_and_agent_tasks policy
export const teamAndAgentTasksPolicy = pgPolicy("team_and_agent_tasks_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(teamAndAgentTasks);

//workflow_phases policy
export const workflowPhasesPolicy = pgPolicy("workflow_phases_agent_access", {
  for: "all",
  to: authenticatedRole,
  using: isAgent,
}).link(workflowPhases);





