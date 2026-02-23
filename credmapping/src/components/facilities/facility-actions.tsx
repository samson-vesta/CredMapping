"use client";

import { EditFacilityDialog } from "~/components/facilities/edit-facility-dialog";
import { DeleteFacilityDialog } from "~/components/facilities/delete-facility-dialog";
import {
  AddContactDialog,
  EditContactDialog,
  DeleteContactButton,
  TogglePrimaryButton,
} from "~/components/facilities/contact-dialogs";
import {
  AddPreliveDialog,
  EditPreliveDialog,
  DeletePreliveButton,
} from "~/components/facilities/prelive-dialogs";
import {
  AddPfcDialog,
  EditPfcDialog,
  DeletePfcButton,
} from "~/components/facilities/pfc-dialogs";
import {
  AddWorkflowPhaseDialog,
  DeleteWorkflowPhaseButton,
} from "~/components/facilities/workflow-phase-dialogs";

// ─── Re-exports ─────────────────────────────────────────────────
// All dialog components re-exported from a single barrel so the
// server page can import them with one `"use client"` boundary.

export {
  // Facility-level
  EditFacilityDialog,
  DeleteFacilityDialog,
  // Contacts
  AddContactDialog,
  EditContactDialog,
  DeleteContactButton,
  TogglePrimaryButton,
  // Prelive
  AddPreliveDialog,
  EditPreliveDialog,
  DeletePreliveButton,
  // PFC
  AddPfcDialog,
  EditPfcDialog,
  DeletePfcButton,
  // Workflow phases
  AddWorkflowPhaseDialog,
  DeleteWorkflowPhaseButton,
};
