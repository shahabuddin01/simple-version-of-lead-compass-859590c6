import { useState } from "react";
import { useSupabaseUsers, ManagedUser } from "@/hooks/useSupabaseUsers";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ShieldCheck, Shield, Eye, Briefcase, UserX, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "manager" | "viewer" | "user";

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Admin", icon: ShieldCheck, color: "bg-red-100 text-red-700" },
  manager: { label: "Manager", icon: Briefcase, color: "bg-purple-100 text-purple-700" },
  user: { label: "User", icon: Shield, color: "bg-blue-100 text-blue-700" },
  viewer: { label: "Viewer", icon: Eye, color: "bg-gray-100 text-gray-600" },
};

export function SupabaseUserManagement() {
  const { users, loading, fetchUsers, updateUserRole, toggleUserActive } = useSupabaseUsers();
  const { appUser } = useSupabaseAuth();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">{users.length} users</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
        >
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const roleInfo = ROLE_CONFIG[user.role] || ROLE_CONFIG.user;
              const RoleIcon = roleInfo.icon;
              const isCurrentUser = user.userId === appUser?.id;

              return (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{user.fullName || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    {editingRole === user.userId && !isCurrentUser ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.userId, e.target.value as AppRole)}
                        onBlur={() => setEditingRole(null)}
                        autoFocus
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/20"
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
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${roleInfo.color} ${!isCurrentUser ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                        title={isCurrentUser ? "Cannot change own role" : "Click to change role"}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {roleInfo.label}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isCurrentUser && (
                      <button
                        onClick={() => toggleUserActive(user.userId, user.isActive)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        title={user.isActive ? "Deactivate" : "Activate"}
                      >
                        {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Add New User</h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="John Doe" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="user@example.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Password</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as AppRole })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddModal(false)} disabled={adding}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button onClick={handleAddUser} disabled={adding}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all">
                {adding ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
