# Toran

A toran is the garland of marigolds and mango leaves hung over an Indian doorway on festival days. This one hangs in your browser. Brush it and the bells ring. It sways with the live wind where you are.

Live at [toran.karanbansal.in](https://toran.karanbansal.in).

## What it does

- **Brush or grab** the strings with a mouse or a finger. Each string ends in a small brass bell, tuned to Raag Bhupali, so any sweep stays in tune.
- **Live wind** comes from [Open-Meteo](https://open-meteo.com/) for a city picked from your time zone. Pick another city or share your location to use your own wind. Above 12 km/h the wind rings the bells by itself. Each place is cached for 30 minutes, and if the API fails, times out or rate-limits, the page quietly uses a gentle breeze and pauses requests for 30 minutes.
- **Three torans.** Marigold, a mango-leaf thoranam, and a beaded moti toran. Each has its own link (`#genda`, `#aam`, `#moti`).
- **Clip** records five seconds of the canvas with the bells, ready to save or share.
- **Sound is off** until you tap the speaker, and motion is toned down when your system asks for reduced motion.
- There is one secret.

The page is plain HTML, CSS and JavaScript with no build step and no dependencies. Flowers, beads, leaves and bells are drawn in code, and the bells are synthesized with the Web Audio API, so a first visit loads under 100 KB of code and no images.

## Run it

```sh
python3 -m http.server 8391
```

Then open http://127.0.0.1:8391. Tests run with `npm test` (Node 20 or newer).

## Add a door

Anyone can add one line about a door they remember through the [Add a door](https://github.com/karanb192/toran/issues/new?template=door.yml) form. When the maintainer labels the issue `approved`, a workflow opens a pull request that adds the line to `doors.json`. Merged lines hang on leaves with a yellow knot. Tap one to read it.

The workflow needs "Allow GitHub Actions to create and approve pull requests" turned on under Settings, Actions, General.

Something wrong about a region's toran? [Suggest a fix](https://github.com/karanb192/toran/issues/new?template=fix.yml).

## Credits

Inspired by [Chimes](https://marinabudarina.github.io/chimes/) by [Marina Budarina](https://budarina.design), a beaded doorway curtain for every country. The strings use Verlet physics, the approach in [Liam Egan's CodePen](https://codepen.io/shubniggurath/pen/ZYpjorm) that Chimes builds on. No code, art or sound from either is used here. Wind data by [Open-Meteo](https://open-meteo.com/), CC BY 4.0.

## License

MIT, see [LICENSE](LICENSE).
