import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../edit/settings";
import { outputName } from "./export";
import { batchReducer, EMPTY_BATCH, newPhoto, type BatchState } from "./photos";

const file = (name: string) => new File([], name);

function batchOf(...names: string[]): BatchState {
  return batchReducer(EMPTY_BATCH, { type: "add", photos: names.map((n) => newPhoto(file(n))) });
}

describe("batchReducer", () => {
  it("sorts added photos by name, numbers in order, and opens the first by name", () => {
    const s = batchOf("IMG_10.jpg", "IMG_2.jpg", "IMG_1.jpg");
    expect(s.photos.map((p) => p.name)).toEqual(["IMG_1.jpg", "IMG_2.jpg", "IMG_10.jpg"]);
    expect(s.currentId).toBe(s.photos[0].id);
  });

  it("selects a range with shift-click from the anchor", () => {
    let s = batchOf("a.jpg", "b.jpg", "c.jpg", "d.jpg");
    const [a, b, c, d] = s.photos.map((p) => p.id);
    s = batchReducer(s, { type: "select", id: b, mode: "only" });
    s = batchReducer(s, { type: "select", id: d, mode: "range" });
    expect([...s.selected].sort()).toEqual([b, c, d].sort());
    s = batchReducer(s, { type: "select", id: a, mode: "toggle" });
    expect(s.selected.has(a)).toBe(true);
  });

  it("applies settings to several photos and undoes a match", () => {
    let s = batchOf("a.jpg", "b.jpg");
    const [a, b] = s.photos.map((p) => p.id);
    const warm = { ...DEFAULT_SETTINGS, temperature: 40 };
    s = batchReducer(s, { type: "settings", ids: [a, b], settings: warm });
    expect(s.photos.every((p) => p.settings.temperature === 40)).toBe(true);

    const matched = { ...DEFAULT_SETTINGS, exposure: 1 };
    s = batchReducer(s, { type: "matched", id: a, settings: matched, matched: {} as never });
    expect(s.photos[0].settings.exposure).toBe(1);
    s = batchReducer(s, { type: "undoMatch", ids: [a] });
    expect(s.photos[0].settings).toEqual(warm);
  });

  it("moves the current photo when it is removed", () => {
    let s = batchOf("a.jpg", "b.jpg");
    const [a, b] = s.photos.map((p) => p.id);
    s = batchReducer(s, { type: "current", id: a });
    s = batchReducer(s, { type: "remove", ids: [a] });
    expect(s.currentId).toBe(b);
    expect(s.photos).toHaveLength(1);
  });
});

describe("outputName", () => {
  it("swaps the extension for .jpg and avoids clashes", () => {
    const used = new Set<string>();
    expect(outputName("_DSC0009.ARW", used)).toBe("_DSC0009.jpg");
    expect(outputName("_DSC0009.JPG", used)).toBe("_DSC0009-2.jpg");
  });
});
