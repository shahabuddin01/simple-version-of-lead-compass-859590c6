import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

type AppRole = "admin" | "user";

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = useCallback(async (userId: string, email: string) => {
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Fetch role using the security definer function
      const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: userId });

      const role: AppRole = (roleData as AppRole) || "user";

      setAppUser({
        id: userId,
        email: email,
        fullName: profile?.full_name || "",
        role,
        isActive: profile?.is_active ?? true,
      });
    } catch (err) {
      console.error("Error fetching app user:", err);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase auth
          setTimeout(() => {
            fetchAppUser(session.user.id, session.user.email || "");
          }, 0);
        } else {
          setAppUser(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAppUser(session.user.id, session.user.email || "");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchAppUser]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAppUser(null);
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return error.message;
    return null;
  }, []);

  const isAdmin = appUser?.role === "admin";

  return (
    <AuthContext.Provider value={{ session, user, appUser, isAdmin, loading, login, logout, signUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  return ctx;
}
