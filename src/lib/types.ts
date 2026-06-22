import type { UIMessage } from "ai";
import type { ListingRef } from "./listings";

/**
 * Custom data parts streamed alongside the assistant's text. The frontend reads
 * these from `message.parts` to render cards, the disclaimer, and any integrity
 * warnings. Documented as the response contract in the README.
 */
export type ChatDataParts = {
  /** The validated set of listings the assistant recommends (for cards). */
  listings: { listings: ListingRef[] };
  /** Always-present "AI can be wrong" notice (part of the contract). */
  disclaimer: { text: string };
  /** Emitted only when the post-generation prose scan finds unapproved refs. */
  integrity: { strippedIds: string[]; strippedUrls: string[]; message: string };
};

/** UIMessage specialized with our data parts (no custom metadata/tools typing). */
export type ChatMessage = UIMessage<never, ChatDataParts>;
