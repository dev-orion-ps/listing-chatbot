import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { getModel } from "@/lib/model";
import { logGuardrail } from "@/lib/logger";
import { createListingTools } from "@/lib/tools";
import { DISCLAIMER, SYSTEM_PROMPT } from "@/lib/system-prompt";
import type { ChatMessage } from "@/lib/types";
import type { ListingRef } from "@/lib/listings";
import { createApprovedSet, scanProse } from "@/lib/validate";

export const runtime = "nodejs";
export const maxDuration = 30;

// Lightweight request validation. The detailed UIMessage shape is validated by
// convertToModelMessages; here we just guard the envelope.
const BodySchema = z.object({
  messages: z.array(z.unknown()).min(1),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Body must be { messages: UIMessage[] } with at least one message." },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Server is missing OPENAI_API_KEY. Copy .env.example to .env.local." },
      { status: 500 },
    );
  }

  const uiMessages = parsed.data.messages as UIMessage[];

  // Per-turn state. `approved` is the set of IDs/URLs the model legitimately
  // sees via tools this turn; `recommended` is the validated card set declared
  // through presentListings.
  const approved = createApprovedSet();
  let recommended: ListingRef[] = [];

  const tools = createListingTools({
    approved,
    onPresent: (refs) => {
      recommended = refs;
    },
  });

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      // The disclaimer is part of the contract: emitted on every response, not
      // just rendered as a static banner, so it is present even API-only.
      writer.write({ type: "data-disclaimer", data: { text: DISCLAIMER } });

      const result = streamText({
        model: getModel(),
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(uiMessages),
        tools,
        // Headroom for a few search refinements, then present + a final text
        // step. Too low and the model can exhaust steps mid-search and never
        // write its closing sentence.
        stopWhen: stepCountIs(10),
        onFinish: ({ text }) => {
          // Emit the validated structured references for card rendering.
          writer.write({
            type: "data-listings",
            data: { listings: recommended },
          });

          // Defense-in-depth: scan the completed prose for any listing ID or
          // URL that was NOT approved this turn. We cannot un-stream tokens, so
          // we log the attempt and flag it to the UI instead of rewriting text.
          const { strippedIds, strippedUrls } = scanProse(text, approved);
          if (strippedIds.length > 0 || strippedUrls.length > 0) {
            logGuardrail({
              kind: "prose_unapproved_ref",
              ids: strippedIds,
              urls: strippedUrls,
            });
            writer.write({
              type: "data-integrity",
              data: {
                strippedIds,
                strippedUrls,
                message:
                  "The assistant referenced something outside the approved data; treat it with caution.",
              },
            });
          }
        },
      });

      writer.merge(result.toUIMessageStream<ChatMessage>());
    },
    onError: (error) => {
      // Don't leak internals to the client.
      console.error("[chat] stream error", error);
      return "Something went wrong generating a response. Please try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
