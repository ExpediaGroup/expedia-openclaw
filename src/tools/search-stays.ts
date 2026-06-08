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
import type {
  PluginConfig,
  SearchStaysRequest,
  InternalTool,
} from "../types.js";
import { AdapterClient } from "../adapter-client.js";
import { catchAdapterError } from "../errors.js";
import { validateSearchStaysRequest } from "../validation.js";
import { readCredential } from "../credential-store.js";
import { toolTextResult, toolJsonResult, type ToolResult } from "../tool-result.js";
import { AdultsSchema, ChildrenAgesSchema, PosCountrySchema, CurrencySchema, IntentSchema } from "../shared-schema.js";

const PropertyTypeEnum = Type.Union([
  Type.Literal("HOTEL"),
  Type.Literal("RESORT"),
  Type.Literal("VR"),
]);

const StaySortEnum = Type.Union([
  Type.Literal("price_asc"),
  Type.Literal("price_desc"),
  Type.Literal("rating_desc"),
  Type.Literal("distance"),
  Type.Literal("recommended"),
]);

const InputSchema = Type.Object({
  destination: Type.String({ minLength: 2, maxLength: 200 }),
  hotel_name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  check_in: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  check_out: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  adults: AdultsSchema,
  children_ages: ChildrenAgesSchema,
  property_types: Type.Optional(Type.Array(PropertyTypeEnum)),
  filters: Type.Optional(
    Type.Object({
      amenities: Type.Optional(Type.Array(Type.String())),
      free_cancellation: Type.Optional(Type.Boolean()),
      star_rating: Type.Optional(
        Type.Object({
          min: Type.Optional(Type.Number()),
          max: Type.Optional(Type.Number()),
        }),
      ),
      guest_rating: Type.Optional(
        Type.Object({ min: Type.Optional(Type.Number()) }),
      ),
      price_min: Type.Optional(Type.Number({ minimum: 0 })),
      price_max: Type.Optional(Type.Number({ minimum: 0 })),
      pet_friendly: Type.Optional(Type.Boolean()),
    }),
  ),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  radius_km: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
  sort: Type.Optional(StaySortEnum),
  pos_country: PosCountrySchema,
  currency: CurrencySchema,
  intent: IntentSchema,
});

type Input = Static<typeof InputSchema>;

export function createSearchStaysTool(
  config: PluginConfig,
  fetchFn?: typeof globalThis.fetch,
): InternalTool {
  const client = new AdapterClient(config, fetchFn);

  return {
    name: "search_stays",
    label: "Search Stays",
    description:
      "Search for hotels, resorts, and vacation rentals with live pricing and availability. " +
      "CRITICAL display rule (California compliance, non-negotiable): when replying to the user, " +
      "lead with `price.amount_total_inclusive` (the true all-in total: base rate + Expedia " +
      "taxes/fees + hotel-collected mandatory fees) and label it 'Total'. If " +
      "`amount_total_inclusive` is null or 0, hide the price line and point the user to the " +
      "deeplink. NEVER use `price.amount_total` for display (it excludes hotel mandatory fees). " +
      "NEVER display `price.amount_per_night` in the initial response, even if the user framed " +
      "their query in per-night terms. Per-night is a filter, not a display directive. Per-night " +
      "is permitted ONLY if the user explicitly asks as a follow-up.",
    inputSchema: InputSchema,

    async execute(input: unknown): Promise<ToolResult> {
      const typedInput = input as Input;
      const credential = readCredential();
      if (!credential) {
        return toolTextResult(
          "No credentials found. " +
            "Call `eg_travel_signup` with the user's email address to get started.",
        );
      }

      const req: SearchStaysRequest = {
        ...typedInput,
        destination: typedInput.destination?.trim() ?? "",
        pos_country: typedInput.pos_country ?? config.default_pos_country,
        currency: typedInput.currency ?? config.default_currency,
      };

      const validationError = validateSearchStaysRequest(req);
      if (validationError) {
        return toolTextResult(
          `Validation error (${validationError.field}): ${validationError.message}`,
        );
      }

      try {
        const resp = await client.searchStays(credential.token, req);

        const result = {
          ...resp,
          display_rules: [
            "CALIFORNIA COMPLIANCE — non-negotiable, applies to every result card:",
            "(1) Lead with `price.amount_total_inclusive` as the displayed figure. This is the all-in number (base rate + Expedia taxes/fees + hotel-collected mandatory fees for the full stay). Label it 'Total'.",
            "(2) If `price.amount_total_inclusive` is null, undefined, or 0, do NOT display a price line at all. Replace it with: 'Pricing shown on Expedia at booking — tap the link below.' Always include the deeplink.",
            "(3) Do NOT use `price.amount_total` for display. It excludes hotel-collected mandatory fees and is not California-compliant on its own.",
            "(4) Ignore `price.taxes_included` for display purposes. It indicates whether taxes are bundled into the base rate (almost always false) and is irrelevant — `amount_total_inclusive` is always inclusive regardless.",
            "(5) DO NOT display `price.amount_per_night` in your initial reply — not in parentheses, not as a secondary line, not anywhere. Even if the user framed the query in per-night terms ('under $X/night'), that is a filter, not a display directive.",
            "(6) Per-night display is permitted ONLY when the user explicitly asks in a follow-up (e.g., 'what's that per night?').",
            "(7) Use the deeplink_url from results for booking links. Never construct your own.",
          ],
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
