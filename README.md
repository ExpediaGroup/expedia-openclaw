# EG Travel — OC Plugin

Live hotel and flight search via the EG Travel Adapter.

## Install

```bash
oc plugins install @expediagroup/expedia-travel-openclaw
```
 
## Configuration

In `~/.oc/oc.json`:

```json
{
  "plugins": {
    "eg-travel": {
      "adapter_url": "https://www.expedia.com/product/expedia-in-openclaw",
      "default_pos_country": "US",
      "synthetic_mode": false
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `adapter_url` | `https://www.expedia.com/product/expedia-in-openclaw` | EG Travel Adapter endpoint |
| `default_pos_country` | `US` | ISO 3166-1 alpha-2 country code for pricing |
| `default_currency` | _(adapter default)_ | ISO 4217 currency code |
| `request_timeout_ms` | `12000` | HTTP timeout in milliseconds |
| `synthetic_mode` | `false` | Use deterministic test data instead of live results (set `true` for development) |

## Tools

### `search_stays`

Search hotels, resorts, and vacation rentals with live pricing and availability.

**Input**

```json
{
  "destination": "Tokyo",
  "check_in": "2026-06-10",
  "check_out": "2026-06-13",
  "adults": 2,
  "limit": 5,
  "sort": "CHEAPEST"
}
```

**Output (abbreviated)**

```json
{
  "request_id": "req_01HZ...",
  "currency": "USD",
  "nights": 3,
  "result_count": 5,
  "results": [
    {
      "property_id": "prop_123",
      "name": "Shinjuku Granbell Hotel",
      "property_type": "HOTEL",
      "star_rating": 4,
      "price": { "amount_total": 642.30, "currency": "USD" },
      "free_cancellation": true,
      "deeplink_url": "https://www.expedia.com/...?affcid=..."
    }
  ],
  "usage_hint": "Always use the deeplink_url from results. Never construct booking URLs yourself."
}
```

### `search_flights`

Search flights with live pricing, schedules, and booking links.

**Input**

```json
{
  "origin": "SFO",
  "destination": "LHR",
  "departure_date": "2026-08-12",
  "return_date": "2026-08-22",
  "adults": 1,
  "cabin_class": "ECONOMY",
  "filters": { "max_stops": 1 }
}
```

**Output (abbreviated)**

```json
{
  "request_id": "req_01J0...",
  "origin": { "code": "SFO", "label": "San Francisco" },
  "destination": { "code": "LHR", "label": "London Heathrow" },
  "currency": "USD",
  "result_count": 8,
  "results": [
    {
      "offer_id": "off_456",
      "airline": { "code": "BA", "name": "British Airways" },
      "cabin_class": "ECONOMY",
      "price": { "amount_total": 845.00, "currency": "USD" },
      "outbound": { "duration_minutes": 615, "stops": 0 },
      "deeplink_url": "https://www.expedia.com/..."
    }
  ]
}
```

### `eg_travel_signup`

Request a temporary verification code via email or phone to get started.

**Input**

```json
{ "contact": "user@example.com" }
```

**Output**

```text
Verification code sent to user@example.com. Code expires in 120 seconds.
Call eg_travel_verify with the 6-digit code to complete signup.
```

### `eg_travel_verify`

Exchange the verification code for an API token.

**Input**

```json
{ "contact": "user@example.com", "code": "482910" }
```

**Output**

```text
Verified. Account active. You can now call search_stays or search_flights.
```

### `eg_tenant_status`

Show current account status, quota usage, and token expiry.

**Input**

```json
{}
```

**Output (abbreviated)**

```json
{
  "tenant_id": "ten_abc",
  "contact": "user@example.com",
  "status": "active",
  "default_pos": "US",
  "quota": { "limit_per_hour": 100, "remaining": 73, "used": 27, "reset_at": "2026-05-20T11:00:00Z" }
}
```

## Getting Started

1. Install the plugin
2. Configure `adapter_url` to point to a running EG Travel Adapter
3. Ask your agent to search for hotels or flights
4. On first use, provide your email or phone number when prompted
5. Enter the 6-digit verification code (expires in 2 minutes)
6. Search away

## Development

```bash
npm install --legacy-peer-deps
npm test                # unit tests (vitest)
npm run test:integration # integration tests (requires adapter)
npm run build           # compile TypeScript
npm run type-check      # type check without emitting
```

### NPM Scripts

| Name | Responsibility |
|------|---------------|
| `build` | Compile TypeScript to `dist/` |
| `test` | Run the vitest unit test suite |
| `test:integration` | Run integration tests against the adapter (skips if unreachable) |
| `type-check` | TypeScript check without emitting |
| `lint` | Run eslint on `src/` |

### Logging

The plugin emits structured JSON logs via stdout/stderr. Control verbosity with `EG_TRAVEL_LOG_LEVEL`:

```bash
EG_TRAVEL_LOG_LEVEL=debug  # debug, info (default), warn, error
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache 2.0 — see [LICENSE](./LICENSE).
