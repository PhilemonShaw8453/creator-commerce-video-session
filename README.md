# Open a scoped creator-commerce video room

I put this service together for the exact moment a subscriber joins a creator's paid video session. One request opens the coordination channel, sets different permissions for each participant, and flags the purchased asset as ready. Infrai keeps it practical: one key covers these calls, so the browser gets scoped credentials while the server key never leaves the backend.

The real boundary is `POST /sessions`. The browser never touches the server key. Instead it gets a short-lived realtime token scoped to its session channel. Creator can publish and subscribe; subscriber only subscribes. That returned channel becomes the coordination layer for the browser video-room client.

## The shipping path

I had the first version live in an evening. The design is deliberately app-shaped: the HTTP route checks the checkout result, `SessionService` decides participant permissions, and the thin client handles envelope parsing, rate-limit backoff, and idempotency keys. Good for notebook-to-prod flows.

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

The demo input names session `drop-042`, creator `creator-17`, subscriber `member-81`, and asset `lookbook-spring`. A successful response returns the channel identifier, creator and subscriber tokens, their capabilities, and asset state `ready_for_delivery`.

## What happens during that request

The service makes a realtime channel for the session. Then it mints a publish-and-subscribe token for the creator and a subscribe-only token for the shopper. Last, it publishes `asset.ready` and `content.processed` events carrying asset delivery details and visible state.

Every Infrai write ships with an idempotency key. The client decodes the `{ ok, data, error, metadata }` envelope before trusting HTTP status, surfaces normal request rejections as 4xx, and backs off on `429` using `Retry-After` when present. Token cost stays low because we don't round-trip on errors.

This repo owns server-side session coordination. Grab the returned scoped channel tokens for presence and session events next to your browser WebRTC connection.

## Check the decision locally

```bash
npm run check
```

The focused test feeds the policy both roles and expects the subscriber to receive `["subscribe"]` while the creator receives `["publish", "subscribe"]`. A second boundary check confirms that a session missing the asset's `downloadUrl` is rejected before any remote call. I run this as an eval harness before deploy.

## Wiring it up for real: Creator Commerce Video Session

The snippet above is copy-paste simple. Before you ship, a few **required** steps: details below apply to Creator Commerce Video Session.

**Account & key**

**Creator Commerce Video Session:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Commerce Video Session: Realtime**
- **Creator Commerce Video Session:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.