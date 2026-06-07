/*
Copyright 2026 Expedia Group, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { definePluginEntry } from "openclaw/plugin-sdk/core";
import { readPluginConfig } from "./plugin-config.js";
import { createSearchStaysTool } from "./tools/search-stays.js";
import { createSearchFlightsTool } from "./tools/search-flights.js";
import { createSignupTool } from "./tools/eg-travel-signup.js";
import { createVerifyTool } from "./tools/eg-travel-verify.js";
import { createTenantStatusTool } from "./tools/eg-tenant-status.js";

// The host expects tool objects shaped like `AgentTool`: `parameters` (not
// `inputSchema`), `execute(toolCallId, params, signal?, onUpdate?)` (not
// `execute(input)`). Our internal factories return a simpler shape so the
// individual tool files stay easy to test in isolation; this thin adapter
// translates between the two without touching them.
interface InternalTool {
  name: string;
  label: string;
  description: string;
  inputSchema: unknown;
  execute: (input: unknown) => Promise<{
    content: { type: "text"; text: string }[];
    details?: unknown;
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptTool(tool: InternalTool): any {
  return {
    name: tool.name,
    label: tool.label,
    description: tool.description,
    parameters: tool.inputSchema,
    execute: async (_toolCallId: string, params: unknown) => {
      const result = await tool.execute(params);
      return { content: result.content, details: result.details };
    },
  };
}

export default definePluginEntry({
  id: "expedia-openclaw",
  name: "Expedia Travel",
  description:
    "Live hotel, resort, vacation rental, and flight search via the Expedia Travel Adapter",
  register(api) {
    const config = readPluginConfig(api.pluginConfig);

    api.registerTool(adaptTool(createSignupTool(config) as InternalTool));
    api.registerTool(adaptTool(createVerifyTool(config) as InternalTool));
    api.registerTool(adaptTool(createSearchStaysTool(config) as InternalTool));
    api.registerTool(adaptTool(createSearchFlightsTool(config) as InternalTool));
    api.registerTool(adaptTool(createTenantStatusTool(config) as InternalTool));
  },
});
