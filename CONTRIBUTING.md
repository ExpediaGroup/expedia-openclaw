# Contributing

## Prerequisites

- Node.js (version in `.nvmrc`)
- npm

## Setup

```bash
git clone https://github.com/ExpediaGroup/expedia-openclaw.git
cd expedia-openclaw
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is currently required because npm 7+ resolves the
`openclaw` peer dependency strictly and the upstream `openclaw` package's own
peer ranges conflict with this project's dev tooling versions. The flag is
for local development only — published consumers install via
`openclaw plugins install`, which does not use npm's peer-dep resolver.

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes in `src/`
3. Run checks:
   ```bash
   npm run type-check
   npm test
   npm run build
   ```
4. Open a pull request against `main`

## Testing

- **Unit tests**: `npm test` — runs vitest against `src/**/*.test.ts`
- **Integration tests**: `npm run test:integration` — requires a running adapter (set `ADAPTER_URL` env var). Tests skip gracefully if the adapter is unreachable.

## Code Style

- TypeScript with strict mode
- ESLint for linting (`npm run lint`)
- Prefer small, focused PRs

## Reporting Issues

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

## Package Lock Policy

This project does not commit `package-lock.json` to version control. Developers should run `npm install --legacy-peer-deps` after each pull to regenerate it locally based on the `package.json` dependency ranges.
