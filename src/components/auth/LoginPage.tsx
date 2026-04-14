import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";
import { isAccountLocked } from "@/lib/security";
import { toast } from "sonner";



export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [lockCountdown, setLockCountdown] = useState(0);
  

  useEffect(() => {
    if (lockCountdown <= 0) return;
    const interval = setInterval(() => {
      setLockCountdown(prev => {
        if (prev <= 1) { setError(""); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockCountdown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (email) {
      const lock = isAccountLocked(email.toLowerCase());
      if (lock.locked) {
        setLockCountdown(lock.remainingSeconds);
        setError(`Account locked. Try again in ${Math.floor(lock.remainingSeconds / 60)}:${String(lock.remainingSeconds % 60).padStart(2, '0')}`);
        return;
      }
    }
    const err = login(email, password);
    if (err) {
      setError(err);
      if (email) {
        const lock = isAccountLocked(email.toLowerCase());
        if (lock.locked) setLockCountdown(lock.remainingSeconds);
      }
    }
  };

  const fmtCountdown = lockCountdown > 0
    ? `${Math.floor(lockCountdown / 60)}:${String(lockCountdown % 60).padStart(2, '0')}`
    : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <img src="/favicon.ico" alt="NH Production House" className="h-12 w-12 rounded-xl object-contain" />
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
              {lockCountdown > 0 && <div className="mt-1 font-mono text-base font-bold">{fmtCountdown}</div>}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={lockCountdown > 0}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {lockCountdown > 0 ? `Locked (${fmtCountdown})` : 'Sign In'}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            <button type="button" onClick={() => {
              if (!email.trim()) { setError("Enter your email first"); return; }
              toast.success("Password reset email sent. Check your inbox.");
            }} className="text-primary hover:underline">Forgot password?</button>
          </p>
        </form>
      </div>
    </div>
  );
}
