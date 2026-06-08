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
import { createSearchFlightsTool } from "./search-flights.js";
import type { PluginConfig } from "../types.js";

vi.mock("../credential-store.js", () => ({
  readCredential: vi.fn(),
}));

import { readCredential } from "../credential-store.js";
const mockReadCredential = vi.mocked(readCredential);

const config: PluginConfig = {
  adapter_url: "http://localhost:19999",
  default_pos_country: "US",
  default_currency: "USD",
  request_timeout_ms: 5000,
  synthetic_mode: true,
};

function tomorrow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const credential = {
  token: "tok",
  tenant_id: "t",
  contact: "a@b.com",
  contact_method: "email" as const,
  token_kind: "bearer" as const,
};

function mockFetchJson(body: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("search_flights tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes correct metadata", () => {
    const tool = createSearchFlightsTool(config);
    expect(tool.name).toBe("search_flights");
    expect(tool.label).toBe("Search Flights");
    expect(tool.description).toContain("flights");
  });

  it("returns signup prompt when no credentials", async () => {
    mockReadCredential.mockReturnValue(null);
    const tool = createSearchFlightsTool(config);

    const result = await tool.execute({
      origin: "SFO",
      destination: "NRT",
      departure_date: tomorrow(),
      adults: 1,
    });

    expect(result.content[0].text).toContain("eg_travel_signup");
    expect(result.content[0].text).toContain("No credentials");
  });

  it("rejects same origin and destination", async () => {
    mockReadCredential.mockReturnValue(credential);

    const tool = createSearchFlightsTool(config);
    const result = await tool.execute({
      origin: "SFO",
      destination: "sfo",
      departure_date: tomorrow(),
      adults: 1,
    });

    expect(result.content[0].text).toContain("cannot be the same");
  });

  it("rejects whitespace-only origin", async () => {
    mockReadCredential.mockReturnValue(credential);

    const tool = createSearchFlightsTool(config);
    const result = await tool.execute({
      origin: "   ",
      destination: "NRT",
      departure_date: tomorrow(),
      adults: 1,
    });

    expect(result.content[0].text).toContain("Validation error");
    expect(result.content[0].text).toContain("Origin");
  });

  it("rejects infants exceeding adults", async () => {
    mockReadCredential.mockReturnValue(credential);

    const tool = createSearchFlightsTool(config);
    const result = await tool.execute({
      origin: "SFO",
      destination: "NRT",
      departure_date: tomorrow(),
      adults: 1,
      infants_in_lap: 2,
    });

    expect(result.content[0].text).toContain("cannot exceed adults");
  });

  it("rejects unknown cabin class", async () => {
    mockReadCredential.mockReturnValue(credential);

    const tool = createSearchFlightsTool(config);
    const result = await tool.execute({
      origin: "SFO",
      destination: "NRT",
      departure_date: tomorrow(),
      adults: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cabin_class: "COMFORT" as any,
    });

    expect(result.content[0].text).toContain("Unknown cabin class");
  });

  it("passes validation and sends request with config defaults", async () => {
    mockReadCredential.mockReturnValue(credential);

    const fakeFetch = mockFetchJson({
      request_id: "r1",
      trace_id: "t1",
      cached: false,
      cache_ttl_seconds: 300,
      origin: { code: "SFO", label: "San Francisco" },
      destination: { code: "NRT", label: "Tokyo Narita" },
      departure_date: tomorrow(),
      party: { adults: 1, children: 0, infants_lap: 0, infants_seat: 0 },
      currency: "USD",
      result_count: 0,
      warnings: [],
      results: [],
    });

    const tool = createSearchFlightsTool(config, fakeFetch);
    const result = await tool.execute({
      origin: "SFO",
      destination: "NRT",
      departure_date: tomorrow(),
      adults: 1,
    });

    expect(fakeFetch).toHaveBeenCalledOnce();
    const [_url, opts] = (fakeFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.pos_country).toBe("US");
    expect(body.currency).toBe("USD");
    expect(result.content[0].text).toContain("result_count");
  });
});
