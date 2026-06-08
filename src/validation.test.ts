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
import {
  detectContactMethod,
  sanitizeVerificationCode,
  validateSearchStaysRequest,
  validateSearchFlightsRequest,
} from "./validation.js";
import type { SearchStaysRequest, SearchFlightsRequest } from "./types.js";

// --- Contact detection ---

describe("detectContactMethod", () => {
  it("detects email", () => {
    expect(detectContactMethod("user@example.com")).toEqual({
      ok: true,
      method: "email",
    });
  });

  it("detects phone in E.164", () => {
    expect(detectContactMethod("+15551234567")).toEqual({
      ok: true,
      method: "phone",
    });
  });

  it("rejects empty contact", () => {
    expect(detectContactMethod("").ok).toBe(false);
    expect(detectContactMethod("  ").ok).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = detectContactMethod("foo@");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not a valid email");
  });

  it("rejects invalid phone", () => {
    const result = detectContactMethod("+123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("E.164");
  });

  it("rejects ambiguous input", () => {
    const result = detectContactMethod("hello");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Cannot determine");
  });
});

// --- Verification code ---

describe("sanitizeVerificationCode", () => {
  it("accepts 6 digits", () => {
    expect(sanitizeVerificationCode("123456")).toEqual({
      ok: true,
      code: "123456",
    });
  });

  it("strips dashes and spaces", () => {
    expect(sanitizeVerificationCode("123-456")).toEqual({
      ok: true,
      code: "123456",
    });
    expect(sanitizeVerificationCode("12 34 56")).toEqual({
      ok: true,
      code: "123456",
    });
  });

  it("rejects too few digits", () => {
    expect(sanitizeVerificationCode("12345").ok).toBe(false);
  });

  it("rejects too many digits", () => {
    expect(sanitizeVerificationCode("1234567").ok).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(sanitizeVerificationCode("12345a").ok).toBe(false);
  });
});

// --- Stay search validation ---

function validStayReq(
  overrides: Partial<SearchStaysRequest> = {},
): SearchStaysRequest {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 2);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return {
    destination: "Tokyo",
    check_in: fmt(tomorrow),
    check_out: fmt(dayAfter),
    adults: 2,
    ...overrides,
  };
}

describe("validateSearchStaysRequest", () => {
  it("accepts valid request", () => {
    expect(validateSearchStaysRequest(validStayReq())).toBeNull();
  });

  it("rejects short destination", () => {
    const err = validateSearchStaysRequest(validStayReq({ destination: "X" }));
    expect(err?.field).toBe("destination");
  });

  it("rejects invalid date format", () => {
    const err = validateSearchStaysRequest(
      validStayReq({ check_in: "2026/06/01" }),
    );
    expect(err?.field).toBe("check_in");
  });

  it("rejects check_out before check_in", () => {
    const req = validStayReq();
    const err = validateSearchStaysRequest({
      ...req,
      check_in: req.check_out,
      check_out: req.check_in,
    });
    expect(err?.field).toBe("check_out");
    expect(err?.message).toContain("must be before");
  });

  it("rejects stay longer than 30 nights", () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const far = new Date(tomorrow);
    far.setUTCDate(far.getUTCDate() + 35);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const err = validateSearchStaysRequest(
      validStayReq({ check_in: fmt(tomorrow), check_out: fmt(far) }),
    );
    expect(err?.message).toContain("30-night maximum");
  });

  it("rejects invalid adult count", () => {
    expect(validateSearchStaysRequest(validStayReq({ adults: 0 }))?.field).toBe(
      "adults",
    );
    expect(validateSearchStaysRequest(validStayReq({ adults: 8 }))?.field).toBe(
      "adults",
    );
  });

  it("rejects invalid child age", () => {
    const err = validateSearchStaysRequest(
      validStayReq({ children_ages: [5, 19] }),
    );
    expect(err?.field).toBe("children_ages");
    expect(err?.message).toContain("19");
  });

  it("rejects inverted star rating", () => {
    const err = validateSearchStaysRequest(
      validStayReq({ filters: { star_rating: { min: 5, max: 3 } } }),
    );
    expect(err?.field).toBe("filters.star_rating");
  });

  it("rejects inverted price range", () => {
    const err = validateSearchStaysRequest(
      validStayReq({ filters: { price_min: 500, price_max: 100 } }),
    );
    expect(err?.field).toBe("filters.price");
  });

  it("accepts limit at the 100 upper bound", () => {
    expect(validateSearchStaysRequest(validStayReq({ limit: 100 }))).toBeNull();
  });

  it("rejects limit above the 100 upper bound", () => {
    expect(
      validateSearchStaysRequest(validStayReq({ limit: 101 }))?.field,
    ).toBe("limit");
  });

  it("accepts radius_km in range", () => {
    expect(
      validateSearchStaysRequest(validStayReq({ radius_km: 25 })),
    ).toBeNull();
  });

  it("rejects radius_km above 200", () => {
    expect(
      validateSearchStaysRequest(validStayReq({ radius_km: 201 }))?.field,
    ).toBe("radius_km");
  });

  it("rejects radius_km below 1", () => {
    expect(
      validateSearchStaysRequest(validStayReq({ radius_km: 0 }))?.field,
    ).toBe("radius_km");
  });
});

// --- Flight search validation ---

function validFlightReq(
  overrides: Partial<SearchFlightsRequest> = {},
): SearchFlightsRequest {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return {
    origin: "SFO",
    destination: "NRT",
    departure_date: fmt(tomorrow),
    adults: 1,
    ...overrides,
  };
}

describe("validateSearchFlightsRequest", () => {
  it("accepts valid one-way request", () => {
    expect(validateSearchFlightsRequest(validFlightReq())).toBeNull();
  });

  it("rejects same origin and destination", () => {
    const err = validateSearchFlightsRequest(
      validFlightReq({ origin: "SFO", destination: "sfo" }),
    );
    expect(err?.message).toContain("cannot be the same");
  });

  it("rejects return date before departure", () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const dep = new Date();
    dep.setUTCDate(dep.getUTCDate() + 5);
    const ret = new Date();
    ret.setUTCDate(ret.getUTCDate() + 3);

    const err = validateSearchFlightsRequest(
      validFlightReq({ departure_date: fmt(dep), return_date: fmt(ret) }),
    );
    expect(err?.field).toBe("return_date");
  });

  it("rejects infants exceeding adults", () => {
    const err = validateSearchFlightsRequest(
      validFlightReq({ adults: 1, infants_in_lap: 2 }),
    );
    expect(err?.field).toBe("infants_in_lap");
    expect(err?.message).toContain("cannot exceed adults");
  });

  it("rejects unknown cabin class", () => {
    const err = validateSearchFlightsRequest(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validFlightReq({ cabin_class: "COMFORT" as any }),
    );
    expect(err?.field).toBe("cabin_class");
  });

  it("rejects max_stops out of range", () => {
    const err = validateSearchFlightsRequest(
      validFlightReq({ filters: { max_stops: 6 } }),
    );
    expect(err?.field).toBe("filters.max_stops");
  });
});
