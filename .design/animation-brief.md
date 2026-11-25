# Ringback: look and animation brief

Three parts: the first draft, a review of it, and the improved prompt that gets built.

---

## 1. First draft

> Make the Ringback site look more premium and add cool animations.
>
> - Hero: headline and buttons fade in on load, the phone slides up, then the call demo starts.
> - Fade-up scroll reveals on every section, with child items staggered.
> - Animated counters for the facts ("under a minute", "24/7", "20 seconds").
> - The SMS card slides in when it scrolls into view.
> - Outcome cards tilt on hover and their coloured top borders draw in.
> - Trade cards stagger in; their icons bounce on hover.
> - The "things you could say" chips float gently.
> - The three steps get a progress line.
> - The navy closing band gets an animated gradient.
> - Page transitions between pages.
> - A soft glow that follows the cursor on desktop.
> - Glass-effect navigation and a gradient mesh behind the hero.
> - Keep it mobile friendly.

---

## 2. Review of the draft

**What works**
- A load sequence for the hero, the SMS card arriving, and page transitions are good ideas.
- It keeps the dark demo phone as the centrepiece.

**What's wrong with it**
1. **It brings the clutter back.** You said the old site felt too busy. This draft has 13 effects, and most of them run on every section. Moving everything means nothing stands out.
2. **Most of it is the generic "AI website" kit:** fade-up on every section, tilting cards, floating chips, a cursor glow, glass navigation, a gradient mesh and an animated gradient. You said the old site looked generic, and this would look generic again.
3. **Some ideas don't fit the content.** "Under a minute" and "24/7" aren't numbers you can count up to, so counters would look broken.
4. **It isn't about phone calls.** Nothing in the motion tells Ringback's story, which is that a missed call becomes a text you can act on.
5. **No guard rails:**
   - nothing on reduced motion (people who turn animation off on their phone);
   - nothing on what happens if the script fails (content must never stay hidden);
   - nothing on layout shift, performance on mid-range Android phones, or prepaid data costs (it implies an animation library);
   - no rule that animations play once rather than every time you scroll past.
6. **No visual fixes.** The current site has real problems the draft ignores:
   - the privacy section has no space above it;
   - on desktop there's a large empty area under the hero text;
   - the product page's little call-flow diagram is faint and too small.
7. **No way to check it's done.** There are no acceptance checks.

---

## 3. Improved prompt (this is what gets built)

> **Goal.** Make Ringback feel more alive and more trustworthy without making it busy again. The motion follows one idea: **a missed call, handled.** Each moving piece shows a step in that story: the call comes in, the assistant answers, the call is sorted, the text arrives, and you're live the same day. The dark demo phone stays the boldest thing on the page. Everything else stays quiet.
>
> **Signature moments (home page)**
> 1. **Opening (plays once on load, under 1 second).** The two headline lines rise into place one after the other, then the buttons and the three ticks. Then the phone rises and the live call demo starts. Without JavaScript, everything is simply there.
> 2. **The text arrives (#alert).** When the navy panel is mostly on screen, the SMS drops in from the top like a real notification and gives two short buzzes. Then the "Listen to the call" link underlines itself. It plays once.
> 3. **Sorted (#features).** As the three outcome cards come into view, each example gets a result stamped onto it:
>    - Emergencies: "Alert sent to you"
>    - Routine jobs: "Booked · Tue 09:00"
>    - Quotes: "Added to callbacks"
>
>    Each result shows a tick that draws itself, 120ms apart. This adds real information, not just motion.
> 4. **Live the same day (#how).** The line joining steps 1, 2 and 3 fills as you scroll through the section. On browsers without scroll-linked animation, the line is just shown full.
> 5. **Calls are recorded (#privacy).** No motion. This section should feel still and solid.
>
> **Everywhere**
> - **Buttons:**
>   - a 0.97 press on tap or click;
>   - on hover (desktop only), the main button's orange deepens.
> - **Cards and links:**
>   - cards that are links lift 2px with a slightly deeper shadow (desktop only);
>   - text links grow their underline.
> - **"Things you could say" chips.** Tapping one shows a tick and "Copied" for 1.2 seconds.
> - **Page to page.** A short cross-fade between pages (cross-document View Transitions), with the header held still. Browsers that don't support it just change page normally.
> - **Product page hero diagram.** Make it bigger and readable. Draw its path once on load (Call → Ringback → Emergency, Booked or Callback → SMS), then leave it still.
>
> **Look fixes**
> - Give the privacy section proper top spacing. Check the spacing rhythm of every home section at 390px and 1440px.
> - Desktop hero: centre the text block against the phone so there's no dead space under it.
> - Product hero diagram: larger, body font, readable labels.
>
> **Rules**
> - **No libraries.** Plain CSS and the existing `RB` helpers (IntersectionObserver and `RB.mq`). Under about 8KB of new code.
> - **Motion and timing:**
>   - animate only `transform` and `opacity` (plus stroke for the ticks and lines);
>   - durations between 150ms and 700ms, using the site's `--ease-out`;
>   - each moment plays once;
>   - nothing loops except the existing phone demo.
> - **Content stays visible without JavaScript.** Content is only hidden before it animates when `html.js-motion` is set, and that class is added by script only when motion is allowed.
> - **Reduced motion:** every moment shows its finished state straight away. No movement, no hidden content.
> - **Phones:** the same story moments, with smaller distances (8px rather than 16px). Hover effects only on hover-capable screens. No information is only available on hover.
> - **No layout shift:** the stamped results and lines take up their space from the start.
>
> **Done when**
> - All pages at 360, 390, 412 and 1440px have no horizontal scroll and no console errors, and layout shift is under 0.05.
> - With reduced motion on, screenshots match the finished state.
> - With JavaScript off, the home page shows all content.
> - Visual check of the home page, the product page and one inner page on phone and desktop.
