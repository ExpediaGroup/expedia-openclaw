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

import type { PluginConfig } from "./types.js";

const DEFAULTS: PluginConfig = {
  adapter_url: "https://www.expedia.com/product/expedia-in-openclaw",
  default_pos_country: "US",
  request_timeout_ms: 12_000,
  synthetic_mode: false,
};

export function readPluginConfig(raw: unknown): PluginConfig {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULTS };
  }

  const cfg = raw as Record<string, unknown>;

  const adapterUrl =
    typeof cfg.adapter_url === "string" && cfg.adapter_url.length > 0
      ? cfg.adapter_url
      : DEFAULTS.adapter_url;

  const defaultPosCountry =
    typeof cfg.default_pos_country === "string" &&
    cfg.default_pos_country.length > 0
      ? cfg.default_pos_country
      : DEFAULTS.default_pos_country;

  const defaultCurrency =
    typeof cfg.default_currency === "string" && cfg.default_currency.length > 0
      ? cfg.default_currency
      : undefined;

  let requestTimeoutMs = DEFAULTS.request_timeout_ms;
  if (typeof cfg.request_timeout_ms === "number") {
    requestTimeoutMs = Math.max(1000, Math.min(60_000, cfg.request_timeout_ms));
  }

  const syntheticMode =
    typeof cfg.synthetic_mode === "boolean"
      ? cfg.synthetic_mode
      : DEFAULTS.synthetic_mode;

  return {
    adapter_url: adapterUrl,
    default_pos_country: defaultPosCountry,
    default_currency: defaultCurrency,
    request_timeout_ms: requestTimeoutMs,
    synthetic_mode: syntheticMode,
  };
}
