/**
 * Validation helpers for the grounding guardrails. Two jobs:
 *
 *  1. validateReferenceIds — the authoritative gate for structured references.
 *     IDs the model declares (via the presentListings tool) are kept only if
 *     they appear in the approved tool-result set for this turn; anything else
 *     is stripped.
 *  2. scanProse — defense-in-depth over the model's free text. We cannot retract
 *     already-streamed tokens, so this does not rewrite prose; it detects any
 *     listing ID or URL the model emitted that is NOT approved, so the attempt
 *     can be logged and surfaced to the UI.
 */

/** Listing IDs look like "din-001", "att-006": three letters, dash, 3 digits. */
const LISTING_ID_RE = /\b[a-z]{3}-\d{3}\b/g;
const URL_RE = /https?:\/\/[^\s)\]}"'<>]+/gi;

export interface ApprovedSet {
  ids: Set<string>;
  urls: Set<string>;
}

export function createApprovedSet(): ApprovedSet {
  return { ids: new Set<string>(), urls: new Set<string>() };
}

export interface ReferenceValidation {
  valid: string[];
  stripped: string[];
}

/** Split declared IDs into approved (kept) vs unapproved (stripped). */
export function validateReferenceIds(
  ids: string[],
  approved: ApprovedSet,
): ReferenceValidation {
  const valid: string[] = [];
  const stripped: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    if (approved.ids.has(id)) {
      valid.push(id);
    } else {
      stripped.push(id);
    }
  }
  return { valid, stripped };
}

function stripTrailingPunct(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

export interface ProseScan {
  strippedIds: string[];
  strippedUrls: string[];
}

/** Find listing IDs / URLs in free text that are not in the approved set. */
export function scanProse(text: string, approved: ApprovedSet): ProseScan {
  const ids = new Set<string>();
  const urls = new Set<string>();

  for (const m of text.matchAll(LISTING_ID_RE)) {
    const id = m[0];
    if (!approved.ids.has(id)) ids.add(id);
  }
  for (const m of text.matchAll(URL_RE)) {
    const url = stripTrailingPunct(m[0]);
    if (!approved.urls.has(url)) urls.add(url);
  }

  return { strippedIds: [...ids], strippedUrls: [...urls] };
}
