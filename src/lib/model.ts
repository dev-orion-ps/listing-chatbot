import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Provider factory. The assistant is provider-swappable by design: the rest of
 * the app only depends on the AI SDK's `LanguageModel` interface, so swapping
 * OpenAI for Anthropic (or any other AI SDK provider) is a one-file change here.
 *
 * We read the key/model from env so no secret is ever committed (see
 * .env.example). The dataset is tiny, so model cost is negligible — gpt-4o-mini
 * is a fast, cheap default that handles the grounding/refusal task well.
 */
export const MODEL_ID = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const provider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function getModel(): LanguageModel {
  return provider(MODEL_ID);
}
