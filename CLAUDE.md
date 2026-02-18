# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TabBrain is a Chrome extension (Manifest V3) that silently tracks browser tabs, uses AI to auto-detect why each tab was opened, and organizes everything in a dashboard grouped by purpose. No backend server — everything runs client-side.

## Tech Stack

- Chrome Extension (Manifest V3)
- Plain HTML/CSS/JS — no frameworks, no npm, no build tools
- Groq API (free tier, llama-3.3-70b-versatile) for AI tab analysis
- chrome.storage.local for data
- Keyword-based fallback when API is unavailable
- Apple-esque dark sleek design with refined shadows and smooth transitions. Look at design-reference.png in the project folder for design inspiration.

## Development

Load as unpacked extension:
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" → select the TabBrain folder
4. After code changes, click the reload button on the extension card

Inspect the service worker console via "Inspect views: service worker" on the extensions page. Debug storage with `chrome.storage.local.get('tabRecords', console.log)` in that console.

## Design Workflow

When making UI/design changes to the extension:
1. Make the changes to the HTML/CSS/JS files
2. Take a screenshot of the result using Chrome DevTools MCP or the browser
3. Compare it to the reference design image if one was provided
4. List all differences between your result and the reference
5. Fix the differences and repeat until the design is very close to the reference
6. Do this for all pages (dashboard, popup, settings) to keep them consistent

## Testing Workflow

After any code changes:
- The extension must be reloaded in Chrome at chrome://extensions (click the refresh icon on TabBrain)
- Open the dashboard and verify changes work
- Check the popup still works
- Check settings page still works

## Architecture

**Data flow**: Tab opened → `chrome.tabs.onUpdated` in `background.js` → messages `content.js` to extract page content → calls Groq API (or keyword fallback) → stores result in `chrome.storage.local` → popup/dashboard read from storage with live `onChanged` listener.

Key files:
- `manifest.json` — extension config, permissions, script declarations
- `background.js` — service worker: tab event listeners, AI queue, Groq API calls, fallback categorizer, badge updates, storage cleanup (30-day prune via chrome.alarms)
- `content.js` — injected into every page; responds to `extractContent` messages with title, URL, meta description, first 500 chars of body
- `utils.js` — shared helpers loaded by popup and dashboard: `getTabRecords()`, `timeAgo()`, `faviconUrl()`, `truncate()`, `initTheme()`, `toggleTheme()`
- `popup.html/js/css` — small popup showing 5 recent tabs + "Open Dashboard" button
- `dashboard.html/js/css` — full dashboard with category groups, search, save/close/reopen actions, live updates
- `settings.html/js/css` — API key entry page (also accessible via chrome://extensions options)
- `shared.css` — design tokens (dark premium: Inter font stack, --accent #E8734A coral, deep navy backgrounds, refined shadows)

## Data Model

Tab records are stored as an array under `chrome.storage.local` key `tabRecords`. Each record has: `tabId`, `url`, `title`, `metaDescription`, `snippet`, `openedAt`, `closedAt`, `aiReason`, `aiCategory`, `aiProcessed`, `savedForLater`.

AI categories: Research, Shopping, Social Media, Entertainment, Work, Learning, News, Communication, Finance, Development, Other.

## Conventions

- All UI shares design tokens from `shared.css` (CSS custom properties prefixed `--`)
- No external dependencies or CDN imports — everything is self-contained
- AI calls are queued and serialized with 500ms gap to stay within Groq free tier rate limits
- `chrome://` and `chrome-extension://` URLs are skipped in tab tracking
- Closed tabs older than 30 days are pruned automatically (saved tabs are kept)
- Dark theme is the default (`:root`), light theme is the override (`[data-theme="light"]`)
- Theme toggle persists user preference via chrome.storage.local under key `theme`
- Keyboard shortcut: Ctrl+Shift+Y (Cmd+Shift+Y on Mac) opens the dashboard
