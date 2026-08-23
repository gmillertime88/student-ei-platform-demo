# qa/ — Student EI Demo Test Harness

Headless-browser regression suite for `../index.html`. 60 checks: full student flow (registration → welcome → assessment → all five tabs), staff regression across every district route, role guards both directions, and the hidden-student leak check (no restricted student's name may render on any student route).

## Run it

```bash
cd qa
npm init -y && npm i playwright          # first time only
npx playwright install chromium          # first time only (skip if CHROME_PATH is set)
node qa.js
```

Environment overrides:

- `DEMO_FILE=/path/to/index.html` — test a different copy (default: `../index.html`)
- `CHROME_PATH=/path/to/chrome` — use an existing Chromium instead of Playwright's download. In the Claude cloud sandbox: `CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (adjust the version suffix to what's in `/opt/pw-browsers/`), with `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`.

Output: PASS/FAIL per check, screenshots of every screen in `qa/shots/`, exit code 1 on any failure. The `ERR_CONNECTION` console filter exists because the Google Fonts fetch fails offline; that is expected, not a bug.

## Maintaining it

- New screen or behavior → add checks in the same change.
- Never delete the leak check or the staff-regression loop.
- `patch_template.py` is the editing pattern for `index.html`: exact-count string replacement with asserts, aborting atomically on any anchor mismatch. Copy it per change; don't edit the demo by hand in a 300KB file.
- `node_modules/` and `shots/` are gitignored; only `qa.js`, `patch_template.py`, and this README are versioned.

Claude sessions: read the client `STATUS.md` and `../DEMO.md` before changing the demo or this harness.
