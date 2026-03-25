import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_COLORS } from "@/types/auth";
import { LogOut, User } from "lucide-react";

export function UserMenu() {
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!currentUser) return null;

  const initials = currentUser.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-medium text-foreground leading-tight">{currentUser.name}</span>
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[currentUser.role]}`}>
              {currentUser.role}
            </span>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-border bg-popover py-1 shadow-lg">
            <button
              onClick={() => { setShowProfile(true); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              My Profile
            </button>
            <div className="my-0.5 h-px bg-border" />
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
          onClick={() => setShowProfile(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl space-y-4"
          >
            <h3 className="text-base font-semibold text-foreground">My Profile</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Name</p>
                <p className="text-sm text-foreground">{currentUser.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Email</p>
                <p className="text-sm text-foreground">{currentUser.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Role</p>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${ROLE_COLORS[currentUser.role]}`}>
                  {currentUser.role}
                </span>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowProfile(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
