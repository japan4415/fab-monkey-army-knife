# fab-monkey-army-knife

Tampermonkey scripts to improve the official Flesh and Blood website.
This repo includes scripts configured for automatic updates.

## Target site

- https://fabtcg.com/
- https://gem.fabtcg.com/
- https://cardvault.fabtcg.com/

## Prerequisites

- Install Tampermonkey in your browser.

## Install

1. Open the raw script URL in your browser (use `raw`, not `blob`).
   - GEM history CSV export:
     - https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife-result-to-csv.user.js
   - Card Vault image URL copier:
     - https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife-image-downloader.user.js
   - Card Vault artist link:
     - https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife-artist-linker.user.js
2. When the Tampermonkey install page opens, click Install.

Note: If you also install the legacy combined script, the UI can appear twice.

## Auto-update settings (important)

Tampermonkey needs permission to access file URLs for update checks.

1. Open the browser extensions manager and the Tampermonkey details page.
2. Turn on "Allow access to file URLs".

If this is off, `@updateURL` will not be checked.

## How to confirm updates

- Paste the `@updateURL` in the address bar to open the reinstall screen.
- Or use "Check for updates" from the Tampermonkey dashboard.

## Scripts

- `fab-monkey-army-knife-result-to-csv.user.js`
  - GEM history CSV export
- `fab-monkey-army-knife-image-downloader.user.js`
  - Card Vault card image URL copy (front/back)
- `fab-monkey-army-knife-artist-linker.user.js`
  - Card Vault “Art by ...” link to artist search
- `fab-monkey-army-knife.user.js` (legacy combined script)
  - Uses GitHub raw URLs for `@updateURL` / `@downloadURL`
  - Bump `@version` to trigger auto-update

## GEM history CSV export

On https://gem.fabtcg.com/profile/history/ the script:

- Loads all history entries automatically
- Adds a "Copy CSV" button to copy the full history
- Exports columns: `title`, `start_time`, `store`, `event_type`, `format`, `match_record`
- `match_record` is the final wins-losses record (for example, `4-2`)

## Card Vault image URL copy

On https://cardvault.fabtcg.com/card/... the script:

- Adds buttons to copy the front and back image URLs
- Supports both absolute and relative image paths

## Card Vault artist link

On https://cardvault.fabtcg.com/card/... the script:

- Turns the “Art by ...” line into a link
- Links to `https://cardvault.fabtcg.com/results?page=1&artist_name=...`
