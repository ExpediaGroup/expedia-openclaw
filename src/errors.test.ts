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
import { AdapterError, formatErrorForModel, isAuthFailure } from "./errors.js";

function makeError(
  code: string,
  overrides: Partial<{
    message: string;
    httpStatus: number;
    retry_after_seconds: number;
    request_id: string;
    details: Record<string, unknown>;
  }> = {},
): AdapterError {
  return new AdapterError(
    {
      code,
      message: overrides.message ?? "test error",
      retry_after_seconds: overrides.retry_after_seconds,
      request_id: overrides.request_id,
      details: overrides.details,
    },
    overrides.httpStatus ?? 500,
  );
}

describe("formatErrorForModel", () => {
  it("maps unauthorized to signup prompt", () => {
    const msg = formatErrorForModel(
      makeError("unauthorized", { httpStatus: 401 }),
    );
    expect(msg).toContain("eg_travel_signup");
    expect(msg).toContain("email address");
  });

  it("maps token_expired to re-auth prompt", () => {
    const msg = formatErrorForModel(
      makeError("token_expired", { httpStatus: 401 }),
    );
    expect(msg).toContain("eg_travel_signup");
    expect(msg).toContain("cached contact");
  });

  it("maps tenant_quota_exceeded with retry timing", () => {
    const msg = formatErrorForModel(
      makeError("tenant_quota_exceeded", {
        httpStatus: 429,
        retry_after_seconds: 480,
      }),
    );
    expect(msg).toContain("8 minutes");
    expect(msg).not.toContain("480");
  });

  it("formats short retry as seconds", () => {
    const msg = formatErrorForModel(
      makeError("global_quota_exceeded", {
        httpStatus: 429,
        retry_after_seconds: 30,
      }),
    );
    expect(msg).toContain("30 seconds");
  });

  it("maps code_invalid with attempts remaining", () => {
    const msg = formatErrorForModel(
      makeError("code_invalid", {
        httpStatus: 400,
        details: { attempts_remaining: 2 },
      }),
    );
    expect(msg).toContain("incorrect");
    expect(msg).toContain("2 attempts remaining");
  });

  it("maps code_expired to re-signup", () => {
    const msg = formatErrorForModel(
      makeError("code_expired", { httpStatus: 400 }),
    );
    expect(msg).toContain("2-minute");
    expect(msg).toContain("eg_travel_signup");
  });

  it("maps destination_ambiguous with candidates", () => {
    const msg = formatErrorForModel(
      makeError("destination_ambiguous", {
        httpStatus: 400,
        details: { candidates: ["Portland, OR", "Portland, ME"] },
      }),
    );
    expect(msg).toContain("Portland, OR");
    expect(msg).toContain("Portland, ME");
  });

  it("maps network_error with adapter URL", () => {
    const msg = formatErrorForModel(
      makeError("network_error", { httpStatus: 0 }),
      "http://localhost:8080",
    );
    expect(msg).toContain("localhost:8080");
  });

  it("includes request_id for internal_error", () => {
    const msg = formatErrorForModel(
      makeError("internal_error", {
        httpStatus: 500,
        request_id: "req_abc123",
      }),
    );
    expect(msg).toContain("req_abc123");
  });

  it("maps code_attempts_exceeded with retry", () => {
    const msg = formatErrorForModel(
      makeError("code_attempts_exceeded", {
        httpStatus: 429,
        retry_after_seconds: 300,
      }),
    );
    expect(msg).toContain("5 minutes");
    expect(msg).toContain("new code");
  });

  it("maps disposable_email to permanent email guidance", () => {
    const msg = formatErrorForModel(
      makeError("disposable_email", { httpStatus: 400 }),
    );
    expect(msg).toContain("Disposable");
    expect(msg).toContain("permanent");
  });

  it("maps upstream_timeout", () => {
    const msg = formatErrorForModel(
      makeError("upstream_timeout", { httpStatus: 504 }),
    );
    expect(msg).toContain("timed out");
  });

  it("maps upstream_unavailable with retry", () => {
    const msg = formatErrorForModel(
      makeError("upstream_unavailable", {
        httpStatus: 503,
        retry_after_seconds: 60,
      }),
    );
    expect(msg).toContain("1 minute");
  });

  it("handles unknown error codes gracefully", () => {
    const msg = formatErrorForModel(
      makeError("some_new_code", { message: "oops" }),
    );
    expect(msg).toContain("some_new_code");
    expect(msg).toContain("oops");
  });

  it("surfaces cached contact on auth failure", () => {
    const msg = formatErrorForModel(
      makeError("unauthorized", { httpStatus: 401 }),
      undefined,
      { contact: "alice@example.com", contact_method: "email" },
    );
    expect(msg).toContain("alice@example.com");
    expect(msg).toContain("do NOT ask the user");
  });

  it("recognizes token_expired as auth failure with cached contact", () => {
    const msg = formatErrorForModel(
      makeError("token_expired", { httpStatus: 401 }),
      undefined,
      { contact: "+15551234567", contact_method: "phone" },
    );
    expect(msg).toContain("+15551234567");
    expect(msg).toContain("eg_travel_signup");
  });

  it("recognizes a 403 with arbitrary code as auth failure", () => {
    const msg = formatErrorForModel(
      makeError("forbidden_resource", { httpStatus: 403 }),
      undefined,
      { contact: "alice@example.com", contact_method: "email" },
    );
    expect(msg).toContain("alice@example.com");
  });
});

describe("isAuthFailure", () => {
  it("matches HTTP 401", () => {
    expect(isAuthFailure(makeError("anything", { httpStatus: 401 }))).toBe(
      true,
    );
  });

  it("matches HTTP 403", () => {
    expect(isAuthFailure(makeError("anything", { httpStatus: 403 }))).toBe(
      true,
    );
  });

  it("matches code containing 'auth'", () => {
    expect(isAuthFailure(makeError("auth_failed", { httpStatus: 500 }))).toBe(
      true,
    );
  });

  it("matches code containing 'token'", () => {
    expect(isAuthFailure(makeError("token_invalid", { httpStatus: 500 }))).toBe(
      true,
    );
  });

  it("matches the literal 'forbidden' code", () => {
    expect(isAuthFailure(makeError("forbidden", { httpStatus: 500 }))).toBe(
      true,
    );
  });

  it("does not match unrelated errors", () => {
    expect(
      isAuthFailure(makeError("internal_error", { httpStatus: 500 })),
    ).toBe(false);
    expect(
      isAuthFailure(makeError("invalid_request", { httpStatus: 400 })),
    ).toBe(false);
  });
});
