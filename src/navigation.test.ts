import test from "node:test";
import assert from "node:assert/strict";
import { resolveAppLocation } from "./navigation.ts";

test("retired world routes recover to Object Studio without interpreting old scene data", () => {
  for (const suffix of [
    "#worlds", "?world=old-document#worlds", "?scene=old-document#worlds",
    "?scenery=old-document#worlds", "?world=old-document", "?scene=old-document",
    "?scenery=old-document&format=phone",
  ]) {
    const result = resolveAppLocation(`https://example.test/${suffix}`);
    const url = new URL(result.href);
    assert.equal(result.studioOpen, true, suffix);
    assert.equal(url.hash, "#studio");
    for (const key of ["world", "scene", "scenery", "design"]) assert.equal(url.searchParams.has(key), false);
    assert.deepEqual(resolveAppLocation(result.href), result);
  }
});

test("Object Studio shares and exhibition anchors keep their meaning", () => {
  for (const suffix of ["#studio", "?design=object-state&format=phone#studio", "?design=object-state"]) {
    const href = `https://example.test/${suffix}`;
    assert.deepEqual(resolveAppLocation(href), { href, studioOpen: true });
  }
  for (const hash of ["", "#top", "#experiment", "#philosophy"]) {
    const href = `https://example.test/${hash}`;
    assert.deepEqual(resolveAppLocation(href), { href, studioOpen: false });
  }
  const result = resolveAppLocation("https://example.test/?world=old&format=phone#top");
  assert.equal(result.href, "https://example.test/?format=phone#top");
  assert.equal(result.studioOpen, false);
});

test("retiring a stale world query preserves a real Object Studio document and crop", () => {
  const result = resolveAppLocation("https://example.test/?scene=old&scenery=older&design=object&format=square#worlds");
  assert.equal(result.href, "https://example.test/?design=object&format=square#studio");
  assert.equal(result.studioOpen, true);
});
