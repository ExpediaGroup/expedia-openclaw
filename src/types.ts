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

// --- Plugin configuration ---

export interface PluginConfig {
  adapter_url: string;
  default_pos_country: string;
  default_currency?: string;
  request_timeout_ms: number;
  synthetic_mode: boolean;
}

// --- Contact / Auth ---

export type ContactMethod = "email" | "phone";

export interface SignupRequest {
  contact: string;
  contact_method: ContactMethod;
}

export interface SignupResponse {
  message: string;
  expires_in_seconds: number;
}

export interface VerificationRequest {
  contact: string;
  contact_method: ContactMethod;
  code: string;
}

export interface VerificationResponse {
  token: string;
  tenant_id: string;
  token_kind: "bearer";
  expires_at?: string;
  quota?: {
    searches_per_hour: number;
    searches_remaining: number;
  };
}

// --- Credential storage ---

export interface StoredCredential {
  token: string;
  tenant_id: string;
  contact: string;
  contact_method: ContactMethod;
  token_kind: "bearer";
  expires_at?: string;
}

// --- Search stays ---

export type PropertyType = "HOTEL" | "RESORT" | "VR";
export type StaySort =
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "distance"
  | "recommended";

export interface StayFilters {
  amenities?: string[];
  free_cancellation?: boolean;
  star_rating?: { min?: number; max?: number };
  guest_rating?: { min?: number };
  price_min?: number;
  price_max?: number;
  pet_friendly?: boolean;
}

export interface SearchStaysRequest {
  destination: string;
  hotel_name?: string;
  check_in: string;
  check_out: string;
  adults: number;
  children_ages?: number[];
  property_types?: PropertyType[];
  filters?: StayFilters;
  limit?: number;
  radius_km?: number;
  sort?: StaySort;
  pos_country?: string;
  currency?: string;
  intent?: string;
}

export interface StayResult {
  property_id: string;
  name: string;
  property_type: PropertyType;
  neighborhood: string;
  star_rating: number;
  guest_rating: {
    score: number;
    scale: 10;
    review_count: number;
  };
  price: {
    amount_per_night: number;
    amount_total: number;
    currency: string;
    taxes_included: boolean;
    fees_estimate: number;
  };
  free_cancellation: boolean;
  amenities: string[];
  thumbnail_url: string;
  deeplink_url: string;
  geo: { lat: number; lng: number };
}

export interface SearchStaysResponse {
  request_id: string;
  trace_id: string;
  cached: boolean;
  cached_at?: string;
  cache_ttl_seconds: number;
  synthetic?: boolean;
  check_in: string;
  check_out: string;
  nights: number;
  party: { adults: number; children: number };
  currency: string;
  result_count: number;
  total_available: number;
  warnings: string[];
  results: StayResult[];
}

// --- Search flights ---

export type CabinClass =
  | "ECONOMY"
  | "PREMIUM_ECONOMY"
  | "BUSINESS"
  | "FIRST";
export type FlightSort = "PRICE" | "DURATION";

export interface FlightFilters {
  max_stops?: number;
  airline_code?: string;
  exclude_basic_economy?: boolean;
}

export interface SearchFlightsRequest {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  adults: number;
  children_ages?: number[];
  infants_in_lap?: number;
  cabin_class?: CabinClass;
  filters?: FlightFilters;
  limit?: number;
  sort?: FlightSort;
  pos_country?: string;
  currency?: string;
  intent?: string;
}

export interface FlightSegment {
  carrier: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  aircraft?: string;
}

export interface FlightLeg {
  departure: string;
  arrival: string;
  duration_minutes: number;
  stops: number;
  segments: FlightSegment[];
}

export interface FlightResult {
  offer_id: string;
  airline: { code: string; name: string };
  cabin_class: string;
  price: {
    amount_total: number;
    amount_per_person: number;
    currency: string;
    taxes_included: boolean;
  };
  outbound: FlightLeg;
  return?: FlightLeg;
  deeplink_url: string;
  baggage_included: boolean;
  seat_selection_included: boolean;
}

export interface SearchFlightsResponse {
  request_id: string;
  trace_id: string;
  cached: boolean;
  cached_at?: string;
  cache_ttl_seconds: number;
  synthetic?: boolean;
  origin: { code: string; label: string };
  destination: { code: string; label: string };
  departure_date: string;
  return_date?: string;
  party: { adults: number; children: number; infants_lap: number; infants_seat: number };
  currency: string;
  result_count: number;
  warnings: string[];
  results: FlightResult[];
}

// --- Tenant status ---

export interface TenantStatusResponse {
  tenant_id: string;
  contact: string;
  contact_type: ContactMethod;
  status: "active" | "suspended" | "revoked";
  default_pos: string;
  quota: {
    limit_per_hour: number;
    remaining: number;
    used: number;
    reset_at: string;
  };
  price_watches: {
    active: number;
    total_created: number;
  };
}

// --- Error envelope ---

export interface AdapterErrorEnvelope {
  error: {
    code: string;
    message: string;
    retry_after_seconds?: number;
    request_id?: string;
    trace_id?: string;
    details?: Record<string, unknown>;
  };
}

// --- Health ---

export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  uptime_seconds: number;
}
