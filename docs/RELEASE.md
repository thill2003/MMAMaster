# MMA Master — versions, build numbers and the release checklist (MM-223)

How a build is numbered and what is checked before it goes to TestFlight, Google Play or the web playtest
URL. The release stories around it are MM-220 (icons, privacy manifest, keystore), MM-221 (TestFlight and
Cloudflare Pages), MM-222 (store listings) and MM-224 (crash reporting and analytics). This is a draft by an
agent; every rule here is the Product Architect's to change.

## Version

`MAJOR.MINOR.PATCH`, and **`version` in `package.json` is the only place it is written.** Everything else —
iOS `CFBundleShortVersionString` (Xcode's `MARKETING_VERSION`), Android `versionName`, the git tag — is
copied from it at release time.

| Part | Goes up when | Example |
|---|---|---|
| `MAJOR` | `0` until the first store release; `1.0.0` is v1 in the stores. After that, only for a release the plan calls a new version of the game (a new metro is MINOR). | `0.9.0` → `1.0.0` |
| `MINOR` | A release that adds or changes play: a milestone (M0–M5), new levels, retuned difficulty, new screens. Resets `PATCH`. | `1.0.3` → `1.1.0` |
| `PATCH` | Fixes only — nothing a player would call new. | `1.1.0` → `1.1.1` |

- The version is bumped **only on a release**, in its own PR on a `chore/release-<version>` branch, by the
  Product Architect. Feature PRs and agent branches never change it.
- The save format has its own number (`SAVE_VERSION` in `core/progress`) and does not follow the app
  version. A release that bumps `SAVE_VERSION` needs the migration and its test in the same release, and the
  release notes say so.

## Build number

One integer, used for both iOS `CFBundleVersion` (Xcode's `CURRENT_PROJECT_VERSION`) and Android
`versionCode`, read off the version:

```
build = MAJOR × 1,000,000 + MINOR × 10,000 + PATCH × 100 + N
```

`N` is the upload counter for that version, starting at `1`: the first build of `1.2.3` is `1020301`, a
second upload of the same version (a rejected TestFlight build, a fixed signing setting) is `1020302`.

Why this shape:

- Both stores refuse a build number that is not higher than the last one uploaded. Because the version
  only goes up, the build number always does too, with no counter to keep anywhere.
- A build number on a crash report or a tester's screenshot says which version it is without a lookup.
- It fits Android's `versionCode` ceiling (2,100,000,000) up to version 2099, and leaves room for 99
  `MINOR`s, 99 `PATCH`es and 99 uploads per version.
- `0.x` builds land below every `1.x` build, so TestFlight builds before v1 never block the store build.

A version is never uploaded with an `N` that was used before, even if that upload failed; the next try
takes `N + 1`.

The web build (Cloudflare Pages, MM-221) carries the version only; it has no build number.

## Tags

Every build uploaded to a store is tagged on the commit it was built from, as an annotated tag
`v<version>-b<build>` (for example `v1.2.3-b1020301`). The tag is how a build is traced back to its code and
how the next `N` is found: `git tag -l "v1.2.3-*"`. Tags are pushed by the Product Architect; agents do not
push.

## Release checklist

Copy this into the `chore/release-<version>` PR description and tick it there.

### Before the bump

- [ ] Everything going into the release is merged to `main`, and `main` is green in CI.
- [ ] `docs/BUILD_STATUS.md` is current: what is in the release, and what is still unverified.
- [ ] Device check done on the floor devices (MM-213) for everything a player sees or feels that changed
      since the last release, including 60 fps (MM-214). Until MM-213 exists, the PR says "not yet
      device-checked".
- [ ] If `SAVE_VERSION` changed: a save from the last released version loads, and the migration test is in.
- [ ] Every file in `assets/` has a row in `LICENSES.md`; no real businesses, logos or other games' names
      or characters (plan §12).
- [ ] App id in `capacitor.config.ts` is the real one (it cannot change after the first store upload).
- [ ] Orientation is still the one value in `capacitor.config.ts` and `src/content/display.ts`.
- [ ] Icons, splash, iOS privacy manifest and Android keystore are in place (MM-220); the privacy
      disclosure matches what MM-224 decided.

### Bump and build

- [ ] Branch `chore/release-<version>` from `main`; set `version` in `package.json`; PR and merge.
- [ ] Work out the build number with the formula above; check `git tag -l "v<version>-*"` for the next `N`.
- [ ] From the merged commit, on a clean checkout: `pnpm install --frozen-lockfile`, then
      `pnpm lint && pnpm test && pnpm build`.
- [ ] `pnpm cap:sync`.
- [ ] iOS: in Xcode set `MARKETING_VERSION` to the version and `CURRENT_PROJECT_VERSION` to the build
      number; archive with the release signing identity.
- [ ] Android: in `android/app/build.gradle` set `versionName` to the version and `versionCode` to the build
      number; build the signed release bundle with the upload keystore.

### Ship

- [ ] Upload to TestFlight (and Play internal testing once Android ships); the web build goes to the
      Cloudflare Pages playtest URL (MM-221).
- [ ] Install the uploaded build from TestFlight on a real device and play Fenton to the results screen.
- [ ] Tag the commit `v<version>-b<build>` and push the tag.
- [ ] Store listing text and screenshots are current (MM-222) before submitting for review.
- [ ] After release: add the release to `docs/BUILD_STATUS.md` with its version, build number and date.
