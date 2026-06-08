# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-08

### Added

- Initial open-source release.
- `search_stays` tool — hotels, resorts, and vacation rentals with live pricing.
- `search_flights` tool — flights with live pricing, schedules, and booking links.
- `eg_travel_signup` tool — request a verification code via email or phone.
- `eg_travel_verify` tool — exchange a verification code for an API token.
- `eg_tenant_status` tool — account status, quota usage, and token expiry.
- Credential persistence at `~/.oc/credentials/eg-travel.json`.
- Structured JSON logging via `EG_TRAVEL_LOG_LEVEL`.
- Integration test suite (skips gracefully when adapter is unreachable).
