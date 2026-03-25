import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

export function DeploymentConfig() {
  const appUrl = import.meta.env.VITE_APP_URL || "(not set)";
  const apiUrl = import.meta.env.VITE_API_URL || "(not set)";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="h-4 w-4" /> Deployment Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Current App URL</span>
            <code className="text-xs font-mono text-foreground">{appUrl}</code>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Backend API URL</span>
            <code className="text-xs font-mono text-foreground">{apiUrl}</code>
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/50 p-3">
          <p className="text-xs font-semibold text-foreground mb-1.5">To change your hosting domain:</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Update <code className="font-mono text-primary">VITE_APP_URL</code> and <code className="font-mono text-primary">VITE_API_URL</code> in your <code className="font-mono">.env</code> file</li>
            <li>Update <code className="font-mono text-primary">APP_URL</code> in <code className="font-mono">backend/config/.env</code></li>
            <li>Run <code className="font-mono">npm run build</code></li>
            <li>Upload <code className="font-mono">/dist</code> to your cPanel <code className="font-mono">public_html</code></li>
            <li>Upload <code className="font-mono">/backend</code> to <code className="font-mono">public_html/backend</code></li>
            <li>Update allowed origins in the API Credentials tab</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
