import assert from "node:assert/strict";
import test from "node:test";
import { channelCapabilities, sessionRequestSchema } from "../src/session_service.js";

test("a subscriber can receive session updates but only the creator can publish", () => {
  assert.deepEqual(channelCapabilities("subscriber"), ["subscribe"]);
  assert.deepEqual(channelCapabilities("creator"), ["publish", "subscribe"]);
});

test("the session boundary rejects an asset without a delivery URL", () => {
  const result = sessionRequestSchema.safeParse({
    sessionId: "drop-042",
    creator: { id: "creator-17", displayName: "Mina" },
    subscriber: { id: "member-81", displayName: "Alex" },
    asset: { id: "lookbook-spring", title: "Spring lookbook" },
  });
  assert.equal(result.success, false);
});
