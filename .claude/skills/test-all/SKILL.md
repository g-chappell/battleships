---
name: test-all
description: Run all test suites across all workspaces and report results
user_invocable: true
---

# Run All Tests

Run each test suite sequentially and collect results:

1. `npm run test --workspace=shared`
2. `npm run test --workspace=server`
3. `npm run test --workspace=client`

After all three complete, report:
- Total tests run, passed, failed for each workspace
- If any failed, show the failure details
- End with a single PASS/FAIL verdict

If a workspace fails, still run the remaining workspaces so the user sees the full picture.
