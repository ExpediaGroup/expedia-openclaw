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
import { AdapterError, formatErrorForModel } from "../errors.js";
import { validateSearchFlightsRequest } from "../validation.js";
import { readCredential } from "../credential-store.js";
import { toolTextResult, toolJsonResult, type ToolResult } from "../tool-result.js";

const CabinClassEnum = Type.Union([
  Type.Literal("ECONOMY"),
  Type.Literal("PREMIUM_ECONOMY"),
  Type.Literal("BUSINESS"),
  Type.Literal("FIRST"),
]);

const FlightSortEnum = Type.Union([
  Type.Literal("PRICE"),
  Type.Literal("DURATION"),
]);

const InputSchema = Type.Object({
  origin: Type.String({ minLength: 2, maxLength: 200 }),
  destination: Type.String({ minLength: 2, maxLength: 200 }),
  departure_date: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  return_date: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  adults: Type.Integer({ minimum: 1, maximum: 6 }),
  children_ages: Type.Optional(
    Type.Array(Type.Integer({ minimum: 0, maximum: 17 }), { maxItems: 6 }),
  ),
  infants_in_lap: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
  cabin_class: Type.Optional(CabinClassEnum),
  filters: Type.Optional(
    Type.Object({
      max_stops: Type.Optional(Type.Integer({ minimum: 0, maximum: 5 })),
      airline_code: Type.Optional(Type.String({ minLength: 2, maxLength: 3 })),
      exclude_basic_economy: Type.Optional(Type.Boolean()),
    }),
  ),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 25 })),
  sort: Type.Optional(FlightSortEnum),
  pos_country: Type.Optional(Type.String()),
  currency: Type.Optional(Type.String()),
  intent: Type.Optional(Type.String({ maxLength: 280 })),
});

type Input = Static<typeof InputSchema>;

export function createSearchFlightsTool(config: PluginConfig, fetchFn?: typeof globalThis.fetch) {
  const client = new AdapterClient(config, fetchFn);

  return {
    name: "search_flights",
    label: "Search Flights",
    description:
      "Search for flights with live pricing, schedules, and booking links. " +
      "CRITICAL display rules (non-negotiable): scope every claim to the result set; " +
      "never use unqualified superlatives ('best', 'all', 'top', 'every', 'only', 'lowest'); " +
      "if every result has the same `amount_total`, disclose explicitly; always close with " +
      "the required line pointing the user to Expedia.com for the comprehensive view.",
    inputSchema: InputSchema,

    async execute(input: Input): Promise<ToolResult> {
      const credential = readCredential();
      if (!credential) {
        return toolTextResult(
          "No credentials found. " +
            "Call `eg_travel_signup` with the user's email address to get started.",
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
          display_rules: [
            "SCOPE DISCLOSURE — non-negotiable, applies to every flight reply:",
            "(1) Scope every claim to the result set this tool returned. State what filters were applied and that other fares may exist on Expedia.com that aren't shown here.",
            "(2) NEVER use unqualified superlatives — not as descriptors, not as section headers, not as price claims. Banned words include: 'best', 'top', 'great', 'all', 'every', 'only', 'lowest', 'cheapest', 'fastest'. Only allowed if a label is a verbatim API-supplied string in a field.",
            "(3) If every result shares the same `amount_total`, disclose explicitly: \"every result I'm seeing for these filters is at $X — other fares (including Basic Economy variants or different airlines) may exist on Expedia.com that aren't surfaced here.\"",
            "(4) Do not unilaterally apply `max_stops: 0` (nonstop only) unless the user explicitly asked for nonstop. Restricting by default hides cheaper connecting options.",
            "(5) End every reply with this required closing line (verbatim): \"Other fares (including Basic Economy variants or different airlines) may exist on Expedia.com that aren't surfaced here. Tap any result above to see full pricing on the Expedia booking page.\"",
            "(6) Use the deeplink_url from results for booking links. Never construct your own.",
          ],
        };

        return toolJsonResult(result);
      } catch (err) {
        if (err instanceof AdapterError) {
          return toolTextResult(
            formatErrorForModel(err, config.adapter_url, {
              contact: credential.contact,
              contact_method: credential.contact_method,
            }),
          );
        }
        throw err;
      }
    },
  };
}
