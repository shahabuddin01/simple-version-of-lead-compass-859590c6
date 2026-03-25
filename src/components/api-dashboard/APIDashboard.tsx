import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InternalAPIsTab } from "./InternalAPIsTab";
import { ExternalAPIsTab } from "./ExternalAPIsTab";
import { Key, MailCheck } from "lucide-react";

export function APIDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">API Dashboard</h2>
        <p className="text-sm text-muted-foreground">Manage your API keys and external service connections</p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="api-keys" className="gap-1.5">
            <Key className="h-3.5 w-3.5" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="millionverifier" className="gap-1.5">
            <MailCheck className="h-3.5 w-3.5" /> MillionVerifier
          </TabsTrigger>
        </TabsList>
        <TabsContent value="api-keys"><InternalAPIsTab /></TabsContent>
        <TabsContent value="millionverifier"><ExternalAPIsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
