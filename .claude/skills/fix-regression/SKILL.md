---
name: fix-regression
description: Investigate and fix a reported regression with minimal changes
user_invocable: true
---

# Fix Regression

When the user reports something that was working before but is now broken:

## 1. Reproduce
- Ask the user for exact steps to reproduce
- Identify the relevant code path (which files, which functions)
- Read those files fully before making any changes

## 2. Identify root cause
- Check git log for recent changes to the affected files: `git log --oneline -10 -- <file>`
- Read the relevant test files to understand expected behavior
- Run existing tests to see if any are already failing

## 3. Write a failing test
- Before fixing, write a test that captures the broken behavior
- Confirm the test fails with the current code

## 4. Fix (minimal change)
- Make the smallest possible change to fix the regression
- Do NOT refactor, reorganize, or "improve" anything else
- Run type checking after the fix: `cd C:/claude/battleships/client && npx tsc --noEmit`
- Run ALL workspace tests (not just the affected one)

## 5. Verify
- Confirm the new test passes
- Confirm all pre-existing tests still pass
- If it's a UI regression, use `/verify-ui` to screenshot

Show the git diff at the end so the user can review the exact change.
