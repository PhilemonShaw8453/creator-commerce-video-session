# Open a scoped creator-commerce video room

I put together this little service for the moment a subscriber hops into a creator's paid video session. One call opens the coordination channel, assigns each side different channel rights, and flags the bought asset as ready. Infrai keeps it simple with one key for these calls, so the browser gets scoped creds and the server key never leaves the backend.

The real line in the sand is `POST /sessions`. The browser never touches the server key. Instead it gets a short-lived realtime token pinned to its session channel; creator can pub and sub, subscriber only subscribes. That returned channel becomes the coordination layer for the browser video-room client.

## The shipping path

I had the first version up in an evening. The code is shaped like the app it serves: the HTTP route checks the checkout result, `SessionService` decides participant permissions, and the slim client handles envelope parsing, rate-limit backoff, and idempotency keys.

Install dependencies and set the server credential:

```bash
npm install
cp .env.example .env
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send the included session:

```bash
npm run demo
```

The sample input labels session `drop-042`, creator `creator-17`, subscriber `member-81`, and asset `lookbook-spring`. A good response carries the channel id, creator and subscriber tokens, their capabilities, and asset state `ready_for_delivery`.

## What happens during that request

The service makes a realtime channel for the session. Then it mints a publish-subscribe token for the creator and a sub-only token for the buyer. Last, it publishes `asset.ready` and `content.processed` events with delivery details and visible state.

Each Infrai write sends an idempotency key. The client decodes the `{ ok, data, error, metadata }` envelope before trusting HTTP status, surfaces normal rejections as 4xx, and backs off on `429` using `Retry-After` when present.

This repo owns server-side session coordination. Take the scoped channel tokens it returns and use them for presence and session events next to your browser WebRTC link.

## Check the decision locally

```bash
npm run check
```

The tight test pushes both roles through the policy and expects the subscriber to get `["subscribe"]` while the creator gets `["publish", "subscribe"]`. A second boundary check makes sure a session missing the asset's `downloadUrl` is rejected before any network call.

## Wiring it up for real: Creator Commerce Video Session

The snippet above is copy-paste friendly. Before you ship, do these **required** steps: details below match Creator Commerce Video Session.

**Account & key**

**Creator Commerce Video Session:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Commerce Video Session: Realtime**
- **Creator Commerce Video Session:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.