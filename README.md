# Toran

A toran is the garland of marigolds and mango leaves hung over an Indian doorway on festival days. This one hangs in your browser. Brush it and the bells ring. It sways with the live wind where you are.

Live at [toran.karanbansal.in](https://toran.karanbansal.in).

## What it does

- **Brush or grab** the strings with a mouse or a finger. One finger owns a drag until it lifts or the gesture is cancelled. Each string ends in a small brass bell, tuned to Raag Bhupali, so any sweep stays in tune.
- **Live wind** comes from [Open-Meteo](https://open-meteo.com/) for a city picked from your time zone. Pick another city or share your location to use your own wind. Above 12 km/h the wind rings the bells by itself. Each place is cached for 30 minutes, and if the API fails, times out or rate-limits, the page quietly uses a gentle breeze and pauses requests for 30 minutes.
- City and location wind refresh through the same timer. Late responses from a previous selection cannot change the current wind. A failed refresh preserves a reading only for the same selected place. If browser storage is blocked, the cache and rate-limit pause last for the current page session.
- **Three torans.** Marigold, a mango-leaf thoranam, and a beaded moti toran. Each has its own link (`#genda`, `#aam`, `#moti`).
- **Clip** records five seconds of the canvas with the bells, ready to save or share.
- **Sound is off on your first visit.** The speaker remembers your on/off choice in this browser, including after a refresh. If you left sound on, tap, click or press a key to resume the bells when you return. Motion is toned down when your system asks for reduced motion. Reduced-motion captions stay visible for seven seconds, then hide without animation.
- There is one secret.

The page is plain HTML, CSS and JavaScript with no build step and no runtime dependencies. Flowers, beads, leaves and bells are drawn in code, and the bells are synthesized with the Web Audio API, so a first visit loads under 100 KB of code and no images.

The sound choice stays in local browser storage. If storage is blocked or cleared, the next visit starts muted. Restoring sound waits for an interaction to respect [browser audio policies](https://developer.chrome.com/blog/autoplay/#web-audio).

On a first visit, the speaker pulses gently twice over three seconds to point out the bells. A page opened in a background tab waits until it becomes visible before starting or marking the hint as seen. The hint stops when you tap the speaker and does not repeat after a reload or a saved sound choice. Reduced motion and blocked storage skip the hint.

## Run it

```sh
python3 -m http.server 8391
```

Then open http://127.0.0.1:8391. Tests run with `npm test` (Node 20 or newer).

Browser regressions use [Playwright](https://playwright.dev/) as a development dependency. They start a separate local server on port 8392 and mock weather responses.

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

To use an existing Chrome installation, run `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` instead of installing Chromium.

## Add a door

Anyone can add one line about a door they remember through the [Add a door](https://github.com/karanb192/toran/issues/new?template=door.yml) form. When the maintainer labels the issue `approved`, a workflow opens a pull request that adds the line to `doors.json`. Merged lines hang on leaves with a yellow knot. Tap one to read it.

The workflow needs "Allow GitHub Actions to create and approve pull requests" turned on under Settings, Actions, General.

Door pull requests created with `GITHUB_TOKEN` need a maintainer to select **Approve workflows to run** before their CI checks start. See [GitHub's workflow trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow).

Something wrong about a region's toran? [Suggest a fix](https://github.com/karanb192/toran/issues/new?template=fix.yml).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go to the address in [SECURITY.md](SECURITY.md).

## Credits

Inspired by [Chimes](https://marinabudarina.github.io/chimes/) by [Marina Budarina](https://budarina.design), a beaded doorway curtain for every country. The strings use Verlet physics, the approach in [Liam Egan's CodePen](https://codepen.io/shubniggurath/pen/ZYpjorm) that Chimes builds on. No code, art or sound from either is used here. Wind data by [Open-Meteo](https://open-meteo.com/), CC BY 4.0.

## License

MIT, see [LICENSE](LICENSE).
