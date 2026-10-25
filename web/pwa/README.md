# Progressive web app

`pnpm build-web` generates the manifest, 180/192/512px icons from
`assets/logo.png`, and a Workbox service worker in `dist`. It also copies
PWA output into `bskyweb/static` for the Go server. Serve the complete build over
HTTPS (localhost also works). Development builds do not register a worker.

Development (`pnpm web`) and production (`pnpm build-web`) both use Expo's
Metro builder. Expo serves `public` directly in development and copies it into
`dist` for production. Cloudflare Pages uses `dist`.
The manifest and development icons live in `public/pwa`; production regenerates
the icons from the logo, preserving transparency. The install splash uses
Witchsky’s dark background.

Only build assets and a copy of the app shell are precached. Online navigation
always reaches the server; failed navigation falls back to the shell. API
responses, user media, and OAuth responses are not cached by the worker. Offline
feeds depend on data already persisted by the app; posting still needs a network
connection. Authentication, embeds, iframes, and about pages have no offline
navigation fallback.

An updated worker waits until all existing tabs and installed windows close.
There is no forced reload or skip-waiting prompt. Old precaches are cleaned up
when the next worker activates. Serve `/sw.js` with `Cache-Control: no-cache`;
Cloudflare Pages and the Go server are configured here.

## Browser verification

1. Serve a production build on localhost or HTTPS and open it online.
2. In browser developer tools, check Application > Manifest for the Witchsky
   name, icons, standalone display, and root scope. Install the app and launch it.
3. Wait for the service worker to activate, then go offline and reload a feed or
   profile URL. The shell should load; uncached network content may be unavailable.
4. Go online, deploy a new build, and reload. The new worker should wait while
   the old app is open. Close all app windows and reopen to activate the update.
5. Check that API requests and authentication responses are absent from Cache
   Storage. Unregister the worker and clear its caches before returning to local
   development on the same origin.
