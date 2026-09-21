import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const sessionRequestSchema = z.object({
  sessionId: z.string().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  creator: z.object({ id: z.string().min(1), displayName: z.string().min(1).max(80) }),
  subscriber: z.object({ id: z.string().min(1), displayName: z.string().min(1).max(80) }),
  asset: z.object({ id: z.string().min(1), title: z.string().min(1), downloadUrl: z.string().url() }),
});

export type SessionRequest = z.infer<typeof sessionRequestSchema>;
export type ParticipantRole = "creator" | "subscriber";

export function channelCapabilities(role: ParticipantRole) {
  return role === "creator" ? ["publish", "subscribe"] : ["subscribe"];
}

type Channel = { channel?: string; id?: string };
type Token = { token: string; expires_at?: string };

export class SessionService {
  private readonly infrai: InfraiClient;

  constructor(infrai: InfraiClient) {
    this.infrai = infrai;
  }

  async open(input: SessionRequest) {
    const operationId = randomUUID();
    const channelName = `session-${input.sessionId}`;

    const channel = await this.infrai.post<Channel>(
      "/v1/realtime/channel/create",
      { channel: channelName, type: "private", vendor: "auto" },
      `${operationId}:channel`,
    );

    const creatorToken = await this.issueChannelToken(channelName, input.creator.id, "creator", operationId);
    const subscriberToken = await this.issueChannelToken(
      channelName,
      input.subscriber.id,
      "subscriber",
      operationId,
    );

    await this.infrai.post(
      "/v1/realtime/publish",
      {
        channel: channelName,
        event: "asset.ready",
        data: { assetId: input.asset.id, title: input.asset.title, downloadUrl: input.asset.downloadUrl },
        account_id: input.creator.id,
      },
      `${operationId}:asset-ready`,
    );
    await this.infrai.post(
      "/v1/realtime/publish",
      {
        channel: channelName,
        event: "content.processed",
        data: { assetId: input.asset.id, state: "ready_for_delivery" },
        account_id: input.creator.id,
      },
      `${operationId}:content-processed`,
    );

    return {
      sessionId: input.sessionId,
      channel: channel.channel ?? channel.id ?? channelName,
      creator: { token: creatorToken.token, capabilities: channelCapabilities("creator") },
      subscriber: {
        token: subscriberToken.token,
        capabilities: channelCapabilities("subscriber"),
      },
      asset: { id: input.asset.id, state: "ready_for_delivery" as const },
    };
  }

  private issueChannelToken(
    channel: string,
    clientId: string,
    role: ParticipantRole,
    operationId: string,
  ) {
    return this.infrai.post<Token>(
      "/v1/realtime/token/issue",
      {
        client_id: clientId,
        channels: [channel],
        capabilities: channelCapabilities(role),
        ttl_seconds: 3600,
      },
      `${operationId}:${role}-channel-token`,
    );
  }
}
