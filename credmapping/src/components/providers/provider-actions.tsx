"use client";

import { EditProviderDialog } from "~/components/providers/edit-provider-dialog";
import { DeleteProviderDialog } from "~/components/providers/delete-provider-dialog";
import {
  AddLicenseDialog,
  EditLicenseDialog,
  DeleteLicenseButton,
} from "~/components/providers/license-dialogs";
import {
  AddPrivilegeDialog,
  EditPrivilegeDialog,
  DeletePrivilegeButton,
} from "~/components/providers/privilege-dialogs";

// ─── Re-exports ─────────────────────────────────────────────────
// All dialog components re-exported from a single barrel so the
// server page can import them with one "use client" boundary.

export {
  // Provider-level
  EditProviderDialog,
  DeleteProviderDialog,
  // State licenses
  AddLicenseDialog,
  EditLicenseDialog,
  DeleteLicenseButton,
  // Vesta privileges
  AddPrivilegeDialog,
  EditPrivilegeDialog,
  DeletePrivilegeButton,
};
