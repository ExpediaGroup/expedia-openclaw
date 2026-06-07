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

function tomorrow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function threeDaysOut(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  return d.toISOString().slice(0, 10);
}

describe("search stays (synthetic)", () => {
  it("returns synthetic results for a basic query", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchStays("synthetic-token", {
      destination: "New York",
      check_in: tomorrow(),
      check_out: threeDaysOut(),
      adults: 2,
    });

    expect(resp.request_id).toBeTruthy();
    expect(resp.check_in).toBe(tomorrow());
    expect(resp.check_out).toBe(threeDaysOut());
    expect(resp.nights).toBeGreaterThan(0);
    expect(resp.party.adults).toBe(2);
    expect(resp.currency).toBeTruthy();
    expect(resp.result_count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(resp.results)).toBe(true);
    expect(Array.isArray(resp.warnings)).toBe(true);
  });

  it("returns results with expected structure", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchStays("synthetic-token", {
      destination: "Tokyo",
      check_in: tomorrow(),
      check_out: threeDaysOut(),
      adults: 1,
      limit: 3,
    });

    if (resp.results.length > 0) {
      const result = resp.results[0];
      expect(result.property_id).toBeTruthy();
      expect(result.name).toBeTruthy();
      expect(["HOTEL", "RESORT", "VR"]).toContain(result.property_type);
      expect(result.price.amount_per_night).toBeGreaterThan(0);
      expect(result.price.currency).toBeTruthy();
      expect(result.deeplink_url).toBeTruthy();
      expect(result.guest_rating.score).toBeGreaterThanOrEqual(0);
      expect(result.amenities).toBeDefined();
    }
  });

  it("respects limit parameter", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchStays("synthetic-token", {
      destination: "Paris",
      check_in: tomorrow(),
      check_out: threeDaysOut(),
      adults: 2,
      limit: 2,
    });

    expect(resp.results.length).toBeLessThanOrEqual(2);
  });

  it("includes synthetic flag in response", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchStays("synthetic-token", {
      destination: "London",
      check_in: tomorrow(),
      check_out: threeDaysOut(),
      adults: 1,
    });

    expect(resp.synthetic).toBe(true);
  });

  it("rejects unauthorized requests", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    try {
      await client.searchStays("", {
        destination: "Rome",
        check_in: tomorrow(),
        check_out: threeDaysOut(),
        adults: 1,
      });
      expect.unreachable("should have thrown");
    } catch (err: any) {
      expect(err.code).toMatch(/unauthorized|invalid_request/);
    }
  });
});
