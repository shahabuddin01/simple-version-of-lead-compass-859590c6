import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APIHealthBar } from "./APIHealthBar";
import { InternalAPIsTab } from "./InternalAPIsTab";
import { ExternalAPIsTab } from "./ExternalAPIsTab";
import { IntegrationsTab } from "./IntegrationsTab";
import { DeveloperToolsTab } from "./DeveloperToolsTab";
import { Server, Globe, Plug, Code2 } from "lucide-react";

export function APIDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">API Dashboard</h2>
        <p className="text-sm text-muted-foreground">Unified hub for all API connections, integrations, and developer tools</p>
      </div>

      <APIHealthBar />

      <Tabs defaultValue="internal" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="internal" className="gap-1.5">
            <Server className="h-3.5 w-3.5" /> Internal APIs
          </TabsTrigger>
          <TabsTrigger value="external" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" /> External APIs
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5">
            <Plug className="h-3.5 w-3.5" /> Integrations
          </TabsTrigger>
          <TabsTrigger value="developer" className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" /> Developer Tools
          </TabsTrigger>
        </TabsList>
        <TabsContent value="internal"><InternalAPIsTab /></TabsContent>
        <TabsContent value="external"><ExternalAPIsTab /></TabsContent>
        <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
        <TabsContent value="developer"><DeveloperToolsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
