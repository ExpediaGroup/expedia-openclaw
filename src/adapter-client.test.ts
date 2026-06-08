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

import { describe, it, expect } from "vitest";
import { AdapterClient } from "./adapter-client.js";
import { AdapterError } from "./errors.js";
import type { PluginConfig } from "./types.js";

const baseConfig: PluginConfig = {
  adapter_url: "http://localhost:8080",
  default_pos_country: "US",
  request_timeout_ms: 5000,
  synthetic_mode: true,
};

function mockFetch(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): typeof globalThis.fetch {
  return async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  };
}

function capturingFetch(
  status: number,
  body: unknown,
): { fetch: typeof globalThis.fetch; captured: () => { url: string; init: RequestInit } } {
  let capturedUrl = "";
  let capturedInit: RequestInit = {};

  const fn: typeof globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    capturedUrl = String(input);
    capturedInit = init ?? {};
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    fetch: fn,
    captured: () => ({ url: capturedUrl, init: capturedInit }),
  };
}

describe("AdapterClient", () => {
  it("sends correct headers for authenticated requests", async () => {
    const { fetch, captured } = capturingFetch(200, { results: [] });
    const client = new AdapterClient(baseConfig, fetch);

    await client.searchStays("tok_abc", {
      destination: "Tokyo",
      check_in: "2026-06-01",
      check_out: "2026-06-05",
      adults: 2,
    });

    const { url, init } = captured();
    expect(url).toBe("http://localhost:8080/v1/search/stays");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer tok_abc");
    expect(headers["X-Adapter-Mode"]).toBe("synthetic");
    expect(headers["User-Agent"]).toContain("eg-travel-plugin");
  });

  it("omits X-Adapter-Mode when synthetic_mode is false", async () => {
    const config = { ...baseConfig, synthetic_mode: false };
    const { fetch, captured } = capturingFetch(200, { results: [] });
    const client = new AdapterClient(config, fetch);

    await client.searchFlights("tok", {
      origin: "SFO",
      destination: "NRT",
      departure_date: "2026-06-01",
      adults: 1,
    });

    const headers = captured().init.headers as Record<string, string>;
    expect(headers["X-Adapter-Mode"]).toBeUndefined();
  });

  it("does not send Authorization for signup", async () => {
    const { fetch, captured } = capturingFetch(200, {
      message: "Code sent",
      expires_in_seconds: 120,
    });
    const client = new AdapterClient(baseConfig, fetch);

    await client.signup({ contact: "user@test.com", contact_method: "email" });

    const headers = captured().init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("throws AdapterError on non-2xx with error envelope", async () => {
    const client = new AdapterClient(
      baseConfig,
      mockFetch(401, {
        error: { code: "unauthorized", message: "Bad token" },
      }),
    );

    try {
      await client.searchStays("bad_tok", {
        destination: "Paris",
        check_in: "2026-06-01",
        check_out: "2026-06-03",
        adults: 1,
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AdapterError);
      expect((err as AdapterError).code).toBe("unauthorized");
      expect((err as AdapterError).httpStatus).toBe(401);
    }
  });

  it("throws network_error on fetch failure", async () => {
    const failFetch: typeof globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const client = new AdapterClient(baseConfig, failFetch);

    try {
      await client.health();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AdapterError);
      expect((err as AdapterError).code).toBe("network_error");
      expect((err as AdapterError).message).toContain("ECONNREFUSED");
    }
  });

  it("strips trailing slashes from adapter_url", async () => {
    const config = { ...baseConfig, adapter_url: "http://localhost:8080///" };
    const { fetch, captured } = capturingFetch(200, { status: "ok" });
    const client = new AdapterClient(config, fetch);

    await client.health();
    expect(captured().url).toBe("http://localhost:8080/v1/health");
  });
});
