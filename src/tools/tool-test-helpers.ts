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

import { vi, expect } from "vitest";
import type { PluginConfig } from "../types.js";

export const TEST_CONFIG: PluginConfig = {
  adapter_url: "http://localhost:19999",
  default_pos_country: "US",
  default_currency: "USD",
  request_timeout_ms: 5000,
  synthetic_mode: true,
};

export const TEST_CREDENTIAL = {
  token: "tok",
  tenant_id: "t",
  contact: "a@b.com",
  contact_method: "email" as const,
  token_kind: "bearer" as const,
};

export function tomorrow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function mockFetchJson(body: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

export function assertConfigDefaultsSent(
  fakeFetch: ReturnType<typeof vi.fn>,
  result: { content: Array<{ text: string }> },
): void {
  expect(fakeFetch).toHaveBeenCalledOnce();
  const [, opts] = fakeFetch.mock.calls[0];
  const body = JSON.parse(opts.body as string);
  expect(body.pos_country).toBe("US");
  expect(body.currency).toBe("USD");
  expect(result.content[0].text).toContain("result_count");
}
