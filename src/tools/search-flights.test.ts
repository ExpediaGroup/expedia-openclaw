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
import {
  TEST_CONFIG, TEST_CREDENTIAL, tomorrow, mockFetchJson, assertConfigDefaultsSent,
} from "./tool-test-helpers.js";

vi.mock("../credential-store.js");

import { readCredential } from "../credential-store.js";
const mockReadCredential = vi.mocked(readCredential);

describe("search_flights tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes correct metadata", () => {
    const tool = createSearchFlightsTool(TEST_CONFIG);
    expect(tool.name).toBe("search_flights");
    expect(tool.label).toBe("Search Flights");
    expect(tool.description).toContain("flights");
  });

  it("returns signup prompt when no credentials", async () => {
    mockReadCredential.mockReturnValue(null);
    const tool = createSearchFlightsTool(TEST_CONFIG);

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
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const tool = createSearchFlightsTool(TEST_CONFIG);
    const result = await tool.execute({
      origin: "SFO",
      destination: "sfo",
      departure_date: tomorrow(),
      adults: 1,
    });

    expect(result.content[0].text).toContain("cannot be the same");
  });

  it("rejects whitespace-only origin", async () => {
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const tool = createSearchFlightsTool(TEST_CONFIG);
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
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const tool = createSearchFlightsTool(TEST_CONFIG);
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
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

    const tool = createSearchFlightsTool(TEST_CONFIG);
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
    mockReadCredential.mockReturnValue(TEST_CREDENTIAL);

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

    const tool = createSearchFlightsTool(TEST_CONFIG, fakeFetch);
    const result = await tool.execute({
      origin: "SFO",
      destination: "NRT",
      departure_date: tomorrow(),
      adults: 1,
    });

    assertConfigDefaultsSent(fakeFetch as ReturnType<typeof vi.fn>, result);
  });
});
