import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ManagedUser {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: "admin" | "manager" | "viewer" | "user";
  isActive: boolean;
  createdAt: string;
}

export const useSupabaseUsers = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load users");
      setLoading(false);
      return;
    }

    // Fetch roles for all users
    const userIds = (profiles || []).map(p => p.user_id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("*")
      .in("user_id", userIds);

    const roleMap = new Map<string, string>();
    (roles || []).forEach(r => roleMap.set(r.user_id, r.role));

    const mapped: ManagedUser[] = (profiles || []).map(p => ({
      id: p.id,
      userId: p.user_id,
      fullName: p.full_name || "",
      email: p.email || "",
      role: (roleMap.get(p.user_id) as "admin" | "manager" | "viewer" | "user") || "user",
      isActive: p.is_active ?? true,
      createdAt: p.created_at,
    }));

    setUsers(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateUserRole = useCallback(async (userId: string, newRole: "admin" | "manager" | "viewer" | "user") => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) { toast.error("Failed to update role"); return false; }
    toast.success("Role updated");
    fetchUsers();
    return true;
  }, [fetchUsers]);

  const toggleUserActive = useCallback(async (userId: string, isActive: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !isActive })
      .eq("user_id", userId);

    if (error) { toast.error("Failed to update user status"); return false; }
    toast.success(isActive ? "User deactivated" : "User activated");
    fetchUsers();
    return true;
  }, [fetchUsers]);

  return { users, loading, fetchUsers, updateUserRole, toggleUserActive };
};
