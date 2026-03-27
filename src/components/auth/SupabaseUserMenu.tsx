import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { LogOut, User } from "lucide-react";

export function SupabaseUserMenu() {
  const { appUser, logout } = useSupabaseAuth();

  if (!appUser) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
        <User className="h-4 w-4 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium text-foreground">{appUser.fullName || appUser.email}</span>
          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary capitalize">
            {appUser.role}
          </span>
        </div>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
