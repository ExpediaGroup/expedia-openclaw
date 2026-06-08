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

import { Type, type Static } from "@sinclair/typebox";
import type { PluginConfig, SearchFlightsRequest } from "../types.js";
import { AdapterClient } from "../adapter-client.js";
import { catchAdapterError } from "../errors.js";
import { validateSearchFlightsRequest } from "../validation.js";
import { readCredential } from "../credential-store.js";
import { toolTextResult, toolJsonResult, type ToolResult } from "../tool-result.js";
import { AdultsSchema, ChildrenAgesSchema, PosCountrySchema, CurrencySchema, IntentSchema } from "../shared-schema.js";

const CabinClassEnum = Type.Union([
  Type.Literal("ECONOMY"),
  Type.Literal("PREMIUM_ECONOMY"),
  Type.Literal("BUSINESS"),
  Type.Literal("FIRST"),
]);

const FlightSortEnum = Type.Union([
  Type.Literal("CHEAPEST"),
  Type.Literal("FASTEST"),
  Type.Literal("BEST"),
  Type.Literal("MOST_EXPENSIVE"),
]);

const InputSchema = Type.Object({
  origin: Type.String({ minLength: 2, maxLength: 200 }),
  destination: Type.String({ minLength: 2, maxLength: 200 }),
  departure_date: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  return_date: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  adults: AdultsSchema,
  children_ages: ChildrenAgesSchema,
  infants_in_lap: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
  cabin_class: Type.Optional(CabinClassEnum),
  filters: Type.Optional(
    Type.Object({
      max_stops: Type.Optional(Type.Integer({ minimum: 0, maximum: 3 })),
      preferred_airlines: Type.Optional(Type.Array(Type.String())),
      max_duration_minutes: Type.Optional(Type.Number({ minimum: 0 })),
      price_min: Type.Optional(Type.Number({ minimum: 0 })),
      price_max: Type.Optional(Type.Number({ minimum: 0 })),
    }),
  ),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 25 })),
  sort: Type.Optional(FlightSortEnum),
  pos_country: PosCountrySchema,
  currency: CurrencySchema,
  intent: IntentSchema,
});

type Input = Static<typeof InputSchema>;

export function createSearchFlightsTool(config: PluginConfig, fetchFn?: typeof globalThis.fetch) {
  const client = new AdapterClient(config, fetchFn);

  return {
    name: "search_flights",
    label: "Search Flights",
    description:
      "Search for flights with live pricing, schedules, and booking links.",
    inputSchema: InputSchema,

    async execute(input: Input): Promise<ToolResult> {
      const credential = readCredential();
      if (!credential) {
        return toolTextResult(
          "No credentials found. " +
            "Call `eg_travel_signup` with the user's email or phone number to get started.",
        );
      }

      const req: SearchFlightsRequest = {
        ...input,
        origin: input.origin?.trim() ?? "",
        destination: input.destination?.trim() ?? "",
        pos_country: input.pos_country ?? config.default_pos_country,
        currency: input.currency ?? config.default_currency,
      };

      const validationError = validateSearchFlightsRequest(req);
      if (validationError) {
        return toolTextResult(
          `Validation error (${validationError.field}): ${validationError.message}`,
        );
      }

      try {
        const resp = await client.searchFlights(credential.token, req);

        const result = {
          ...resp,
          usage_hint:
            "Always use the deeplink_url from results. Never construct booking URLs yourself.",
        };

        return toolJsonResult(result);
      } catch (err) {
        return catchAdapterError(err, config.adapter_url, {
          contact: credential.contact,
          contact_method: credential.contact_method,
        });
      }
    },
  };
}
