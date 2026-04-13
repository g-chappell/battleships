---
name: add-feature
description: Guided feature implementation with scope control and test-first approach
user_invocable: true
---

# Add Feature (Guided)

Before writing any code, complete these planning steps:

## 1. Scope definition
- Ask the user to describe the feature in one sentence
- Identify which workspaces are affected (shared, client, server)
- List the EXACT files that need to change (read them first)
- List any NEW files that need to be created
- Explicitly state what is OUT OF SCOPE (do not add unrelated improvements)

## 2. Test plan
- For each file being modified, identify existing tests
- Write test cases FIRST for the new behavior (test-first)
- Run the new tests to confirm they fail (red phase)

## 3. Implementation (one file at a time)
- Make changes to ONE file
- Run `cd C:/claude/battleships/client && npx tsc --noEmit` after each edit to catch type errors immediately
- If the file is in shared/, also run `npm run test --workspace=shared`
- Only proceed to the next file after the current one is clean

## 4. Verify
- Run ALL tests: `npm run test --workspace=shared && npm run test --workspace=server && npm run test --workspace=client`
- If any UI changes were made, use the /verify-ui skill to screenshot and verify
- Confirm no existing elements were removed
- Review the git diff to make sure only intended changes are present

## Rules for this workflow
- NEVER edit more than one file between type-checks
- NEVER add extra features, abstractions, or "while I'm here" improvements
- If you discover something broken unrelated to the feature, note it but do NOT fix it
- If the feature requires changes to more than 5 files, discuss the plan with the user before proceeding
