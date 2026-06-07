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

import type {
  PluginConfig,
  SignupRequest,
  SignupResponse,
  VerificationRequest,
  VerificationResponse,
  SearchStaysRequest,
  SearchStaysResponse,
  SearchFlightsRequest,
  SearchFlightsResponse,
  TenantStatusResponse,
  HealthResponse,
  AdapterErrorEnvelope,
} from "./types.js";
import { AdapterError } from "./errors.js";
import { logger } from "./logger.js";
import { upgradeThumbnailUrl } from "./thumbnails.js";
import { PLUGIN_VERSION } from "./version.js";

const USER_AGENT = `eg-travel-plugin/${PLUGIN_VERSION}`;

export class AdapterClient {
  private readonly config: PluginConfig;
  private readonly fetch: typeof globalThis.fetch;

  constructor(config: PluginConfig, fetchFn?: typeof globalThis.fetch) {
    this.config = config;
    this.fetch = fetchFn ?? globalThis.fetch;
  }

  private url(path: string): string {
    const base = this.config.adapter_url.replace(/\/+$/, "");
    return `${base}${path}`;
  }

  private headers(token?: string): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    };
    if (token) h["Authorization"] = `Bearer ${token}`;
    if (this.config.synthetic_mode) h["X-Adapter-Mode"] = "synthetic";
    return h;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<T> {
    const start = Date.now();
    logger.debug("adapter request", { method, path });

    let res: Response;
    try {
      res = await this.fetch(this.url(path), {
        method,
        headers: this.headers(token),
        body: body != null ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.request_timeout_ms),
      });
    } catch (err: unknown) {
      const duration_ms = Date.now() - start;
      logger.error("adapter network error", { method, path, duration_ms, error: err instanceof Error ? err.message : String(err) });
      throw new AdapterError(
        {
          code: "network_error",
          message:
            err instanceof Error ? err.message : "Network request failed",
        },
        0,
      );
    }

    const duration_ms = Date.now() - start;

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      logger.error("adapter invalid json", { method, path, status: res.status, duration_ms });
      if (!res.ok) {
        throw new AdapterError(
          { code: "internal_error", message: `HTTP ${res.status} with non-JSON body` },
          res.status,
        );
      }
      throw new AdapterError(
        { code: "internal_error", message: "Invalid JSON in response" },
        res.status,
      );
    }

    if (!res.ok) {
      const envelope = json as AdapterErrorEnvelope;
      const code = envelope?.error?.code ?? "internal_error";
      logger.warn("adapter error response", { method, path, status: res.status, code, duration_ms });
      if (envelope?.error?.code) {
        throw new AdapterError(envelope.error, res.status);
      }
      throw new AdapterError(
        { code: "internal_error", message: `HTTP ${res.status}` },
        res.status,
      );
    }

    logger.info("adapter response", { method, path, status: res.status, duration_ms });
    return json as T;
  }

  async health(): Promise<HealthResponse> {
    return this.request("GET", "/v1/health");
  }

  async signup(req: SignupRequest): Promise<SignupResponse> {
    return this.request("POST", "/v1/signup", req);
  }

  async signupVerify(req: VerificationRequest): Promise<VerificationResponse> {
    return this.request("POST", "/v1/signup/verify", req);
  }

  async searchStays(
    token: string,
    req: SearchStaysRequest,
  ): Promise<SearchStaysResponse> {
    const resp = await this.request<SearchStaysResponse>(
      "POST",
      "/v1/search/stays",
      req,
      token,
    );
    // Expedia CDN returns _t (70x70) thumbnails by default; upgrade to _y
    // (~500px) so the model has a card-sized image available when rendering.
    if (Array.isArray(resp.results)) {
      for (const r of resp.results) {
        if (typeof r.thumbnail_url === "string" && r.thumbnail_url.length > 0) {
          r.thumbnail_url = upgradeThumbnailUrl(r.thumbnail_url);
        }
      }
    }
    return resp;
  }

  async searchFlights(
    token: string,
    req: SearchFlightsRequest,
  ): Promise<SearchFlightsResponse> {
    return this.request("POST", "/v1/search/flights", req, token);
  }

  async tenantMe(token: string): Promise<TenantStatusResponse> {
    return this.request("GET", "/v1/tenant/me", undefined, token);
  }
}
