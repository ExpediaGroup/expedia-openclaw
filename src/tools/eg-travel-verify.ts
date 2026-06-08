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

import { Type, type Static } from "@sinclair/typebox";
import type { PluginConfig } from "../types.js";
import { AdapterClient } from "../adapter-client.js";
import { AdapterError, formatErrorForModel } from "../errors.js";
import { validateEmailInput, sanitizeVerificationCode } from "../validation.js";
import { writeCredential } from "../credential-store.js";
import { toolTextResult, type ToolResult } from "../tool-result.js";

const InputSchema = Type.Object({
  email: Type.String({
    minLength: 3,
    maxLength: 254,
    pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    description: "Email address used during signup.",
  }),
  code: Type.String({ minLength: 6, maxLength: 10 }),
});

type Input = Static<typeof InputSchema>;

export function createVerifyTool(
  config: PluginConfig,
  fetchFn?: typeof globalThis.fetch,
) {
  const client = new AdapterClient(config, fetchFn);

  return {
    name: "eg_travel_verify",
    label: "EG Travel Verify",
    description:
      "Complete signup by exchanging the temporary verification code for an API token.",
    inputSchema: InputSchema,

    async execute(input: Input): Promise<ToolResult> {
      const email = input.email.trim();
      const emailErr = validateEmailInput(email);
      if (emailErr) return toolTextResult(emailErr);

      const sanitized = sanitizeVerificationCode(code);
      if (!sanitized.ok) {
        return toolTextResult(sanitized.error);
      }

      try {
        const resp = await client.signupVerify({
          contact: email,
          contact_method: "email",
          code: sanitized.code,
        });

        writeCredential({
          token: resp.token,
          tenant_id: resp.tenant_id,
          contact: email,
          contact_method: "email",
          token_kind: resp.token_kind,
          expires_at: resp.expires_at,
        });

        const quotaInfo = resp.quota
          ? ` Quota: ${resp.quota.searches_remaining}/${resp.quota.searches_per_hour} searches per hour.`
          : "";

        return toolTextResult(
          `Verification successful. You can now search for stays and flights.${quotaInfo}`,
        );
      } catch (err) {
        if (err instanceof AdapterError) {
          return toolTextResult(formatErrorForModel(err, config.adapter_url));
        }
        throw err;
      }
    },
  };
}
