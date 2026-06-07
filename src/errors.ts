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

import type { AdapterErrorEnvelope, ContactMethod } from "./types.js";

export class AdapterError extends Error {
  code: string;
  httpStatus: number;
  requestId?: string;
  traceId?: string;
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
  details?: Record<string, unknown>;

  constructor(envelope: AdapterErrorEnvelope["error"], httpStatus: number) {
    super(envelope.message);
    this.name = "AdapterError";
    this.code = envelope.code;
    this.httpStatus = httpStatus;
    this.requestId = envelope.request_id;
    this.traceId = envelope.trace_id;
    this.retryAfterSeconds = envelope.retry_after_seconds;
    this.attemptsRemaining =
      typeof envelope.details?.attempts_remaining === "number"
        ? envelope.details.attempts_remaining
        : undefined;
    this.details = envelope.details;
  }
}

function formatRetryAfter(seconds: number | undefined): string {
  if (seconds == null || seconds <= 0) return "a few moments";
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// Treat anything that smells like an auth failure as a re-auth opportunity.
// The upstream adapter may return any of several codes ("unauthorized",
// "token_expired", "token_invalid", "forbidden", "auth_failed"…) or just a
// bare HTTP 401. Rather than coordinating an exact code per case, match
// the shape so the skill always has a single recovery path.
export function isAuthFailure(error: AdapterError): boolean {
  if (error.httpStatus === 401 || error.httpStatus === 403) return true;
  const code = error.code.toLowerCase();
  const AUTH_FAILURE_CODES = [
    "unauthorized",
    "forbidden",
    "token_expired",
    "token_invalid",
    "token_missing",
    "auth_failed",
    "authentication_required"
  ];
  return AUTH_FAILURE_CODES.includes(code);
}

export interface CachedContact {
  contact: string;
  contact_method: ContactMethod;
}

export function formatErrorForModel(
  error: AdapterError,
  adapterUrl?: string,
  cachedContact?: CachedContact,
): string {
  const rid = error.requestId ? ` (request_id: ${error.requestId})` : "";

  if (isAuthFailure(error)) {
    if (cachedContact) {
      return (
        `Your EG Travel access needs a fresh token (${error.code}). ` +
        `The cached contact is **${cachedContact.contact}** (${cachedContact.contact_method}). ` +
        `Tell the user briefly that their access expired, then call \`eg_travel_signup\` ` +
        `with this cached contact — do NOT ask the user for their contact again. ` +
        `Once they paste the new 6-digit code and \`eg_travel_verify\` succeeds, ` +
        `automatically re-run the original query.`
      );
    }
    return (
      `Your EG Travel access needs setup (${error.code}). ` +
      "No cached contact is available — ask the user for an email address and call `eg_travel_signup`."
    );
  }

  switch (error.code) {
    case "tenant_suspended":
      return "This account has been suspended. The user should contact support.";

    case "tenant_quota_exceeded":
      return (
        `Search quota reached. You can try again in ${formatRetryAfter(error.retryAfterSeconds)}. ` +
        "Suggest the user refine their search criteria."
      );

    case "global_quota_exceeded":
      return `The service is at capacity. Try again in ${formatRetryAfter(error.retryAfterSeconds)}.`;

    case "invalid_request":
      return `The adapter rejected the request: ${error.message}. Fix the input and retry.`;

    case "destination_ambiguous": {
      const candidates = error.details?.candidates;
      const list = Array.isArray(candidates)
        ? candidates.map((c) => `  - ${c}`).join("\n")
        : "";
      return (
        "Multiple destinations matched. Ask the user to clarify:" +
        (list ? `\n${list}` : "")
      );
    }

    case "code_invalid": {
      const remaining =
        error.attemptsRemaining != null
          ? ` ${error.attemptsRemaining} attempts remaining.`
          : "";
      return `The verification code is incorrect.${remaining}`;
    }

    case "code_expired":
      return (
        "The verification code has expired (2-minute window). " +
        "Call `eg_travel_signup` to request a new one."
      );

    case "invalid_email":
      return "The email address format is invalid. Ask the user to check and try again.";

    case "invalid_phone":
      return "The phone number format is invalid. Use E.164 format (+15551234567).";

    case "signup_rate_limited":
      return `Too many signup attempts. Try again in ${formatRetryAfter(error.retryAfterSeconds)}.`;

    case "code_attempts_exceeded":
      return `Too many incorrect code attempts. Request a new code in ${formatRetryAfter(error.retryAfterSeconds)}.`;

    case "disposable_email":
      return "Disposable email addresses are not allowed. Use a permanent email address.";

    case "upstream_error":
      return "The upstream travel service is temporarily unavailable. Try again in a few minutes.";

    case "upstream_unavailable":
      return `The upstream travel service is temporarily unavailable. Try again in ${formatRetryAfter(error.retryAfterSeconds)}.`;

    case "upstream_timeout":
      return "The upstream travel service timed out. Try again in a few minutes.";

    case "internal_error":
      return `An internal error occurred${rid}. Try again; if it persists, the user should report it.`;

    case "network_error":
      return `Cannot reach the adapter at ${adapterUrl ?? "the configured URL"}. Verify the adapter is running and the URL is correct.`;

    default:
      return `Unexpected error (${error.code})${rid}: ${error.message}`;
  }
}
