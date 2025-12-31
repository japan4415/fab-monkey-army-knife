# fab-monkey-army-knife

Tampermonkey scripts to improve the official Flesh and Blood website.
This repo includes a sample script configured for automatic updates.

## Target site

- https://fabtcg.com/
- https://gem.fabtcg.com/

## Prerequisites

- Install Tampermonkey in your browser.

## Install

1. Open the raw script URL in your browser (use `raw`, not `blob`).
   - https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife.user.js
2. When the Tampermonkey install page opens, click Install.

Note: The script includes a GEM history CSV export tool.

## Auto-update settings (important)

Tampermonkey needs permission to access file URLs for update checks.

1. Open the browser extensions manager and the Tampermonkey details page.
2. Turn on "Allow access to file URLs".

If this is off, `@updateURL` will not be checked.

## How to confirm updates

- Paste the `@updateURL` in the address bar to open the reinstall screen.
- Or use "Check for updates" from the Tampermonkey dashboard.

## Scripts

- `fab-monkey-army-knife.user.js`
  - Uses GitHub raw URLs for `@updateURL` / `@downloadURL`
  - Bump `@version` to trigger auto-update

## GEM history CSV export

On https://gem.fabtcg.com/profile/history/ the script:

- Loads all history entries automatically
- Adds a "Copy CSV" button to copy the full history
