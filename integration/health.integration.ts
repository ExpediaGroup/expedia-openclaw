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
    console.log(`Skipping integration tests — adapter not reachable at ${ADAPTER_URL}`);
  }
});

describe("adapter health", () => {
  it("returns ok status", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();
    const resp = await client.health();
    expect(resp.status).toMatch(/^(ok|degraded)$/);
    expect(resp.version).toBeTruthy();
    expect(resp.uptime_seconds).toBeGreaterThanOrEqual(0);
  });
});
