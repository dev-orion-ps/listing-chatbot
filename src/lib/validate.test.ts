import { describe, it, expect } from "vitest";
import {
  createApprovedSet,
  scanProse,
  validateReferenceIds,
} from "./validate";

describe("validateReferenceIds (the structured-reference gate)", () => {
  it("keeps approved ids and strips everything else", () => {
    const approved = createApprovedSet();
    approved.ids.add("din-001");
    approved.ids.add("din-003");

    const { valid, stripped } = validateReferenceIds(
      ["din-001", "din-999", "din-003", "fake-001"],
      approved,
    );

    expect(valid).toEqual(["din-001", "din-003"]);
    expect(stripped).toEqual(["din-999", "fake-001"]);
  });

  it("strips a real-looking id that was never surfaced this turn", () => {
    const approved = createApprovedSet(); // nothing approved
    const { valid, stripped } = validateReferenceIds(["din-001"], approved);
    expect(valid).toEqual([]);
    expect(stripped).toEqual(["din-001"]);
  });

  it("deduplicates", () => {
    const approved = createApprovedSet();
    approved.ids.add("att-004");
    const { valid } = validateReferenceIds(["att-004", "att-004"], approved);
    expect(valid).toEqual(["att-004"]);
  });
});

describe("scanProse (defense-in-depth over free text)", () => {
  it("flags listing ids that are not approved", () => {
    const approved = createApprovedSet();
    approved.ids.add("din-001");
    const scan = scanProse("Try din-001 or the invented din-404.", approved);
    expect(scan.strippedIds).toEqual(["din-404"]);
  });

  it("flags urls that are not approved", () => {
    const approved = createApprovedSet();
    approved.urls.add("https://example.com/mill-house-cafe");
    const scan = scanProse(
      "Real: https://example.com/mill-house-cafe Fake: https://evil.example.org/x.",
      approved,
    );
    expect(scan.strippedUrls).toEqual(["https://evil.example.org/x"]);
  });

  it("returns nothing when everything is approved", () => {
    const approved = createApprovedSet();
    approved.ids.add("din-001");
    approved.urls.add("https://example.com/mill-house-cafe");
    const scan = scanProse(
      "Visit din-001 at https://example.com/mill-house-cafe!",
      approved,
    );
    expect(scan.strippedIds).toEqual([]);
    expect(scan.strippedUrls).toEqual([]);
  });
});
