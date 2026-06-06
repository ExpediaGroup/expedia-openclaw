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

function fiveDaysOut(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 5);
  return d.toISOString().slice(0, 10);
}

describe("search flights (synthetic)", () => {
  it("returns synthetic results for a one-way flight", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchFlights("synthetic-token", {
      origin: "SFO",
      destination: "NRT",
      departure_date: tomorrow(),
      adults: 1,
    });

    expect(resp.request_id).toBeTruthy();
    expect(resp.departure_date).toBe(tomorrow());
    expect(resp.return_date).toBeUndefined();
    expect(resp.party.adults).toBe(1);
    expect(resp.currency).toBeTruthy();
    expect(resp.result_count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(resp.results)).toBe(true);
  });

  it("returns results for a round-trip flight", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchFlights("synthetic-token", {
      origin: "LAX",
      destination: "LHR",
      departure_date: tomorrow(),
      return_date: fiveDaysOut(),
      adults: 2,
    });

    expect(resp.departure_date).toBe(tomorrow());
    expect(resp.return_date).toBe(fiveDaysOut());
    expect(resp.party.adults).toBe(2);
  });

  it("returns results with expected structure", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchFlights("synthetic-token", {
      origin: "JFK",
      destination: "CDG",
      departure_date: tomorrow(),
      adults: 1,
      limit: 3,
    });

    if (resp.results.length > 0) {
      const result = resp.results[0];
      expect(result.offer_id).toBeTruthy();
      expect(result.airline.code).toBeTruthy();
      expect(result.airline.name).toBeTruthy();
      expect(result.price.amount_total).toBeGreaterThan(0);
      expect(result.price.currency).toBeTruthy();
      expect(result.outbound).toBeDefined();
      expect(result.outbound.duration_minutes).toBeGreaterThan(0);
      expect(result.outbound.segments.length).toBeGreaterThan(0);
      expect(result.deeplink_url).toBeTruthy();
    }
  });

  it("respects limit parameter", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchFlights("synthetic-token", {
      origin: "ORD",
      destination: "DFW",
      departure_date: tomorrow(),
      adults: 1,
      limit: 1,
    });

    expect(resp.results.length).toBeLessThanOrEqual(1);
  });

  it("includes synthetic flag in response", async ({ skip }) => {
    if (!available) skip();
    const client = createClient();

    const resp = await client.searchFlights("synthetic-token", {
      origin: "SEA",
      destination: "HND",
      departure_date: tomorrow(),
      adults: 1,
    });

    expect(resp.synthetic).toBe(true);
  });
});
