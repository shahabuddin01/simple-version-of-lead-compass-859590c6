export type UserRole = "Admin" | "Manager" | "Employee" | "Viewer";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string; // btoa encoded — demo only, NOT production secure
  role: UserRole;
  active: boolean;
  permissionOverrides?: Partial<Record<keyof Permissions, boolean>>;
}

export interface Permissions {
  canViewLeads: boolean;
  canAddLead: boolean;
  canEditAnyLead: boolean;
  canEditOwnLead: boolean;
  canDeleteLead: boolean;
  canImport: boolean;
  canExport: boolean;
  canAccessSMS: boolean;
  canSendSMS: boolean;
  canConfigureSMSGateway: boolean;
  canAddIndustry: boolean;
  canDeleteIndustry: boolean;
  canRenameIndustry: boolean;
  canMergeCompany: boolean;
  canAddCompany: boolean;
  canDeleteCompany: boolean;
  canRenameCompany: boolean;
  canBulkStatusUpdate: boolean;
  canToggleActive: boolean;
  canViewDashboard: boolean;
  canManageUsers: boolean;
  canEditPermissions: boolean;
}

export const PERMISSION_LABELS: Record<keyof Permissions, string> = {
  canViewLeads: "View All Leads",
  canAddLead: "Add New Lead",
  canEditAnyLead: "Edit Any Lead",
  canEditOwnLead: "Edit Own Leads Only",
  canDeleteLead: "Delete Lead",
  canImport: "Import CSV",
  canExport: "Export Data",
  canAccessSMS: "Access SMS Center",
  canSendSMS: "Send SMS",
  canConfigureSMSGateway: "Configure SMS Gateway",
  canAddIndustry: "Add Industry / Company",
  canRenameIndustry: "Rename Industry / Company",
  canDeleteIndustry: "Delete Industry / Company",
  canAddCompany: "Add Industry / Company",
  canDeleteCompany: "Delete Industry / Company",
  canRenameCompany: "Rename Industry / Company",
  canMergeCompany: "Merge Companies",
  canBulkStatusUpdate: "Bulk Status Update",
  canToggleActive: "Mark Active / Inactive",
  canViewDashboard: "View Dashboard",
  canManageUsers: "Manage Users",
  canEditPermissions: "Edit Permissions",
};

// Display-friendly permission keys (deduplicated for the matrix UI)
export const PERMISSION_MATRIX_KEYS: { key: keyof Permissions; label: string }[] = [
  { key: "canViewLeads", label: "View All Leads" },
  { key: "canAddLead", label: "Add New Lead" },
  { key: "canEditAnyLead", label: "Edit Any Lead" },
  { key: "canEditOwnLead", label: "Edit Own Leads Only" },
  { key: "canDeleteLead", label: "Delete Lead" },
  { key: "canImport", label: "Import CSV" },
  { key: "canExport", label: "Export Data" },
  { key: "canAccessSMS", label: "Access SMS Center" },
  { key: "canSendSMS", label: "Send SMS" },
  { key: "canConfigureSMSGateway", label: "Configure SMS Gateway" },
  { key: "canAddIndustry", label: "Add Industry / Company" },
  { key: "canRenameIndustry", label: "Rename Industry / Company" },
  { key: "canDeleteIndustry", label: "Delete Industry / Company" },
  { key: "canMergeCompany", label: "Merge Companies" },
  { key: "canBulkStatusUpdate", label: "Bulk Status Update" },
  { key: "canToggleActive", label: "Mark Active / Inactive" },
  { key: "canViewDashboard", label: "View Dashboard" },
  { key: "canManageUsers", label: "Manage Users" },
  { key: "canEditPermissions", label: "Edit Permissions" },
];

// Permissions that are locked and cannot be changed
export const LOCKED_PERMISSIONS: Record<keyof Permissions, Partial<Record<UserRole, boolean>>> = {
  canViewLeads: { Admin: true, Manager: true, Employee: true, Viewer: true },
  canViewDashboard: { Admin: true, Manager: true, Employee: true, Viewer: true },
  canManageUsers: { Admin: true },
  canEditPermissions: { Admin: true },
  // Rest are not locked
  canAddLead: {}, canEditAnyLead: {}, canEditOwnLead: {}, canDeleteLead: {},
  canImport: {}, canExport: {}, canAccessSMS: {}, canSendSMS: {},
  canConfigureSMSGateway: {}, canAddIndustry: {}, canDeleteIndustry: {},
  canRenameIndustry: {}, canMergeCompany: {}, canAddCompany: {},
  canDeleteCompany: {}, canRenameCompany: {}, canBulkStatusUpdate: {},
  canToggleActive: {},
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  Admin: {
    canViewLeads: true, canAddLead: true, canEditAnyLead: true, canEditOwnLead: true,
    canDeleteLead: true, canImport: true, canExport: true,
    canAccessSMS: true, canSendSMS: true, canConfigureSMSGateway: true,
    canAddIndustry: true, canDeleteIndustry: true, canRenameIndustry: true,
    canMergeCompany: true, canAddCompany: true, canDeleteCompany: true, canRenameCompany: true,
    canBulkStatusUpdate: true, canToggleActive: true, canViewDashboard: true,
    canManageUsers: true, canEditPermissions: true,
  },
  Manager: {
    canViewLeads: true, canAddLead: true, canEditAnyLead: true, canEditOwnLead: true,
    canDeleteLead: false, canImport: true, canExport: false,
    canAccessSMS: true, canSendSMS: true, canConfigureSMSGateway: false,
    canAddIndustry: true, canDeleteIndustry: false, canRenameIndustry: true,
    canMergeCompany: false, canAddCompany: true, canDeleteCompany: false, canRenameCompany: true,
    canBulkStatusUpdate: true, canToggleActive: true, canViewDashboard: true,
    canManageUsers: false, canEditPermissions: false,
  },
  Employee: {
    canViewLeads: true, canAddLead: true, canEditAnyLead: false, canEditOwnLead: true,
    canDeleteLead: false, canImport: false, canExport: false,
    canAccessSMS: false, canSendSMS: false, canConfigureSMSGateway: false,
    canAddIndustry: false, canDeleteIndustry: false, canRenameIndustry: false,
    canMergeCompany: false, canAddCompany: false, canDeleteCompany: false, canRenameCompany: false,
    canBulkStatusUpdate: false, canToggleActive: true, canViewDashboard: true,
    canManageUsers: false, canEditPermissions: false,
  },
  Viewer: {
    canViewLeads: true, canAddLead: false, canEditAnyLead: false, canEditOwnLead: false,
    canDeleteLead: false, canImport: false, canExport: false,
    canAccessSMS: false, canSendSMS: false, canConfigureSMSGateway: false,
    canAddIndustry: false, canDeleteIndustry: false, canRenameIndustry: false,
    canMergeCompany: false, canAddCompany: false, canDeleteCompany: false, canRenameCompany: false,
    canBulkStatusUpdate: false, canToggleActive: false, canViewDashboard: true,
    canManageUsers: false, canEditPermissions: false,
  },
};

// Keep backward compat alias
export const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

export const ROLE_COLORS: Record<UserRole, string> = {
  Admin: "bg-red-100 text-red-700 border-red-200",
  Manager: "bg-purple-100 text-purple-700 border-purple-200",
  Employee: "bg-blue-100 text-blue-700 border-blue-200",
  Viewer: "bg-gray-100 text-gray-600 border-gray-200",
};
