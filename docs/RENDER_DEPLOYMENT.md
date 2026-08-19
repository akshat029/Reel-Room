# Deploying ReelRoom

Backend (REST + WebSocket) runs on **Render**. Frontend runs on **Vercel**.
They are separate deployments and must be pointed at each other with environment variables.

---

## 1. Why the Render build failed

```
src/config.ts(1,20): error TS2307: Cannot find module 'dotenv' ...
src/config.ts(5,20): error TS2591: Cannot find name 'process' ...
src/server.ts(1,21): error TS2307: Cannot find module 'express' ...
```

Around 80 errors, all of the same family: *nothing was installed*.

Render runs **only** the Build Command you configure - it does not run `npm install`
for you when a custom build command is present. The configured command was:

```
npm run build -w packages/shared && npm run build -w packages/backend
```

So `tsc` ran against an empty `node_modules`. Every dependency and every ambient
type (`process`, `console`, `URL`, `fetch`, `setInterval`) was missing, which is why
`AuthenticatedSocket` also lost `.on()`, `.send()`, `.ping()` etc. - `ws` was not
there to extend from.

It is **not** a TypeScript configuration bug and **not** a lockfile problem.

---

## 2. Render service settings

Dashboard -> your service -> **Settings**:

| Setting | Value |
| --- | --- |
| Root Directory | *(blank - this is a workspaces monorepo, install must run at the root)* |
| Build Command | `npm install --include=dev && npm run build -w packages/shared && npm run build -w packages/backend` |
| Start Command | `npm start -w packages/backend` |
| Health Check Path | `/health` |

`--include=dev` is required: `NODE_ENV=production` makes npm skip
`devDependencies`, and `typescript` plus every `@types/*` package lives there.

After changing settings use **Manual Deploy -> Clear build cache & deploy** once.

---

## 3. Render environment variables

| Key | Value | Notes |
| --- | --- | --- |
| `NODE_VERSION` | `20.19.0` | pins the runtime; Render otherwise defaults to Node 24 |
| `NODE_ENV` | `production` | |
| `JWT_SECRET` | 32+ random characters | room tokens are signed with this |
| `CORS_ORIGIN` | `https://<your-app>.vercel.app` | exact origin, **no trailing slash** |
| `INSTAGRAM_ACCESS_TOKEN` | optional | only for authenticated oEmbed |

Do **not** set `PORT`. Render injects it and `src/config.ts` already reads
`process.env.PORT`. Hardcoding it will make health checks fail.

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Give Render access to the repository

The build log starts with:

```
==> It looks like we don't have access to your repo, but we'll try to clone it anyway.
```

The clone only succeeded because the repository is public. Fix it so that
auto-deploy and private access work:

Render -> account settings -> **GitHub** -> *Configure* -> grant access to `Reel-Room`.

---

## 5. Code changes in this commit

### `packages/shared/tsconfig.json`, `tsconfig.esm.json`, `package.json`, `scripts/write-esm-marker.mjs`

The root `tsconfig.json` sets `"module": "ESNext"`, so `packages/shared` compiled to
ESM (`export { ... }`) while its `package.json` has no `"type": "module"` - which
formally makes those `.js` files CommonJS. The backend compiles with `NodeNext` and
emits `require("@reelroom/shared")`.

Node 20.19+/22.12+ can `require()` an ES module, so this can appear to work; older
runtimes throw `ERR_REQUIRE_ESM` outright. Rather than depend on that, `shared` now
ships both formats:

- `dist/index.js` - CommonJS, used by the backend (`main`)
- `dist/esm/index.js` - ESM, used by Vite/Vercel (`module`)
- `dist/index.d.ts` - types for both (`types`)
- `dist/esm/package.json` (`{"type":"module"}`) is generated at build time by
  `scripts/write-esm-marker.mjs` so Node never has to guess the format.

Build script becomes:

```json
"build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json && node scripts/write-esm-marker.mjs"
```

### `packages/backend/tsconfig.json`

Adds `"types": ["node"]`. With `"lib": ["ES2022"]` and no DOM lib, `process`,
`console` and `setInterval` come exclusively from `@types/node`; stating it
explicitly turns a confusing wall of `TS2591`/`TS2584` errors into one clear
"Cannot find type definition file for 'node'" if the install ever breaks again.

### `vercel.json` (root)

Adds the SPA rewrite. It previously existed only in `packages/frontend/vercel.json`,
which Vercel ignores because the project builds from the repository root - so
reloading `/room/ABC123` returned 404.

### `render.yaml`

Blueprint form of section 2/3 so the service can be recreated from scratch.
An existing dashboard-configured service ignores this file.

No dependency versions were touched, so `package-lock.json` stays in sync and
`npm ci` in CI keeps working.

---

## 6. Vercel (frontend)

Project -> Settings -> Environment Variables:

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://<your-service>.onrender.com` |
| `VITE_WS_URL` | `wss://<your-service>.onrender.com` |

No trailing slash, and **no `/ws` suffix** - `src/lib/wsClient.ts` appends `/ws`
itself. Vite inlines `import.meta.env.*` at build time, so **redeploy** after
changing these; setting them without a rebuild changes nothing.

These two variables are the usual reason a deployed frontend "loads but does
nothing": without them the app falls back to `window.location.host` and talks to
Vercel instead of Render.

---

## 7. Verify

```bash
# 1. backend is up
curl -i https://<your-service>.onrender.com/health

# 2. room creation works end to end
curl -s -X POST https://<your-service>.onrender.com/api/rooms \
  -H 'Content-Type: application/json' \
  -d '{"hostName":"smoke-test"}'

# 3. CORS is correct for the browser
curl -s -o /dev/null -D - -X OPTIONS https://<your-service>.onrender.com/api/rooms \
  -H 'Origin: https://<your-app>.vercel.app' \
  -H 'Access-Control-Request-Method: POST'
```

Step 3 must return `access-control-allow-origin` matching your Vercel domain.

In the browser: DevTools -> Network -> **WS** -> the `/ws` request must show
`101 Switching Protocols`. On Render's free plan the first request after ~15
minutes idle takes up to ~50 s while the instance wakes; the client retries
every 3 s, so it recovers on its own.

---

## 8. Local development

```bash
rm -rf node_modules packages/*/node_modules
npm install
npm run build -w packages/shared
npm run dev
```

`packages/shared` must be built before the backend or frontend can resolve it.

---

## 9. Screen share, camera and microphone

Browser side needs no extra setup: `getDisplayMedia`/`getUserMedia` require a
secure context, and both Vercel and Render are HTTPS. Permission prompts are
per-user and cannot be pre-granted.

WebRTC currently uses STUN only:

```ts
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};
```

STUN only tells a peer its public address; it cannot relay. Peers behind
symmetric NAT, corporate firewalls or many mobile carriers will connect to the
room, exchange chat and stay in sync, but the video/audio track will never
arrive. Fixing that requires a **TURN** server - a paid/hosted component, not a
code-only change:

- Cloudflare Realtime TURN, Metered, Twilio Network Traversal Service, or
  self-hosted `coturn`.
- Add the credentials to `ICE_CONFIG` in `packages/frontend/src/lib/screenShare.ts`.
- Prefer minting **short-lived HMAC credentials** from the backend
  (e.g. `GET /api/ice`) instead of shipping static TURN credentials in the
  frontend bundle, where anyone can read them.
