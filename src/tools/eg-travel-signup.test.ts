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

import { describe, it, expect, vi } from "vitest";
import { createSignupTool } from "./eg-travel-signup.js";
import type { PluginConfig } from "../types.js";

const config: PluginConfig = {
  adapter_url: "http://localhost:19999",
  default_pos_country: "US",
  request_timeout_ms: 5000,
  synthetic_mode: true,
};

function mockFetchJson(body: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("eg_travel_signup tool", () => {
  it("exposes correct metadata", () => {
    const tool = createSignupTool(config);
    expect(tool.name).toBe("eg_travel_signup");
    expect(tool.label).toBe("EG Travel Signup");
    expect(tool.description).toContain("verification code");
  });

  it("rejects an input that isn't a valid email", async () => {
    const tool = createSignupTool(config);
    const result = await tool.execute({ email: "not-an-email" });
    expect(result.content[0].text).toContain("not a valid email address");
  });

  it("rejects a malformed email (missing TLD)", async () => {
    const tool = createSignupTool(config);
    const result = await tool.execute({ email: "foo@" });
    expect(result.content[0].text).toContain("not a valid email address");
  });

  it("returns success message for valid email signup", async () => {
    const fakeFetch = mockFetchJson({
      message: "Verification code sent",
      expires_in_seconds: 120,
    });

    const tool = createSignupTool(config, fakeFetch);
    const result = await tool.execute({ email: "user@example.com" });

    expect(fakeFetch).toHaveBeenCalledOnce();
    expect(result.content[0].text).toContain("6-digit verification code");
    expect(result.content[0].text).toContain("user@example.com");
    expect(result.content[0].text).toContain("inbox");
    expect(result.content[0].text).toContain("eg_travel_verify");
  });
});
