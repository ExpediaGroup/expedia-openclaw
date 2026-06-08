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

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, adapterAvailable, ADAPTER_URL } from "./setup.js";

let available = false;

beforeAll(async () => {
  available = await adapterAvailable();
  if (!available) {
    console.log(
      `Skipping integration tests — adapter not reachable at ${ADAPTER_URL}`,
    );
  }
});

describe("tenant status (synthetic)", () => {
  it("returns tenant info for a valid token", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.tenantMe("synthetic-token");

    expect(resp.tenant_id).toBeTruthy();
    expect(resp.contact).toBeTruthy();
    expect(["email", "phone"]).toContain(resp.contact_type);
    expect(["active", "suspended", "revoked"]).toContain(resp.status);
    expect(resp.quota.limit_per_hour).toBeGreaterThan(0);
    expect(resp.quota.remaining).toBeGreaterThanOrEqual(0);
    expect(resp.quota.used).toBeGreaterThanOrEqual(0);
    expect(resp.quota.reset_at).toBeTruthy();
    expect(resp.default_pos).toBeTruthy();
    expect(resp.price_watches.active).toBeGreaterThanOrEqual(0);
    expect(resp.price_watches.total_created).toBeGreaterThanOrEqual(0);
  });

  it("rejects unauthenticated requests", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    try {
      await client.tenantMe("");
      expect.unreachable("should have thrown");
    } catch (err: any) {
      expect(err.code).toMatch(/unauthorized|invalid_request/);
    }
  });
});
