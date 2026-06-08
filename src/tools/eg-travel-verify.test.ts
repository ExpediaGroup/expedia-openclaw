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
import { createVerifyTool } from "./eg-travel-verify.js";
import { TEST_CONFIG, mockFetchJson } from "./tool-test-helpers.js";

vi.mock("../credential-store.js");

describe("eg_travel_verify tool", () => {
  it("exposes correct metadata", () => {
    const tool = createVerifyTool(TEST_CONFIG);
    expect(tool.name).toBe("eg_travel_verify");
    expect(tool.label).toBe("EG Travel Verify");
    expect(tool.description).toContain("verification code");
  });

  it("rejects an input that isn't a valid email", async () => {
    const tool = createVerifyTool(TEST_CONFIG);
    const result = await tool.execute({ email: "bad", code: "123456" });
    expect(result.content[0].text).toContain("not a valid email address");
  });

  it("rejects code with wrong length", async () => {
    const tool = createVerifyTool(TEST_CONFIG);
    const result = await tool.execute({ email: "user@example.com", code: "12345" });
    expect(result.content[0].text).toContain("6 digits");
  });

  it("rejects code with non-digit characters", async () => {
    const tool = createVerifyTool(TEST_CONFIG);
    const result = await tool.execute({ email: "user@example.com", code: "12345a" });
    expect(result.content[0].text).toContain("6 digits");
  });

  it("sanitizes dashes and spaces from code before validation", async () => {
    const fakeFetch = mockFetchJson({
      token: "tok_test",
      tenant_id: "ten_1",
      token_kind: "bearer",
    });

    const tool = createVerifyTool(TEST_CONFIG, fakeFetch);
    const result = await tool.execute({ email: "user@example.com", code: "123-456" });

    expect(result.content[0].text).not.toContain("6 digits");
    expect(fakeFetch).toHaveBeenCalledOnce();
    const [, opts] = (fakeFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.code).toBe("123456");
  });

  it("returns success message on valid verification", async () => {
    const fakeFetch = mockFetchJson({
      token: "tok_test",
      tenant_id: "ten_1",
      token_kind: "bearer",
      quota: { searches_per_hour: 100, searches_remaining: 99 },
    });

    const tool = createVerifyTool(TEST_CONFIG, fakeFetch);
    const result = await tool.execute({ email: "user@example.com", code: "654321" });

    expect(result.content[0].text).toContain("Verification successful");
    expect(result.content[0].text).toContain("99/100");
  });
});
