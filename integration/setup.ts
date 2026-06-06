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

import { AdapterClient } from "../src/adapter-client.js";
import type { PluginConfig } from "../src/types.js";

export const ADAPTER_URL = process.env.ADAPTER_URL ?? "http://localhost:8080";

export const integrationConfig: PluginConfig = {
  adapter_url: ADAPTER_URL,
  default_pos_country: "US",
  default_currency: "USD",
  request_timeout_ms: 15000,
  synthetic_mode: true,
};

export function createClient(): AdapterClient {
  return new AdapterClient(integrationConfig);
}

export async function adapterAvailable(): Promise<boolean> {
  try {
    const client = createClient();
    await client.health();
    return true;
  } catch {
    return false;
  }
}
