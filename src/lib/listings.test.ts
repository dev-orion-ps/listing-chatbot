import { describe, it, expect } from "vitest";
import {
  allListings,
  getListingById,
  searchListings,
  toRef,
} from "./listings";

describe("dataset", () => {
  it("loads and validates ~18 listings", () => {
    expect(allListings().length).toBe(18);
  });

  it("every listing has a valid id pattern", () => {
    for (const l of allListings()) {
      expect(l.id).toMatch(/^[a-z]{3}-\d{3}$/);
    }
  });
});

describe("searchListings", () => {
  it("filters by category", () => {
    const r = searchListings({ category: "lodging", limit: 18 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((l) => l.category === "lodging")).toBe(true);
  });

  it("filters by city (case-insensitive)", () => {
    const r = searchListings({ city: "brookline", limit: 18 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((l) => l.city === "Brookline")).toBe(true);
  });

  it("matches free-text query against blurb/tags", () => {
    const r = searchListings({ query: "breakfast coffee" });
    expect(r.some((l) => l.id === "din-001")).toBe(true);
  });

  it("finds breakfast in Brookline with combined filters", () => {
    const r = searchListings({
      category: "dining",
      city: "Brookline",
      query: "breakfast",
    });
    expect(r.some((l) => l.id === "din-001")).toBe(true);
  });

  it("requires ALL given tags", () => {
    const r = searchListings({ tags: ["weddings", "waterfront"], limit: 18 });
    expect(r.every((l) => l.tags.includes("weddings") && l.tags.includes("waterfront"))).toBe(true);
  });

  it("matches tags loosely (spacing/hyphens)", () => {
    // "date night" (space) should still match the stored "date-night".
    const r = searchListings({ tags: ["waterfront", "date night"], limit: 18 });
    expect(r.some((l) => l.id === "din-003")).toBe(true);
  });

  it("finds a waterfront date-night spot via free text", () => {
    const r = searchListings({ query: "waterfront date night" });
    expect(r.some((l) => l.id === "din-003")).toBe(true);
  });

  it("returns an empty array when nothing matches", () => {
    const r = searchListings({ query: "zzzznotathing", category: "dining" });
    expect(r).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchListings({ limit: 2 }).length).toBe(2);
  });
});

describe("getListingById / toRef", () => {
  it("returns a known listing", () => {
    expect(getListingById("din-001")?.name).toBe("The Mill House Cafe");
  });

  it("returns null for an unknown id", () => {
    expect(getListingById("xyz-999")).toBeNull();
  });

  it("toRef exposes only the card fields", () => {
    const ref = toRef(getListingById("att-003")!);
    expect(Object.keys(ref).sort()).toEqual(
      ["category", "city", "externalUrl", "id", "name", "priceTier"].sort(),
    );
    // att-003 (Starfall Observatory) has no external link in the dataset.
    expect(ref.externalUrl).toBeNull();
  });
});
