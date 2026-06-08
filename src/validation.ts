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
  ContactMethod,
  SearchStaysRequest,
  SearchFlightsRequest,
} from "./types.js";

export interface ValidationError {
  field: string;
  message: string;
}

// --- Contact validation ---

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailInput(email: string): string | null {
  if (!EMAIL_RE.test(email)) {
    return `'${email}' is not a valid email address`;
  }
  return null;
}
const PHONE_E164_RE = /^\+\d{7,15}$/;

export type ContactResult =
  | { ok: true; method: ContactMethod }
  | { ok: false; error: string };

export function detectContactMethod(contact: string): ContactResult {
  if (contact === "" || contact.trim().length === 0) {
    return { ok: false, error: "An email address or phone number is required" };
  }
  const trimmed = contact.trim();
  if (trimmed.startsWith("+")) {
    if (PHONE_E164_RE.test(trimmed)) return { ok: true, method: "phone" };
    return {
      ok: false,
      error: `'${trimmed}' is not a valid phone number — use E.164 format (+15551234567)`,
    };
  }
  if (trimmed.includes("@")) {
    if (EMAIL_RE.test(trimmed)) return { ok: true, method: "email" };
    return { ok: false, error: `'${trimmed}' is not a valid email address` };
  }
  return {
    ok: false,
    error:
      "Cannot determine contact method — provide an email address or phone number in E.164 format",
  };
}

export type CodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export function sanitizeVerificationCode(raw: string): CodeResult {
  const cleaned = raw.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(cleaned)) {
    return {
      ok: false,
      error: `Code must be exactly 6 digits (got ${cleaned.length} character${cleaned.length === 1 ? "" : "s"})`,
    };
  }
  return { ok: true, code: cleaned };
}

// --- Date helpers ---

function parseDate(value: string, field: string): Date | ValidationError {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return {
      field,
      message: `${field} '${value}' must be in YYYY-MM-DD format`,
    };
  }
  const d = new Date(value + "T00:00:00Z");
  if (isNaN(d.getTime())) {
    return { field, message: `${field} '${value}' is not a valid date` };
  }
  const [y, m, day] = value.split("-").map(Number);
  if (
    d.getUTCFullYear() !== y ||
    d.getUTCMonth() + 1 !== m ||
    d.getUTCDate() !== day
  ) {
    return { field, message: `${field} '${value}' is not a valid date` };
  }
  return d;
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// --- Common validation helpers ---

function validateAdults(adults: number): ValidationError | null {
  if (adults < 1 || adults > 6) {
    return {
      field: "adults",
      message: `adults must be 1-6 (got ${adults})`,
    };
  }
  return null;
}

function validateChildrenAges(childrenAges?: number[]): ValidationError | null {
  if (childrenAges != null) {
    if (childrenAges.length > 6) {
      return {
        field: "children_ages",
        message: `Maximum 6 children (got ${childrenAges.length})`,
      };
    }
    for (const age of childrenAges) {
      if (age < 0 || age > 17) {
        return {
          field: "children_ages",
          message: `Child age ${age} is invalid (must be 0-17)`,
        };
      }
    }
  }
  return null;
}

function validatePriceRange(
  priceMin?: number,
  priceMax?: number,
): ValidationError | null {
  if (priceMin != null && priceMax != null) {
    if (priceMin > priceMax) {
      return {
        field: "filters.price",
        message: `price_min (${priceMin}) cannot exceed price_max (${priceMax})`,
      };
    }
  }
  return null;
}

function validateLimit(
  limit: number | undefined,
  max: number,
): ValidationError | null {
  if (limit != null && (limit < 1 || limit > max)) {
    return {
      field: "limit",
      message: `limit must be 1-${max} (got ${limit})`,
    };
  }
  return null;
}

// --- Stay search validation ---

export function validateSearchStaysRequest(
  req: SearchStaysRequest,
): ValidationError | null {
  const stayDest = req.destination?.trim() ?? "";
  if (stayDest.length < 2 || stayDest.length > 200) {
    return {
      field: "destination",
      message: `Destination must be 2-200 characters (got ${stayDest.length})`,
    };
  }

  const checkIn = parseDate(req.check_in, "check_in");
  if ("field" in checkIn) return checkIn;

  const checkOut = parseDate(req.check_out, "check_out");
  if ("field" in checkOut) return checkOut;

  const today = todayUTC();
  if (checkIn < today) {
    return {
      field: "check_in",
      message: `Check-in (${req.check_in}) is in the past`,
    };
  }

  const daysOut = daysBetween(today, checkIn);
  if (daysOut > 500) {
    return {
      field: "check_in",
      message: `Check-in is ${daysOut} days out; maximum booking window is 500 days`,
    };
  }

  if (checkIn >= checkOut) {
    return {
      field: "check_out",
      message: `Check-in (${req.check_in}) must be before check-out (${req.check_out})`,
    };
  }

  const nights = daysBetween(checkIn, checkOut);
  if (nights > 30) {
    return {
      field: "check_out",
      message: `${nights}-night stay exceeds the 30-night maximum`,
    };
  }

  const adultsErr = validateAdults(req.adults);
  if (adultsErr != null) return adultsErr;

  const childrenErr = validateChildrenAges(req.children_ages);
  if (childrenErr != null) return childrenErr;

  if (req.filters?.star_rating != null) {
    const { min, max } = req.filters.star_rating;
    if (min != null && max != null && min > max) {
      return {
        field: "filters.star_rating",
        message: `min_stars (${min}) cannot exceed max_stars (${max})`,
      };
    }
  }

  const priceErr = validatePriceRange(
    req.filters?.price_min,
    req.filters?.price_max,
  );
  if (priceErr != null) return priceErr;

  const limitErr = validateLimit(req.limit, 100);
  if (limitErr != null) return limitErr;

  if (req.radius_km != null && (req.radius_km < 1 || req.radius_km > 200)) {
    return {
      field: "radius_km",
      message: `radius_km must be 1-200 (got ${req.radius_km})`,
    };
  }

  return null;
}

// --- Flight search validation ---

const VALID_CABIN_CLASSES = new Set([
  "ECONOMY",
  "PREMIUM_ECONOMY",
  "BUSINESS",
  "FIRST",
]);

export function validateSearchFlightsRequest(
  req: SearchFlightsRequest,
): ValidationError | null {
  const flightOrigin = req.origin?.trim() ?? "";
  if (flightOrigin.length < 2 || flightOrigin.length > 200) {
    return {
      field: "origin",
      message: `Origin must be 2-200 characters (got ${flightOrigin.length})`,
    };
  }

  const flightDest = req.destination?.trim() ?? "";
  if (flightDest.length < 2 || flightDest.length > 200) {
    return {
      field: "destination",
      message: `Destination must be 2-200 characters (got ${flightDest.length})`,
    };
  }

  if (flightOrigin.toLowerCase() === flightDest.toLowerCase()) {
    return {
      field: "destination",
      message: "Origin and destination cannot be the same",
    };
  }

  const departure = parseDate(req.departure_date, "departure_date");
  if ("field" in departure) return departure;

  const today = todayUTC();
  if (departure < today) {
    return {
      field: "departure_date",
      message: `Departure date (${req.departure_date}) is in the past`,
    };
  }

  const daysOut = daysBetween(today, departure);
  if (daysOut > 365) {
    return {
      field: "departure_date",
      message: `Departure date is ${daysOut} days out; maximum booking window is 365 days`,
    };
  }

  if (req.return_date != null && req.return_date !== "") {
    const returnDate = parseDate(req.return_date, "return_date");
    if ("field" in returnDate) return returnDate;

    if (returnDate <= departure) {
      return {
        field: "return_date",
        message: "Return date must be after departure date",
      };
    }

    const tripDays = daysBetween(departure, returnDate);
    if (tripDays > 30) {
      return {
        field: "return_date",
        message: `${tripDays}-day round trip exceeds the 30-day maximum`,
      };
    }
  }

  const adultsErr = validateAdults(req.adults);
  if (adultsErr != null) return adultsErr;

  const childrenErr = validateChildrenAges(req.children_ages);
  if (childrenErr != null) return childrenErr;

  if (req.infants_in_lap != null) {
    if (req.infants_in_lap < 0 || req.infants_in_lap > 2) {
      return {
        field: "infants_in_lap",
        message: `infants_in_lap must be 0-2 (got ${req.infants_in_lap})`,
      };
    }
    if (req.infants_in_lap > req.adults) {
      return {
        field: "infants_in_lap",
        message: `Infants in lap (${req.infants_in_lap}) cannot exceed adults (${req.adults})`,
      };
    }
  }

  if (req.cabin_class != null && !VALID_CABIN_CLASSES.has(req.cabin_class)) {
    return {
      field: "cabin_class",
      message: `Unknown cabin class '${req.cabin_class}'`,
    };
  }

  if (
    req.filters?.max_stops != null &&
    (req.filters.max_stops < 0 || req.filters.max_stops > 3)
  ) {
    return {
      field: "filters.max_stops",
      message: `max_stops must be 0-3 (got ${req.filters.max_stops})`,
    };
  }

  const priceErr = validatePriceRange(
    req.filters?.price_min,
    req.filters?.price_max,
  );
  if (priceErr != null) return priceErr;

  const limitErr = validateLimit(req.limit, 25);
  if (limitErr != null) return limitErr;

  return null;
}
