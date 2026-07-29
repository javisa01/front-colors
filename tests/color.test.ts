import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hexToHSV,
  hsvToHex,
  hsvToLab,
  hueDistance,
  normalizeHex,
  relativeLuminance,
} from "../src/utils/color";

test("hexToHSV converts primary colors", () => {
  assert.deepEqual(hexToHSV("#FF0000"), { h: 0, s: 100, v: 100 });
  assert.deepEqual(hexToHSV("#00FF00"), { h: 120, s: 100, v: 100 });
  assert.deepEqual(hexToHSV("#0000FF"), { h: 240, s: 100, v: 100 });
  assert.deepEqual(hexToHSV("#000000"), { h: 0, s: 0, v: 0 });
  assert.deepEqual(hexToHSV("#FFFFFF"), { h: 0, s: 0, v: 100 });
});

test("hexToHSV tolerates a missing leading hash", () => {
  assert.deepEqual(hexToHSV("FF0000"), { h: 0, s: 100, v: 100 });
});

test("hsvToHex is the inverse of hexToHSV for pure colors", () => {
  assert.equal(hsvToHex(0, 100, 100), "#FF0000");
  assert.equal(hsvToHex(120, 100, 100), "#00FF00");
  assert.equal(hsvToHex(240, 100, 100), "#0000FF");
});

test("normalizeHex always returns an uppercase #-prefixed value", () => {
  assert.equal(normalizeHex("ff0000"), "#FF0000");
  assert.equal(normalizeHex("#ff0000"), "#FF0000");
  assert.equal(normalizeHex("#AbCdEf"), "#ABCDEF");
});

test("hueDistance wraps around the color wheel", () => {
  assert.equal(hueDistance(0, 180), 180);
  assert.equal(hueDistance(350, 10), 20);
  assert.equal(hueDistance(10, 350), 20);
  assert.equal(hueDistance(90, 90), 0);
});

test("relativeLuminance orders black < gray < white", () => {
  const black = relativeLuminance("#000000");
  const gray = relativeLuminance("#808080");
  const white = relativeLuminance("#FFFFFF");

  assert.ok(black < gray);
  assert.ok(gray < white);
  assert.equal(black, 0);
  assert.equal(white, 1);
});

test("hsvToLab returns three finite numbers with L in 0..100", () => {
  const [l, a, b] = hsvToLab({ h: 0, s: 100, v: 100 });
  assert.ok(Number.isFinite(l) && Number.isFinite(a) && Number.isFinite(b));
  assert.ok(l >= 0 && l <= 100);
});
