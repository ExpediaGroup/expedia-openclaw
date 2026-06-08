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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTenantStatusTool } from "./eg-tenant-status.js";
import { TEST_CONFIG, TEST_CREDENTIAL, mockFetchJson } from "./tool-test-helpers.js";

vi.mock("../credential-store.js");

import { readCredential } from "../credential-store.js";
const mockReadCredential = vi.mocked(readCredential);

function tenantResponse(overrides?: Record<string, unknown>) {
  return {
    tenant_id: "ten_abc",
    contact: "a@b.com",
    contact_type: "email",
    status: "active",
    default_pos: "US",
    quota: {
      limit_per_hour: 100,
      remaining: 82,
      used: 18,
      reset_at: "2026-04-23T10:00:00Z",
    },
    price_watches: {
      active: 2,
      total_created: 5,
    },
    ...overrides,
  };
}

describe("eg_tenant_status tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes correct metadata", () => {
    const tool = createTenantStatusTool(TEST_CONFIG);
    expect(tool.name).toBe("eg_tenant_status");
    expect(tool.label).toBe("EG Travel Account Status");
    expect(tool.description).toContain("quota");
  });

  it("returns signup prompt when no credentials", async () => {
    mockReadCredential.mockReturnValue(null);
    const tool = createTenantStatusTool(TEST_CONFIG);

    const result = await tool.execute();

    expect(result.content[0].text).toContain("eg_travel_signup");
    expect(result.content[0].text).toContain("No credentials");
  });

  it("returns account status on success", async () => {
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const fakeFetch = mockFetchJson(tenantResponse());
    const tool = createTenantStatusTool(TEST_CONFIG, fakeFetch);
    const result = await tool.execute();

    expect(fakeFetch).toHaveBeenCalledOnce();
    const text = result.content[0].text;
    expect(text).toContain("a@b.com");
    expect(text).toContain("active");
    expect(text).toContain("82/100");
    expect(text).toContain("18 used");
    expect(text).toContain("US");
    expect(text).toContain("2 active");
  });

  it("shows price watch counts", async () => {
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const fakeFetch = mockFetchJson(tenantResponse({
      price_watches: { active: 0, total_created: 12 },
    }));

    const tool = createTenantStatusTool(TEST_CONFIG, fakeFetch);
    const result = await tool.execute();

    expect(result.content[0].text).toContain("0 active");
    expect(result.content[0].text).toContain("12 total");
  });

  it("maps 401 to signup prompt", async () => {
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const fakeFetch = mockFetchJson(
      { error: { code: "unauthorized", message: "Invalid token" } },
      401,
    );

    const tool = createTenantStatusTool(TEST_CONFIG, fakeFetch);
    const result = await tool.execute();

    expect(result.content[0].text).toContain("eg_travel_signup");
  });

  it("maps token_expired to re-auth prompt", async () => {
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const fakeFetch = mockFetchJson(
      { error: { code: "token_expired", message: "Token expired" } },
      401,
    );

    const tool = createTenantStatusTool(TEST_CONFIG, fakeFetch);
    const result = await tool.execute();

    expect(result.content[0].text).toContain("eg_travel_signup");
    expect(result.content[0].text).toContain("expired");
  });

  it("sends correct authorization header", async () => {
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const fakeFetch = mockFetchJson(tenantResponse());
    const tool = createTenantStatusTool(TEST_CONFIG, fakeFetch);
    await tool.execute();

    const [url, opts] = (fakeFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/v1/tenant/me");
    expect(opts.headers["Authorization"]).toBe("Bearer tok");
    expect(opts.method).toBe("GET");
  });
});
