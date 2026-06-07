# Project: Expedia OpenClaw Plugin

## Build & Test

```bash
npm install --legacy-peer-deps   # openclaw peer dep resolution
npm run type-check               # TypeScript check
npm test                         # vitest unit tests
npm run build                    # compile to dist/
```

## Conventions

- The `openclaw` SDK is a peer dependency.
- Test adapter URLs must use a port with nothing listening (e.g., 19999) to avoid collision with the real adapter on 8080.
