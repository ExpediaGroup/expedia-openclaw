# Expedia OpenClaw Plugin

Live hotel and flight search powered by Expedia — built as an [OpenClaw](https://openclaw.com) plugin. Ask your agent for a hotel or a flight and get back real prices, real availability, and real booking links. No web scraping. No browser automation. No fabricated URLs.

By using this plugin you agree to the [Terms and Conditions](https://www.expedia.com/product/expedia-openclaw/).

## Install

```bash
openclaw plugins install clawhub:@expediagroup/expedia-openclaw
```

Add the tools to your `~/.oc/oc.json`:

```json
{
  "tools": {
    "alsoAllow": [
      "search_stays",
      "search_flights",
      "eg_travel_signup",
      "eg_travel_verify"
    ]
  }
}
```

Restart the gateway:

```bash
openclaw gateway restart
```

## How it works

Ask your agent about hotels, vacation rentals, or flights:

> "Find me a hotel in Manhattan for next weekend, two adults"

> "Round-trip flights from SFO to Tokyo, August 12–22"

The first time, the agent walks you through a one-time setup — it asks for your email, sends you a 6-digit code, and you paste the digits back into the chat. The whole thing takes about two minutes. After that, searches just work.

Your access stays active as long as you keep using it. If you go about a week without searching, the agent sends you a fresh code automatically — you don't have to re-enter your email.

## What you get back

The agent presents real-time results from Expedia with prices, ratings, and direct booking links.

**Hotels and vacation rentals:**

> **The Plaza** ⭐⭐⭐⭐⭐ · 9.0/10 (1,000 reviews)
> US$2,894 · Total
> Iconic NYC landmark on Central Park & 5th Ave. Full-service spa, family-friendly.
> 👉 Book on Expedia

**Flights:**

> **United Airlines** · San Francisco (SFO) → Tokyo (NRT)
> Departs 11:15 AM · 11h 20m · Nonstop · Economy
> $845 USD per adult · Checked bag included
> 👉 View on Expedia

You can refine with follow-ups like "only 5-star", "pet-friendly", "under $300/night", "fewer stops", or "show me business class" — the agent re-searches with updated filters each time.

## Tools

| Tool | Purpose |
|------|---------|
| `search_stays` | Search hotels and vacation rentals with filters, sorting, and an optional trip-intent description |
| `search_flights` | Search flights with filters for stops, airline, cabin class, and more |
| `eg_travel_signup` | Send a 6-digit verification code to your email (first-time setup or re-auth) |
| `eg_travel_verify` | Exchange the code for an API token, saved automatically to your credential store |

The bundled `travel-search` skill tells the agent when and how to use each tool — including the setup flow, re-authentication after inactivity, error handling, and output formatting.

## Configuration

All configuration is optional. The plugin defaults to the public Expedia service and US pricing.

```json
{
  "plugins": {
    "entries": {
      "expedia-openclaw": {
        "enabled": true,
        "config": {
          "default_pos_country": "US",
          "default_currency": "USD",
          "request_timeout_ms": 12000
        }
      }
    }
  }
}
```

## Privacy

See the [Privacy and Data Use](https://www.expedia.com/product/expedia-openclaw/) section of the Terms and Conditions.

## Development

```bash
npm install --legacy-peer-deps
npm test                # unit tests (vitest)
npm run test:integration # integration tests (requires adapter)
npm run build           # compile TypeScript
npm run type-check      # type check without emitting
npm run lint            # eslint
```

## Issues

File bug reports and feature requests at [github.com/ExpediaGroup/expedia-openclaw/issues](https://github.com/ExpediaGroup/expedia-openclaw/issues). See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

## License

Apache 2.0 — see [LICENSE](./LICENSE).
