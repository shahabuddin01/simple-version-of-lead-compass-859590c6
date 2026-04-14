import { useState } from "react";
import { useSupabaseUsers, ManagedUser } from "@/hooks/useSupabaseUsers";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ShieldCheck, Shield, Eye, Briefcase, UserX, UserCheck, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type AppRole = "admin" | "manager" | "viewer" | "user";

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Admin", icon: ShieldCheck, color: "bg-destructive/10 text-destructive border-destructive/20" },
  manager: { label: "Manager", icon: Briefcase, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  user: { label: "User", icon: Shield, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  viewer: { label: "Viewer", icon: Eye, color: "bg-muted text-muted-foreground border-border" },
};

export function SupabaseUserManagement() {
  const { users, loading, fetchUsers, updateUserRole, toggleUserActive } = useSupabaseUsers();
  const { appUser } = useSupabaseAuth();
  const isMobile = useIsMobile();
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "user" as AppRole });
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const handleAddUser = async () => {
    if (!form.fullName || !form.email || !form.password) {
      toast.error("All fields are required");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: form.email, password: form.password, full_name: form.fullName, role: form.role },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`User "${form.fullName}" created successfully`);
      setShowAddModal(false);
      setForm({ fullName: "", email: "", password: "", role: "user" });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    }
    setAdding(false);
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    await updateUserRole(userId, newRole);
    setEditingRole(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = users.filter(u => u.isActive).length;
  const roleBreakdown = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">User Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{users.length} users · {activeCount} active</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
        {Object.entries(ROLE_CONFIG).map(([role, config]) => {
          const Icon = config.icon;
          const count = roleBreakdown[role] || 0;
          return (
            <div key={role} className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5", config.color)}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium opacity-70 leading-none">{config.label}s</p>
                <p className="text-lg font-bold leading-tight tabular-nums">{count}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Name</th>
              {!isMobile && <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Email</th>}
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const roleInfo = ROLE_CONFIG[user.role] || ROLE_CONFIG.user;
              const RoleIcon = roleInfo.icon;
              const isCurrentUser = user.userId === appUser?.id;

              return (
                <tr key={user.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {(user.fullName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.fullName || "—"}</p>
                        {isMobile && <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{user.email}</p>}
                      </div>
                    </div>
                  </td>
                  {!isMobile && <td className="px-4 py-2.5 text-muted-foreground text-xs">{user.email}</td>}
                  <td className="px-4 py-2.5">
                    {editingRole === user.userId && !isCurrentUser ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.userId, e.target.value as AppRole)}
                        onBlur={() => setEditingRole(null)}
                        autoFocus
                        className="rounded-lg border border-input bg-background px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/20"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="user">User</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => !isCurrentUser && setEditingRole(user.userId)}
                        disabled={isCurrentUser}
                        className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-opacity", roleInfo.color, !isCurrentUser ? "cursor-pointer hover:opacity-80" : "cursor-default")}
                        title={isCurrentUser ? "Cannot change own role" : "Click to change role"}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {roleInfo.label}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      user.isActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"
                    )}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!isCurrentUser && (
                      <button
                        onClick={() => toggleUserActive(user.userId, user.isActive)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        title={user.isActive ? "Deactivate" : "Activate"}
                      >
                        {user.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 mx-4">
            <h3 className="text-base font-semibold text-foreground">Add New User</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="John Doe" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="user@example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as AppRole })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddModal(false)} disabled={adding}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button onClick={handleAddUser} disabled={adding}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all">
                {adding ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
