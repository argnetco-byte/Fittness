# Stride — private Exercise Log sync

Stride reads and appends to the existing private Google Sheet's **Exercise Log** tab. Workouts come from the Sheet, distances are miles, and goals remain browser-local. No Sheet sharing settings are changed, and no personal workout data or credentials are shipped with the site.

## Prepare the existing Netlify site

Target: https://profound-swan-15023d.netlify.app

1. In Google Cloud, enable **Google Sheets API**. Configure the OAuth consent screen for a personal external app and add your Google account as a test user if using testing mode.
2. Create an OAuth **Web application** client. Add `https://profound-swan-15023d.netlify.app` as an authorized JavaScript origin (no trailing slash). Add `http://localhost:8888` only if using Netlify Dev locally. The popup token flow does not need a redirect URI or client secret. The app requests `https://www.googleapis.com/auth/spreadsheets`; Google grants this scope across the account's accessible Sheets, while Stride's backend is hardcoded to this one Sheet. Review Google's consent screen before authorizing. Testing-mode restrictions and external-app verification policies may affect availability.
3. In this existing Netlify site's environment settings, set **GOOGLE_CLIENT_ID** to that client's public ID, available to Functions. No Google client secret, API key, service-account key, or ChatGPT connector token is used.
4. Link this site's existing build configuration to `argnetco-byte/Fittness`. Do not create a second site. Build command: `npm run build`; publish directory: `dist`; functions directory: `netlify/functions`; Node: 22. The checked-in `netlify.toml` contains these settings. Blobs must be available to the site's Functions for conditional, strongly consistent writes.
5. Deploy this reviewed branch to the existing site when ready. If using a Netlify deploy preview, its exact HTTPS origin must also be authorized in Google Cloud before Google sign-in works there. A preview uses the site-wide write coordination store and the real Sheet, so avoid test writes with real authorization.
6. Open Stride and choose **Connect Google** with the account that owns or can edit the Sheet. Authorize access. A ChatGPT Google connection does not transfer authorization to a deployed web app; this separate consent is required.

Keep the Sheet private: do not publish to web or enable anyone-with-link access. Stride can only load data using the short-lived Google token you authorize. Tokens stay in page memory, are never stored in browser storage or Blobs, and are forwarded only to the same-origin backend and Google Sheets. Disconnect clears displayed workouts and the token; it does not revoke Google's previously granted consent. Revoke consent in Google account settings if desired. No workout caching or offline write queue is used.

## Sheet schema and writes

Existing A:H headers must remain:

`Date | Exercise | Duration (min) | Distance (mi) | Pace (min/mi) | Calories Burned | Source | Notes`

On the first authorized save, the app reserves blank column I as **Stride ID**. If I already contains another header, syncing stops for review. Existing rows are preserved. New rows use RAW input to keep notes literal rather than execute formulas. Dates are ISO `YYYY-MM-DD`; existing US-formatted dates are also supported. Blank distance remains blank; calories are not guessed. Pace is calculated only when miles are greater than zero. Invalid dated rows are skipped with a visible warning.

Old browser-local workouts are shown separately for manual review and are never auto-uploaded. Old distance goals are converted from km to miles once. Goals are saved on this device, not in the Sheet.

## Duplicate protection and recovery

The frontend disables saving while busy and retains the save ID on retry. The backend checks that ID and a normalized date/type/duration/miles/notes fingerprint against Sheet rows, including older rows without IDs. Different IDs for the same data are duplicates. Use distinct notes to distinguish two otherwise identical sessions.

Netlify Blobs uses an atomic `onlyIfNew` acquisition and strong consistency to serialize app writes. No timeout-based lock takeover is used: after a crash or an ambiguous append response, the lock deliberately remains held so another request cannot blindly append a duplicate. A retry can still confirm an already committed save by its Sheet ID. Other saves remain blocked until the owner reviews the lock.

To recover a persistent blocked save:

1. Wait until no Function invocation is running; inspect Netlify's Function status/logs without exposing authorization headers.
2. Inspect `sheet-write-lock` in store `stride-write-coordination` and note its ID. Check column I in the Sheet for that ID and verify the row contents.
3. Resolve the original request's outcome before deleting that lock entry in Netlify's Blobs management interface. Never remove a lock while a request could still write. If the outcome cannot be established, keep writes blocked for review.
4. Refresh and retry. Existing rows are checked again before any append.

This serializes saves made by this Netlify site. External writers (manual edits, other scripts, other sites) do not participate in the lock. Avoid editing/appending the same workout externally during a Stride save. Do not delete or repurpose Stride IDs. The app does not delete Sheet rows.

## Validate

```sh
npm install
npm test
npm run build
npx netlify dev
```

Unit tests cover Sheet parsing, miles and unknown values, goal and chart totals, legacy duplicate matching, retries, concurrent saves, ID conflicts, schema changes, and uncertain write behavior. After OAuth setup, verify load, token expiry/reconnect, one actual authorized save, and repeated-submit behavior in the deployed site. No live test workouts have been added during development.

References: [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Netlify Blobs conditional writes](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).
