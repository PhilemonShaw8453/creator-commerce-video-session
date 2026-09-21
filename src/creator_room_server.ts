import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { SessionService, sessionRequestSchema } from "./session_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const sessions = new SessionService(new InfraiClient(apiKey));
const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/sessions") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = sessionRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    json(response, 201, await sessions.open(input));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid session request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.message, code: error.code });
      return;
    }
    json(response, 500, { error: "Could not open session" });
  }
}).listen(port, () => console.log(`Creator room service listening on http://localhost:${port}`));
