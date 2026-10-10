# ringback
Landing page for Ringback, an AI phone assistant for plumbers in Gauteng

## Things to supply

- **Sample call audio.** Put one recording per trade in `audio/`, named by trade key:
  `plumbing.mp3`, `electrical.mp3`, `gates.mp3`, `solar.mp3`, `pest.mp3`, `aircon.mp3`, `locksmith.mp3`.
  A player appears on the home page and trades page once a file exists. Each recording should follow
  that trade's example transcript in `site.js` (`RB.TRADES`). For exact highlighting, add
  `cues:[0, 4.5, 9, 15.2]` to the trade: the second each line starts.
- **Call-forwarding codes.** `RB.FORWARD` in `site.js` holds the standard GSM codes. Check each network
  and set `verified:'YYYY-MM-DD'`. Put any network-specific differences in `overrides`.
- **Founding places counter.** Run `supabase/founding_spots.sql` once in the Supabase SQL editor.
  Until then the counter on the pricing page stays hidden.
