import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APICredentials } from "./APICredentials";
import { APIDocumentation } from "./APIDocumentation";
import { APIRequestLogs } from "./APIRequestLogs";
import { IDEIntegrations } from "./IDEIntegrations";
import { EmailMarketingTools } from "./EmailMarketingTools";
import { DeploymentConfig } from "./DeploymentConfig";

export function APIIntegrations() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">API & Integrations</h2>
        <p className="text-sm text-muted-foreground">Expose your lead data to external systems via REST API</p>
      </div>

      <DeploymentConfig />

      <Tabs defaultValue="credentials" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="credentials">API Credentials</TabsTrigger>
          <TabsTrigger value="documentation">API Documentation</TabsTrigger>
          <TabsTrigger value="email-marketing">Email Marketing Tools</TabsTrigger>
          <TabsTrigger value="logs">Request Logs</TabsTrigger>
          <TabsTrigger value="ide">IDE & AI Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="credentials"><APICredentials /></TabsContent>
        <TabsContent value="documentation"><APIDocumentation /></TabsContent>
        <TabsContent value="email-marketing"><EmailMarketingTools /></TabsContent>
        <TabsContent value="logs"><APIRequestLogs /></TabsContent>
        <TabsContent value="ide"><IDEIntegrations /></TabsContent>
      </Tabs>
    </div>
  );
}
