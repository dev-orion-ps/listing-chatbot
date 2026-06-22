import { describe, it, expect, vi } from "vitest";
import { createListingTools } from "./tools";
import { createApprovedSet } from "./validate";
import type { ListingRef } from "./listings";

// Tools' execute() takes (input, options). We don't need a real tool-call
// context, so we build a minimal options object typed from the tool itself.
type SearchExec = NonNullable<
  ReturnType<typeof createListingTools>["searchListings"]["execute"]
>;
const OPTS = { toolCallId: "test", messages: [] } as unknown as Parameters<SearchExec>[1];

function setup() {
  const approved = createApprovedSet();
  const presented: ListingRef[][] = [];
  const tools = createListingTools({
    approved,
    onPresent: (refs) => presented.push(refs),
  });
  return { approved, presented, tools };
}

describe("createListingTools — the per-turn grounding gate", () => {
  it("searchListings records returned ids/urls into the approved set", async () => {
    const { approved, tools } = setup();
    await tools.searchListings.execute!({ category: "dining", city: "Brookline" }, OPTS);
    expect(approved.ids.has("din-001")).toBe(true);
    expect(approved.urls.has("https://example.com/mill-house-cafe")).toBe(true);
  });

  it("presentListings keeps searched ids and STRIPS an invented one (+logs)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { presented, tools } = setup();

    await tools.searchListings.execute!({ category: "dining", city: "Brookline" }, OPTS);
    const result = await tools.presentListings.execute!(
      { ids: ["din-001", "moon-999"] },
      OPTS,
    );

    expect(result).toMatchObject({ presented: ["din-001"], stripped: ["moon-999"] });
    expect(presented.at(-1)?.map((r) => r.id)).toEqual(["din-001"]);
    expect(warn).toHaveBeenCalled(); // the stripped attempt is logged
    warn.mockRestore();
  });

  it("presentListings strips a real id that was never searched this turn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { presented, tools } = setup();
    // No search performed → din-001 is a valid dataset id but NOT approved.
    const result = await tools.presentListings.execute!({ ids: ["din-001"] }, OPTS);
    expect(result).toMatchObject({ presented: [], stripped: ["din-001"] });
    expect(presented.at(-1)).toEqual([]);
    warn.mockRestore();
  });

  it("getListingById reports not-found without inventing data", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { tools } = setup();
    const result = await tools.getListingById.execute!({ id: "zzz-000" }, OPTS);
    expect(result).toEqual({ found: false, id: "zzz-000" });
    warn.mockRestore();
  });
});
