---
name: pre-deploy-check
description: Validate Docker builds will succeed without actually deploying
user_invocable: true
---

# Pre-Deploy Docker Validation

Run through the same checks Docker will perform, catching errors locally before pushing:

## 1. TypeScript compilation (mirrors client Dockerfile `npm run build`)
```bash
cd C:/claude/battleships/client && npx tsc --noEmit
npm run build --workspace=client
```

## 2. Shared module import safety
- Read `shared/src/index.ts` barrel exports
- Verify no imports from `express`, `socket.io`, `react`, `zustand`, `@prisma` etc.
- Shared must be import-safe from both client and server

## 3. Server import validation
- Verify server imports from shared use relative paths with `.ts` extension
- Verify no `@shared` alias usage in `server/` (that alias only works in Vite/client)

## 4. Prisma check
- If `server/prisma/schema.prisma` was modified, remind user they will need `prisma db push` post-deploy
- Check schema syntax is valid

## 5. All tests pass
```bash
npm run test --workspace=shared
npm run test --workspace=server
npm run test --workspace=client
```

Report results as a checklist with pass/fail for each item.
