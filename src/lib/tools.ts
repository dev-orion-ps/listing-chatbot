import { tool } from "ai";
import { z } from "zod";
import {
  getListingById,
  searchListings,
  toRef,
  type Listing,
  type ListingRef,
} from "./listings";
import { logGuardrail, logToolUse } from "./logger";
import { validateReferenceIds, type ApprovedSet } from "./validate";

/**
 * Context passed in per request. `approved` is the turn-scoped set of IDs/URLs
 * the model has legitimately seen through tool results — the only IDs it is
 * allowed to recommend. `onPresent` hands the validated recommendation set back
 * to the route so it can be streamed to the client as structured references.
 */
export interface ToolContext {
  approved: ApprovedSet;
  onPresent: (refs: ListingRef[]) => void;
}

/** Record listings into the approved set as the model discovers them. */
function approve(approved: ApprovedSet, listings: Listing[]): void {
  for (const l of listings) {
    approved.ids.add(l.id);
    if (l.externalUrl) approved.urls.add(l.externalUrl);
  }
}

const categoryEnum = z.enum(["dining", "lodging", "attraction", "venue"]);

export function createListingTools(ctx: ToolContext) {
  const searchListingsTool = tool({
    description:
      "Search the approved local-listings dataset. This is the ONLY way to find " +
      "places to recommend. Returns matching listings. Combine filters to narrow " +
      "results (e.g. category + city). Returns nothing if there is no match.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("Free-text keywords matched against name, blurb, tags, city."),
      category: categoryEnum.optional(),
      city: z.string().optional().describe("e.g. Brookline, Cape Vernon, Ridgeway"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Listing must contain ALL of these tags."),
      limit: z.number().int().min(1).max(18).optional(),
    }),
    execute: async (args) => {
      const results = searchListings(args);
      logToolUse("searchListings", { args, count: results.length });
      approve(ctx.approved, results);
      return {
        count: results.length,
        listings: results.map((l) => ({
          id: l.id,
          name: l.name,
          category: l.category,
          city: l.city,
          tags: l.tags,
          priceTier: l.priceTier,
          blurb: l.blurb,
          externalUrl: l.externalUrl,
        })),
      };
    },
  });

  const getListingByIdTool = tool({
    description:
      "Fetch one listing by its exact ID (e.g. 'din-001') from the approved " +
      "dataset. Use to confirm details before recommending.",
    inputSchema: z.object({
      id: z.string().describe("Exact listing ID, e.g. din-001"),
    }),
    execute: async ({ id }) => {
      const listing = getListingById(id);
      if (!listing) {
        logGuardrail({ kind: "listing_not_found", id });
        return { found: false, id };
      }
      approve(ctx.approved, [listing]);
      return { found: true, listing };
    },
  });

  const presentListingsTool = tool({
    description:
      "Declare the listings you are recommending so the app can render them as " +
      "cards. Pass the IDs of listings you found via searchListings/getListingById. " +
      "Call this once, after you have your final picks. Only IDs from this turn's " +
      "tool results are accepted.",
    inputSchema: z.object({
      ids: z
        .array(z.string())
        .describe("Listing IDs to recommend, e.g. ['din-003','att-004']"),
    }),
    execute: async ({ ids }) => {
      // The validation gate: keep only IDs that were actually surfaced by a
      // tool this turn. Anything else (invented or unsearched) is stripped and
      // logged — this is requirement #5 doing real work.
      const { valid, stripped } = validateReferenceIds(ids, ctx.approved);
      if (stripped.length > 0) {
        logGuardrail({
          kind: "stripped_reference",
          ids: stripped,
          reason: "id not in this turn's approved tool-result set",
        });
      }
      const refs: ListingRef[] = valid
        .map((id) => getListingById(id))
        .filter((l): l is Listing => l !== null)
        .map(toRef);
      ctx.onPresent(refs);
      return {
        presented: refs.map((r) => r.id),
        stripped,
      };
    },
  });

  return {
    searchListings: searchListingsTool,
    getListingById: getListingByIdTool,
    presentListings: presentListingsTool,
  };
}
