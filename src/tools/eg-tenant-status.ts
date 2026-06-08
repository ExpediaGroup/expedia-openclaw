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

import type { PluginConfig } from "../types.js";
import { AdapterClient } from "../adapter-client.js";
import { catchAdapterError } from "../errors.js";
import { readCredential } from "../credential-store.js";
import { toolTextResult, type ToolResult } from "../tool-result.js";

export function createTenantStatusTool(
  config: PluginConfig,
  fetchFn?: typeof globalThis.fetch,
) {
  const client = new AdapterClient(config, fetchFn);

  return {
    name: "eg_tenant_status",
    label: "EG Travel Account Status",
    description:
      "Show current account status including quota usage, token expiry, and account state.",
    inputSchema: {},

    async execute(): Promise<ToolResult> {
      const credential = readCredential();
      if (!credential) {
        return toolTextResult(
          "No credentials found. " +
            "Call `eg_travel_signup` with the user's email or phone number to get started.",
        );
      }

      try {
        const resp = await client.tenantMe(credential.token);

        const lines: string[] = [
          `Account: ${resp.contact} (${resp.contact_type})`,
          `Status: ${resp.status}`,
          `Quota: ${resp.quota.remaining}/${resp.quota.limit_per_hour} searches per hour (${resp.quota.used} used)`,
          `Quota resets at: ${resp.quota.reset_at}`,
          `Point of sale: ${resp.default_pos}`,
          `Price watches: ${resp.price_watches.active} active (${resp.price_watches.total_created} total)`,
        ];

        return toolTextResult(lines.join("\n"));
      } catch (err) {
        return catchAdapterError(err, config.adapter_url, {
          contact: credential.contact,
          contact_method: credential.contact_method,
        });
      }
    },
  };
}
