import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppUser, UserRole, ROLE_COLORS, Permissions, PERMISSION_MATRIX_KEYS, LOCKED_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/types/auth";
import { Plus, X, Lock, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { checkPasswordStrength, isPasswordValid, hashPassword, getAuditLog, exportAuditCSV, AuditEntry, logAudit } from "@/lib/security";

const roles: UserRole[] = ["Admin", "Manager", "Employee", "Viewer"];
const editableRoles: UserRole[] = ["Manager", "Employee", "Viewer"];

const allPermissionKeys: (keyof Permissions)[] = PERMISSION_MATRIX_KEYS.map(p => p.key);

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = checkPasswordStrength(password);
  return (
    <div className="space-y-1 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength.score ? strength.color : 'bg-muted'}`} />
        ))}
      </div>
      <p className={`text-xs ${strength.score >= 3 ? 'text-green-600' : strength.score >= 2 ? 'text-amber-600' : 'text-destructive'}`}>
        {strength.label}
      </p>
      {strength.errors.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {strength.errors.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      )}
    </div>
  );
}

export function UserManagement() {
  const { users, currentUser, addUser, updateUser, toggleUserActive, rolePermissions, setRolePermissions, resetRolePermissions } = useAuth();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; user?: AppUser } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Employee" as UserRole });
  const [overrides, setOverrides] = useState<Partial<Record<keyof Permissions, boolean>>>({});
  const [error, setError] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);

  // Audit log state
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  const [localPerms, setLocalPerms] = useState<Record<UserRole, Permissions>>({ ...rolePermissions });

  const openAdd = () => {
    setForm({ name: "", email: "", password: "", role: "Employee" });
    setOverrides({});
    setError("");
    setModal({ mode: "add" });
  };

  const openEdit = (user: AppUser) => {
    setForm({ name: user.name, email: user.email, password: "", role: user.role });
    setOverrides(user.permissionOverrides || {});
    setError("");
    setModal({ mode: "edit", user });
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }

    // Password validation
    if (modal?.mode === "add" && !form.password) { setError("Password is required for new users."); return; }
    if (form.password && !isPasswordValid(form.password)) {
      setError("Password does not meet the security requirements.");
      return;
    }

    const cleanOverrides = Object.keys(overrides).length > 0 ? overrides : undefined;
    if (modal?.mode === "add") {
      const err = addUser({
        name: form.name.trim(), email: form.email.trim(),
        password: hashPassword(form.password),
        role: form.role, active: true, permissionOverrides: cleanOverrides,
      });
      if (err) { setError(err); return; }
      toast.success(`User "${form.name.trim()}" created.`);
    } else if (modal?.mode === "edit" && modal.user) {
      const updates: Partial<AppUser> = {
        name: form.name.trim(), email: form.email.trim(),
        role: form.role, permissionOverrides: cleanOverrides,
      };
      if (form.password) {
        updates.password = hashPassword(form.password);
        if (currentUser) {
          logAudit(currentUser.email, currentUser.id, 'PASSWORD_CHANGED', `User: ${form.email.trim()}`);
        }
      }
      updateUser(modal.user.id, updates);
      toast.success(`User "${form.name.trim()}" updated.`);
    }
    setModal(null);
  };

  const handleToggle = (user: AppUser) => {
    if (user.id === currentUser?.id) { toast.error("You cannot deactivate your own account."); return; }
    toggleUserActive(user.id);
    toast.success(`${user.name} ${user.active ? "deactivated" : "activated"}.`);
  };

  const addOverride = () => {
    const available = allPermissionKeys.filter(k => !(k in overrides));
    if (available.length === 0) return;
    setOverrides(prev => ({ ...prev, [available[0]]: true }));
  };

  const removeOverride = (key: keyof Permissions) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const isPermLocked = (key: keyof Permissions, role: UserRole): boolean => {
    const lock = LOCKED_PERMISSIONS[key];
    return lock?.[role] !== undefined;
  };

  const toggleMatrixPerm = (role: UserRole, key: keyof Permissions) => {
    if (role === "Admin" || isPermLocked(key, role)) return;
    setLocalPerms(prev => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] },
    }));
  };

  const savePermissions = () => {
    setRolePermissions(localPerms);
    toast.success("Permissions updated successfully.");
  };

  const handleResetDefaults = () => {
    resetRolePermissions();
    setLocalPerms({ ...DEFAULT_ROLE_PERMISSIONS });
    setResetConfirm(false);
    toast.success("Permissions reset to defaults.");
  };

  // Audit log
  const auditLog = useMemo(() => {
    let entries = getAuditLog();
    if (auditSearch) {
      const s = auditSearch.toLowerCase();
      entries = entries.filter(e => e.userEmail.toLowerCase().includes(s) || e.details.toLowerCase().includes(s));
    }
    if (auditActionFilter) {
      entries = entries.filter(e => e.action === auditActionFilter);
    }
    if (auditDateFrom) {
      entries = entries.filter(e => e.timestamp >= auditDateFrom);
    }
    if (auditDateTo) {
      entries = entries.filter(e => e.timestamp <= auditDateTo + "T23:59:59");
    }
    return entries;
  }, [auditSearch, auditActionFilter, auditDateFrom, auditDateTo]);

  const auditActions = useMemo(() => {
    const all = getAuditLog();
    return [...new Set(all.map(e => e.action))].sort();
  }, []);

  return (
    <Tabs defaultValue="users" className="space-y-4">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="permissions">Permissions</TabsTrigger>
        <TabsTrigger value="audit">Audit Log</TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">User Management</h2>
            <button onClick={openAdd} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all">
              <Plus className="h-4 w-4" />
              Add User
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {u.name}
                        {u.permissionOverrides && Object.keys(u.permissionOverrides).length > 0 && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                            Custom permissions
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(u)} className="text-xs font-medium text-primary hover:underline">Edit</button>
                        <button
                          onClick={() => handleToggle(u)}
                          disabled={u.id === currentUser?.id}
                          className={`text-xs font-medium ${u.id === currentUser?.id ? "text-muted-foreground cursor-not-allowed" : u.active ? "text-destructive hover:underline" : "text-green-600 hover:underline"}`}
                        >
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="permissions">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold tracking-tight">Permission Matrix</h2>
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground min-w-[220px]">Permission</th>
                  {roles.map(role => (
                    <th key={role} className="px-4 py-3 text-xs font-medium text-muted-foreground text-center min-w-[90px]">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[role]}`}>
                        {role}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX_KEYS.map(({ key, label }) => (
                  <tr key={key} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{label}</td>
                    {roles.map(role => {
                      const value = localPerms[role][key];

                      if (role === "Admin") {
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-muted-foreground">
                              <Lock className="h-3.5 w-3.5" />
                              <span className="text-xs text-green-600 font-medium">ON</span>
                            </div>
                          </td>
                        );
                      }

                      if (key === "canManageUsers" || key === "canEditPermissions") {
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-muted-foreground">
                              <Lock className="h-3.5 w-3.5" />
                              <span className="text-xs font-medium">OFF</span>
                            </div>
                          </td>
                        );
                      }

                      const lockVal = LOCKED_PERMISSIONS[key]?.[role];
                      if (lockVal !== undefined) {
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-muted-foreground">
                              <Lock className="h-3.5 w-3.5" />
                              <span className="text-xs text-green-600 font-medium">ON</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={role} className="px-4 py-3 text-center">
                          <Switch
                            checked={value}
                            onCheckedChange={() => toggleMatrixPerm(role, key)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setResetConfirm(true)} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
              Reset to Defaults
            </button>
            <button onClick={savePermissions} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all">
              Save Permissions
            </button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="audit">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Audit Log</h2>
            <button
              onClick={exportAuditCSV}
              className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export Audit Log
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Search user or details..."
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <select
              value={auditActionFilter}
              onChange={e => setAuditActionFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Actions</option>
              {auditActions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.slice(0, 500).map((entry, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm">{entry.userEmail}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        entry.action.includes('FAIL') || entry.action.includes('DENIED') ? 'bg-red-100 text-red-700' :
                        entry.action.includes('DELETE') ? 'bg-amber-100 text-amber-700' :
                        entry.action === 'LOGIN' ? 'bg-green-100 text-green-700' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground max-w-[300px] truncate">{entry.details}</td>
                  </tr>
                ))}
                {auditLog.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No audit entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Showing {Math.min(auditLog.length, 500)} of {auditLog.length} entries</p>
        </div>
      </TabsContent>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">{modal.mode === "add" ? "Add User" : "Edit User"}</h3>
              <button onClick={() => setModal(null)} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {modal.mode === "add" ? "Password *" : "Reset Password"}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={modal.mode === "edit" ? "Leave blank to keep current" : ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
                <PasswordStrengthMeter password={form.password} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Role *</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20">
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Per-user permission overrides */}
              <div className="border-t border-border pt-3 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Custom Permission Overrides</h4>
                <p className="text-xs text-muted-foreground">These override the default role permissions for this user only.</p>

                {Object.entries(overrides).map(([key, value]) => {
                  const permKey = key as keyof Permissions;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <select
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value as keyof Permissions;
                          setOverrides(prev => {
                            const next = { ...prev };
                            delete next[permKey];
                            next[newKey] = value;
                            return next;
                          });
                        }}
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      >
                        {allPermissionKeys
                          .filter(k => k === key || !(k in overrides))
                          .map(k => (
                            <option key={k} value={k}>{PERMISSION_MATRIX_KEYS.find(p => p.key === k)?.label || k}</option>
                          ))}
                      </select>
                      <select
                        value={value ? "on" : "off"}
                        onChange={(e) => setOverrides(prev => ({ ...prev, [key]: e.target.value === "on" }))}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="on">ON</option>
                        <option value="off">OFF</option>
                      </select>
                      <button onClick={() => removeOverride(permKey)} className="text-xs text-destructive hover:underline">Remove</button>
                    </div>
                  );
                })}

                {Object.keys(overrides).length < allPermissionKeys.length && (
                  <button onClick={addOverride} className="text-xs font-medium text-primary hover:underline">
                    + Add Override
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleSave} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all">
                {modal.mode === "add" ? "Add User" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirmation */}
      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setResetConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-foreground">Reset Permissions?</h3>
            <p className="text-sm text-muted-foreground">Reset all permissions to default? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setResetConfirm(false)} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleResetDefaults} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-all">
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </Tabs>
  );
}
