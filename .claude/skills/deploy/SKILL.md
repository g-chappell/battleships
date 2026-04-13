---
name: deploy
description: Run full pre-deployment validation and guide deployment to VPS
user_invocable: true
---

# Deploy to Production

Execute the following deployment checklist in order, stopping at the first failure:

## Pre-flight checks (run locally)

1. Run type checking: `cd C:/claude/battleships/client && npx tsc --noEmit`
   - If there are errors, fix them before proceeding.

2. Run ALL test suites:
   - `npm run test --workspace=shared` (expect 74+ tests)
   - `npm run test --workspace=server` (expect 37+ tests)
   - `npm run test --workspace=client` (expect 15+ tests)
   - If any test fails, stop and fix it.

3. Run a local production build: `npm run build --workspace=client`
   - This runs tsc -b then vite build. If it fails, fix the errors.

4. Check the Dockerfiles parse correctly:
   - Read `server/Dockerfile` and `client/Dockerfile`
   - Verify no local-only paths or Windows-isms leaked in

## Review what will be deployed

5. Run `git status` and `git diff --stat` to show what will be deployed
6. Show a summary to the user and ASK for confirmation before deploying

## Deploy (only after user confirmation)

7. Commit any uncommitted changes (ask user for commit message)
8. Push to the remote: `git push`
9. Inform the user to SSH into the VPS and run:
   ```
   cd /opt/battleships && git pull && docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml up -d
   ```

## Post-deploy

10. If `server/prisma/schema.prisma` was modified in this deploy, remind user to run:
    `docker compose -f docker-compose.prod.yml exec server npx prisma db push`

Do NOT skip any step. Do NOT deploy without user confirmation. Report each step's pass/fail status.
