import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  jsonb,
  pgEnum,
  pgPolicy,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const relatedTypeEnum = pgEnum("facility_or_provider", ["facility", "provider"]);
export const initialOrRenewalEnum = pgEnum("initial_or_renewal", ["initial", "renewal"]);
export const agentRoleEnum = pgEnum("agent_role", ["user", "admin", "superadmin"]);
export const teamEnum = pgEnum("team_location", ["IN", "US"]);
export const privilegeTierEnum = pgEnum("privilege_tier", ["Inactive", "Full", "Temp", "In Progress"]);
export const formSizes = pgEnum("form_size", ["small", "medium", "large", 'x-large', 'online']);
export const workflowType = pgEnum("workflow_type", ["pfc", "state_licenses", "prelive_pipeline", "provider_vesta_privileges"]);
export const facilityStatusEnum = pgEnum("status", ["Active", "Inactive", "In Progress"]);
export const followUpStatus = pgEnum("follow_up_status", ["Completed, Pending Response", "Not Completed"]);
export const psvStatus = pgEnum("psv_status", ["Not Started", "Requested", "Received", "Inactive Rad", "Closed", "Not Affiliated", "Old Request", "Hold"]);
export const psvType = pgEnum("psv_type", ["Education", "Work", "Hospital", "Peer", "COI/Loss Run", "Claims Document", "Board Actions", "Locums/Work", "Vesta Practice Location", "Vesta Hospital", "Work COI", "OPPE"]);

const isAdminOrSuperAdmin = sql`exists (
  select 1
  from public.agents a
  where a.user_id = ((auth.jwt() ->> 'sub')::uuid)
    and a.role in ('admin', 'superadmin')
)`;

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey().notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

const allowAllForAuthenticated = sql`true`;

const createAuthenticatedAllPolicy = (policyName: string) =>
  pgPolicy(policyName, {
    for: "all",
    to: authenticatedRole,
    using: allowAllForAuthenticated,
    withCheck: allowAllForAuthenticated,
  });

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  team: teamEnum("team"),
  teamNumber: bigint("team_num", { mode: "number" }),
  role: agentRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: uuid("record_id"),
  action: text("action").notNull(),
  actorId: uuid("actor_id").references(() => agents.id, { onDelete: "set null" }),
  actorEmail: text("actor_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  oldData: jsonb("old_data").default(sql`'{}'::jsonb`),
  newData: jsonb("new_data").default(sql`'{}'::jsonb`),
});

export const facilities = pgTable("facilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  state: text("state"),
  proxy: text("proxy"),
  status: facilityStatusEnum("status"),
  yearlyVolume: bigint("yearly_volume", { mode: "number" }),
  modalities: text("modalities").array(),
  tatSla: text("tat_sla"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  notes: text("notes"),
});

export const workflowPhases = pgTable("workflow_phases", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentAssigned: uuid("agent_assigned").references(() => agents.id),
  supportingAgents: jsonb("supporting_agents"), 
  workflowType: workflowType("workflow_type").notNull(), 
  relatedId: uuid("related_id").notNull(),  
  status: text("status").default("Pending"),
  phaseName: text("phase_name").notNull(), 
  startDate: date("start_date").notNull(), 
  dueDate: date("due_date"),
  completedAt: date("completed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const missingDocs = pgTable("missing_docs", {
  id: uuid("id").defaultRandom().primaryKey(),
  relatedType: relatedTypeEnum("related_type"),
  relatedId: uuid("related_id"),
  information: text("information"),
  roadblocks: text("roadblocks"), 
  nextFollowUp: date("next_follow_up"),
  lastFollowUp: date("last_follow_up"), 
  followUpStatus: followUpStatus("follow_up_status"),  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const pendingPSV = pgTable("pending_psv", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").notNull().references(() => providers.id), 
  agentAssigned: uuid("agent_assigned").notNull().references(() => agents.id),
  supportingAgents: jsonb("supporting_agents"),
  status: psvStatus("psv_status").notNull(), 
  type: psvType("psv_type").notNull(),
  name: text("name").notNull(),
  dateRequested: date("date_requested").notNull(),
  lastFollowUp: date("last_follow_up"),
  nextFollowUp: date("next_follow_up"), 
  dateReceived: date("date_received"), 
  notes: text("notes"), 
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const commLogs = pgTable("comm_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  relatedType: relatedTypeEnum("related_type"),
  relatedId: uuid("related_id"),
  subject: text("subject"),
  commType: text("comm_type"), 
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => agents.id),
  lastUpdatedBy: uuid("last_updated_by").references(() => agents.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const incidentLogs = pgTable("incident_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowID: uuid("workflow_id").references(() => workflowPhases.id, { onDelete: 'cascade' }).notNull(),
  whoReported: uuid("who_reported").references(() => agents.id).notNull(), 
  staffResponsible: jsonb("staff_responsible"),
  escalatedTo: uuid("escalated_to").references(() => agents.id).notNull(), 
  dateIdentified: date("date_identified").notNull(),
  resolutionDate: date("resolution_date"), 
  subcategory: text("subcategory").notNull(), 
  critical: boolean("critical").notNull(), 
  incidentDescription: text("incident_description"), 
  immediateResolutionAttempt: text("immediate_resolution_attempt"), 
  finalResolution: text("final_resolution"), 
  preventativeActionTaken: text("preventative_action_taken"), 
  followUpRequired: boolean("follow_up_required"),
  followUpDate: date("follow_up_date"), 
  finalNotes: text("final_notes"), 
  discussed: boolean("discussed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const providerFacilityCredentials = pgTable("provider_facility_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id),
  facilityId: uuid("facility_id").references(() => facilities.id),  
  facilityType: text("facility_type"),
  privileges: text("privileges"),
  decision: text("decision"),
  notes: text("notes"),
  priority: text("priority"), 
  formSize: formSizes("form_size"),  
  applicationRequired: boolean("application_required"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const facilityPreliveInfo = pgTable("facility_prelive_info", {
  id: uuid("id").defaultRandom().primaryKey(),
  facilityId: uuid("facility_id").references(() => facilities.id),
  priority: text("priority"),
  goLiveDate: date("go_live_date"),
  boardMeetingDate: date("board_meeting_date"),
  credentialingDueDate: date("credentialing_due_date"),
  tempsPossible: boolean("temps_possible"),
  rolesNeeded: jsonb("roles_needed"),
  payorEnrollmentRequired: boolean("payor_enrollment_required"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const providerVestaPrivileges = pgTable("provider_vesta_privileges", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id),
  privilegeTier: privilegeTierEnum("privilege_tier"),
  currentPrivInitDate: date("current_priv_init_date"), 
  currentPrivEndDate: date("current_priv_exp_date"), 
  termDate: date("term_date"),
  termReason: text("term_reason"),
  pastPrivileges: jsonb("past_privileges"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const providerStateLicenses = pgTable("provider_state_licenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id").references(() => providers.id),
  state: text("state"),
  status: text("status"),
  path: text("path"),
  priority: text("priority"),
  notes: text("notes"), 
  initialOrRenewal: initialOrRenewalEnum("initial_or_renewal"),
  expiresAt: date("expires_at"),
  startsAt: date("starts_at"),
  emailSubjectOrTicketNum: text("email_subject_or_ticket_num"),
  number: text("number"),
  requestedAt: timestamp("requested_at", { withTimezone: true}), 
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const nowSql = sql`now()`;

export const agentsAuthenticatedAll = createAuthenticatedAllPolicy("agents_authenticated_all").link(agents);

export const auditLogAuthenticatedAll = createAuthenticatedAllPolicy("audit_log_authenticated_all").link(auditLog);

export const facilitiesAuthenticatedAll = createAuthenticatedAllPolicy("facilities_authenticated_all").link(facilities);

export const providersAuthenticatedAll = createAuthenticatedAllPolicy("providers_authenticated_all").link(providers);

export const workflowPhasesAuthenticatedAll = createAuthenticatedAllPolicy("workflow_phases_authenticated_all").link(workflowPhases);

export const configEnumsAuthenticatedAll = createAuthenticatedAllPolicy("config_enums_authenticated_all").link(configEnums);

export const facilityContactsAuthenticatedAll = createAuthenticatedAllPolicy("facility_contacts_authenticated_all").link(facilityContacts);

export const incidentLogsAuthenticatedAll = createAuthenticatedAllPolicy("incident_logs_authenticated_all").link(incidentLogs);

export const pfcWorkflowsAuthenticatedAll = createAuthenticatedAllPolicy("provider_facility_credentials_authenticated_all").link(providerFacilityCredentials);

export const prelivePipelineAuthenticatedAll = createAuthenticatedAllPolicy("facility_preline_info_authenticated_all").link(facilityPreliveInfo);

export const providerVestaPrivilegesAuthenticatedAll = createAuthenticatedAllPolicy("provider_vesta_privileges_authenticated_all").link(providerVestaPrivileges);

export const stateLicenseWorkflowsAuthenticatedAll = createAuthenticatedAllPolicy("provider_state_licenses_authenticated_all").link(providerStateLicenses);

export const psvAuthenticatedAll = createAuthenticatedAllPolicy("pendingPSV_authenticated_all").link(pendingPSV);

export const missingDocsAuthenticated = createAuthenticatedAllPolicy("missing_docs_authenticated_all").link(missingDocs); 

export const commLogsSelectAdmin = pgPolicy("comm_logs_admin_all", {
  for: "all",
  to: authenticatedRole,
  using: isAdminOrSuperAdmin,
}).link(commLogs);
