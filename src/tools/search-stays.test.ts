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
import { createSearchStaysTool } from "./search-stays.js";
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

function dayAfterTomorrow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
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

describe("search_stays tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes correct metadata", () => {
    const tool = createSearchStaysTool(config);
    expect(tool.name).toBe("search_stays");
    expect(tool.label).toBe("Search Stays");
    expect(tool.description).toContain("hotels");
  });

  it("returns signup prompt when no credentials", async () => {
    mockReadCredential.mockReturnValue(null);
    const tool = createSearchStaysTool(config);

    const result = await tool.execute({
      destination: "Tokyo",
      check_in: tomorrow(),
      check_out: dayAfterTomorrow(),
      adults: 2,
    });

    expect(result.content[0].text).toContain("eg_travel_signup");
    expect(result.content[0].text).toContain("No credentials");
  });

  it("rejects empty destination without calling adapter", async () => {
    mockReadCredential.mockReturnValue(credential);

    const tool = createSearchStaysTool(config);
    const result = await tool.execute({
      destination: "X",
      check_in: tomorrow(),
      check_out: dayAfterTomorrow(),
      adults: 2,
    });

    expect(result.content[0].text).toContain("Validation error");
    expect(result.content[0].text).toContain("destination");
  });

  it("rejects whitespace-only destination", async () => {
    mockReadCredential.mockReturnValue(credential);

    const tool = createSearchStaysTool(config);
    const result = await tool.execute({
      destination: "   ",
      check_in: tomorrow(),
      check_out: dayAfterTomorrow(),
      adults: 2,
    });

    expect(result.content[0].text).toContain("Validation error");
    expect(result.content[0].text).toContain("destination");
  });

  it("rejects check_out before check_in", async () => {
    mockReadCredential.mockReturnValue(credential);

    const tool = createSearchStaysTool(config);
    const result = await tool.execute({
      destination: "Tokyo",
      check_in: dayAfterTomorrow(),
      check_out: tomorrow(),
      adults: 2,
    });

    expect(result.content[0].text).toContain("Validation error");
    expect(result.content[0].text).toContain("must be before");
  });

  it("rejects stays longer than 30 nights", async () => {
    mockReadCredential.mockReturnValue(credential);

    const d1 = new Date();
    d1.setUTCDate(d1.getUTCDate() + 1);
    const d2 = new Date(d1);
    d2.setUTCDate(d2.getUTCDate() + 35);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const tool = createSearchStaysTool(config);
    const result = await tool.execute({
      destination: "Tokyo",
      check_in: fmt(d1),
      check_out: fmt(d2),
      adults: 2,
    });

    expect(result.content[0].text).toContain("30-night maximum");
  });

  it("applies config defaults for pos_country and currency", async () => {
    mockReadCredential.mockReturnValue(credential);

    const fakeFetch = mockFetchJson({
      request_id: "r1",
      trace_id: "t1",
      cached: false,
      cache_ttl_seconds: 300,
      check_in: tomorrow(),
      check_out: dayAfterTomorrow(),
      nights: 2,
      party: { adults: 2, children: 0 },
      currency: "USD",
      result_count: 0,
      total_available: 0,
      warnings: [],
      results: [],
    });

    const tool = createSearchStaysTool(config, fakeFetch);
    const result = await tool.execute({
      destination: "Tokyo",
      check_in: tomorrow(),
      check_out: dayAfterTomorrow(),
      adults: 2,
    });

    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, opts] = (fakeFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.pos_country).toBe("US");
    expect(body.currency).toBe("USD");
    expect(result.content[0].text).toContain("result_count");
  });

  it("maps 401 to signup prompt", async () => {
    mockReadCredential.mockReturnValue(credential);

    const fakeFetch = mockFetchJson(
      { error: { code: "unauthorized", message: "Invalid token" } },
      401,
    );

    const tool = createSearchStaysTool(config, fakeFetch);
    const result = await tool.execute({
      destination: "Tokyo",
      check_in: tomorrow(),
      check_out: dayAfterTomorrow(),
      adults: 2,
    });

    expect(result.content[0].text).toContain("eg_travel_signup");
  });
});
