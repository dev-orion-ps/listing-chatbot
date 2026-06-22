/**
 * Minimal structured logging for guardrail events. Requirement #5 says every
 * stripped ID/URL "attempt is logged" — this is where that happens. In
 * production you'd ship these to a real sink; here we emit one JSON line per
 * event so they are greppable in the server console.
 */

export type GuardrailEvent =
  | { kind: "stripped_reference"; ids: string[]; reason: string }
  | { kind: "listing_not_found"; id: string }
  | { kind: "prose_unapproved_ref"; ids: string[]; urls: string[] };

export function logGuardrail(event: GuardrailEvent): void {
  console.warn(
    "[guardrail] " +
      JSON.stringify({ at: new Date().toISOString(), ...event }),
  );
}

/** Visibility into what the model actually asked the tools for (debugging/demo). */
export function logToolUse(
  name: string,
  detail: Record<string, unknown>,
): void {
  console.info(
    "[tool] " + JSON.stringify({ at: new Date().toISOString(), name, ...detail }),
  );
}
