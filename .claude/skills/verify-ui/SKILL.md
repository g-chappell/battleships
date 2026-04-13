---
name: verify-ui
description: Start dev server and visually verify UI state via screenshot
user_invocable: true
---

# Verify UI

Use the Claude Preview tools to visually inspect the running application.

1. Start the dev server using `preview_start` with the "client" configuration
2. Wait for the server to be ready (check `preview_logs` for Vite "ready" message)
3. Take a screenshot using `preview_screenshot`
4. Check for these common regression indicators:
   - Missing navigation elements (TopNav should be visible on non-game screens)
   - Broken layout (elements overlapping or overflowing)
   - Missing text content (buttons, labels, headings should have readable text)
   - Color/theme consistency (pirate theme: dark backgrounds, gold/bone text, blood accents)
5. If the user specified a particular page or component to check, navigate to it using `preview_click` or `preview_eval`
6. Use `preview_snapshot` to verify element presence and text content
7. Report findings with the screenshot attached

If the user provides a "before" description of what the UI should look like, compare against it. Flag any elements that appear missing or broken.

Common screens to verify:
- **Main menu:** ship model visible, all menu buttons present, gold counter in nav
- **Game page:** both boards visible, ability bar present, HUD elements
- **Dashboard:** stats panels, match history
- **Shop:** cosmetics grid, gold balance
- **Campaign:** mission map with stars
