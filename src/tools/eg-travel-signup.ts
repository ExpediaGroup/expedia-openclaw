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
import type { PluginConfig, InternalTool } from "../types.js";
import { AdapterClient } from "../adapter-client.js";
import { AdapterError, formatErrorForModel } from "../errors.js";
import { validateEmailInput } from "../validation.js";
import { toolTextResult, type ToolResult } from "../tool-result.js";

const InputSchema = Type.Object({
  email: Type.String({
    minLength: 3,
    maxLength: 254,
    pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    description: "Email address to receive the 6-digit verification code.",
  }),
});

type Input = Static<typeof InputSchema>;

export function createSignupTool(
  config: PluginConfig,
  fetchFn?: typeof globalThis.fetch,
): InternalTool {
  const client = new AdapterClient(config, fetchFn);

  return {
    name: "eg_travel_signup",
    label: "EG Travel Signup",
    description:
      "Start the signup process by requesting a temporary verification code via email.",
    inputSchema: InputSchema,

    async execute(input: unknown): Promise<ToolResult> {
      const { email: rawEmail } = input as Input;
      const email = rawEmail.trim();
      const emailErr = validateEmailInput(email);
      if (emailErr) return toolTextResult(emailErr);

      try {
        await client.signup({
          contact: email,
          contact_method: "email",
        });

        return toolTextResult(
          `A 6-digit verification code has been sent to ${email}. ` +
            `The code expires in 2 minutes. ` +
            `Ask the user to check their inbox for the code, then call \`eg_travel_verify\`.`,
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
