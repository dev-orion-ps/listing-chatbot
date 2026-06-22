import { z } from "zod";
import dataset from "../../data/sample-listings.json";

/**
 * The dataset is the ONLY source of truth for this assistant. We load it once
 * and validate its shape with Zod at module-load time, so a malformed fixture
 * fails fast instead of silently feeding bad data to the model.
 */
export const ListingSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["dining", "lodging", "attraction", "venue"]),
  city: z.string(),
  tags: z.array(z.string()),
  priceTier: z.enum(["free", "$", "$$", "$$$", "$$$$"]),
  blurb: z.string(),
  // Some listings legitimately have no external link.
  externalUrl: z.string().url().nullable(),
});

export const DatasetSchema = z.object({
  _note: z.string().optional(),
  listings: z.array(ListingSchema),
});

export type Listing = z.infer<typeof ListingSchema>;
export type Category = Listing["category"];
export type PriceTier = Listing["priceTier"];

/** Compact shape sent to the frontend for rendering cards. */
export interface ListingRef {
  id: string;
  name: string;
  category: Category;
  city: string;
  priceTier: PriceTier;
  externalUrl: string | null;
}

/** Parsed + validated once. Throws at startup if the fixture is malformed. */
const LISTINGS: readonly Listing[] = DatasetSchema.parse(dataset).listings;

export function allListings(): readonly Listing[] {
  return LISTINGS;
}

export function toRef(listing: Listing): ListingRef {
  return {
    id: listing.id,
    name: listing.name,
    category: listing.category,
    city: listing.city,
    priceTier: listing.priceTier,
    externalUrl: listing.externalUrl,
  };
}

export interface SearchArgs {
  query?: string;
  category?: Category;
  city?: string;
  tags?: string[];
  priceTier?: PriceTier;
  limit?: number;
}

/**
 * Pure, deterministic filter over the in-memory dataset. This is the only place
 * listing content is read for recommendations; nothing here reaches the open web
 * or pretrained knowledge.
 */
export function searchListings(args: SearchArgs): Listing[] {
  const { query, category, city, tags, priceTier, limit = 5 } = args;
  let results = [...LISTINGS];

  if (category) {
    results = results.filter((l) => l.category === category);
  }
  if (city) {
    const c = city.trim().toLowerCase();
    results = results.filter((l) => l.city.toLowerCase() === c);
  }
  if (priceTier) {
    results = results.filter((l) => l.priceTier === priceTier);
  }
  if (tags && tags.length > 0) {
    // Tolerant matching: the model phrases tags loosely ("date night" vs the
    // stored "date-night", "family-friendly" vs "family"). Normalize spacing
    // and hyphens and accept a match in either direction so good queries don't
    // silently return nothing.
    const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
    const wanted = tags.map(norm);
    results = results.filter((l) => {
      const have = l.tags.map(norm);
      return wanted.every((w) =>
        have.some((h) => h === w || h.includes(w) || w.includes(h)),
      );
    });
  }
  if (query && query.trim()) {
    // Token OR-match across name/blurb/tags/city/category for good recall.
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    results = results.filter((l) => {
      const haystack =
        `${l.name} ${l.blurb} ${l.tags.join(" ")} ${l.city} ${l.category}`.toLowerCase();
      return words.some((w) => haystack.includes(w));
    });
  }

  return results.slice(0, Math.max(1, Math.min(limit, 18)));
}

export function getListingById(id: string): Listing | null {
  return LISTINGS.find((l) => l.id === id) ?? null;
}
