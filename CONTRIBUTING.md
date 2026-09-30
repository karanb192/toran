# Contributing

Thanks for wanting to help. Toran is small on purpose, so the bar for a change is that it keeps the first swipe instant and the page light.

## Add a door

The easiest contribution needs no code. Open the [Add a door](https://github.com/karanb192/toran/issues/new?template=door.yml) form and write one line about a door you remember. Once it is approved, a pull request adds it to `doors.json` and it hangs on a leaf.

## Fix a cultural detail

If something about a toran, a word or a region is wrong, use [Suggest a fix](https://github.com/karanb192/toran/issues/new?template=fix.yml). A source helps.

## Code changes

1. Fork the repo and create a branch.
2. Run the site locally with `python3 -m http.server 8391` and open http://127.0.0.1:8391.
3. Run the tests.

   ```sh
   npm ci
   npm test
   npx playwright install chromium
   npm run test:browser
   ```

4. Open a pull request that says what changed and why. For anything you can see or hear, add a screenshot or a short clip from the running page.

Please keep these constraints.

- No runtime dependencies, build step, CDN scripts, web fonts, trackers or analytics. Test tooling as a dev dependency is fine.
- Sound stays off until the visitor turns it on, and reduced motion is respected.
- It has to work on a phone with touch as well as with a mouse.
- A new toran style needs an accurate description of where and how that toran is used.
- Visitor text is only ever rendered with `textContent`.
