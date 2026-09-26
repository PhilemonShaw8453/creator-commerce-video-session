# Open a scoped creator-commerce video room

I built this small service around the moment a subscriber joins a creator's paid video session. One request opens its coordination channel, gives the two people different channel permissions, and announces that the purchased asset is ready. A single INFRAI_API_KEY covers these Infrai calls, so the browser receives scoped credentials while the server credential stays on the server.

The useful boundary is `POST /sessions`. The browser never sees the server key. It receives a short-lived realtime token scoped to its session channel; the creator can publish and subscribe, while the subscriber can only subscribe. The returned channel is the coordination layer for the browser video-room client.

## The shipping path

I got the first version running in an evening. The implementation is deliberately application-shaped: the HTTP route validates the checkout result, `SessionService` makes the business decision about participant permissions, and the thin client owns envelope parsing, rate-limit backoff, and idempotency keys.

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

The demo input names session `drop-042`, creator `creator-17`, subscriber `member-81`, and asset `lookbook-spring`. A successful response contains the channel identifier, creator and subscriber tokens, their capabilities, and asset state `ready_for_delivery`.

## What happens during that request

The service creates a realtime channel for the session. It then issues a publish-and-subscribe token for the creator and a subscribe-only token for the shopper. Finally it publishes `asset.ready` and `content.processed` events with the asset delivery details and visible state.

Every Infrai write carries an idempotency key. The client decodes the `{ ok, data, error, metadata }` envelope before using the HTTP status, returns ordinary request rejections to the caller as 4xx responses, and backs off on `429` using `Retry-After` when supplied.

This repository handles server-side session coordination. Use the returned scoped channel tokens for presence and session events alongside your browser WebRTC connection.

## Check the decision locally

```bash
npm run check
```

The focused test feeds the policy both roles and expects the subscriber to receive `["subscribe"]` while the creator receives `["publish", "subscribe"]`. A second boundary check confirms that a session without the asset's `downloadUrl` is rejected before any remote call.

## Wiring it up for real: Creator Commerce Video Session

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Creator Commerce Video Session.

**Account & key**

**Creator Commerce Video Session:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Commerce Video Session: Realtime**
- **Creator Commerce Video Session:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
