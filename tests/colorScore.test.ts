import assert from "node:assert/strict";
import { test } from "node:test";

import { hsvToLab } from "../src/utils/color";
import {
  calculateColorScore,
  deltaE2000,
  getCircularHueDistance,
  getHSVDelta,
  getRunMessage,
  getScoreStars,
  summarizeRun,
} from "../src/utils/colorScore";

const RED = { h: 0, s: 100, v: 100 };
const GREEN = { h: 120, s: 100, v: 100 };
const NEAR_RED = { h: 4, s: 96, v: 98 };

test("getCircularHueDistance is symmetric and wraps", () => {
  assert.equal(getCircularHueDistance(0, 180), 180);
  assert.equal(getCircularHueDistance(350, 10), 20);
  assert.equal(getCircularHueDistance(10, 350), 20);
  assert.equal(getCircularHueDistance(-10, 10), 20);
});

test("deltaE2000 is zero for identical colors", () => {
  assert.equal(deltaE2000(hsvToLab(RED), hsvToLab(RED)), 0);
});

test("deltaE2000 grows with visual difference", () => {
  const small = deltaE2000(hsvToLab(RED), hsvToLab(NEAR_RED));
  const large = deltaE2000(hsvToLab(RED), hsvToLab(GREEN));
  assert.ok(small < large);
});

test("calculateColorScore gives 100 for an exact match", () => {
  assert.equal(calculateColorScore(RED, RED), 100);
});

test("calculateColorScore rewards closeness", () => {
  const close = calculateColorScore(NEAR_RED, RED);
  const far = calculateColorScore(GREEN, RED);
  assert.ok(close > far);
  assert.ok(close >= 80);
  assert.ok(far < 60);
});

test("calculateColorScore stays within 0..100", () => {
  for (const target of [RED, GREEN, { h: 210, s: 40, v: 30 }]) {
    const value = calculateColorScore({ h: 200, s: 10, v: 90 }, target);
    assert.ok(value >= 0 && value <= 100);
  }
});

test("getHSVDelta reports absolute per-channel differences", () => {
  const delta = getHSVDelta({ h: 350, s: 40, v: 60 }, { h: 10, s: 50, v: 55 });
  assert.deepEqual(delta, { h: 20, s: 10, v: 5 });
});

test("getScoreStars maps scores to a 0..3 rating", () => {
  assert.equal(getScoreStars(95), 3);
  assert.equal(getScoreStars(75), 2);
  assert.equal(getScoreStars(50), 1);
  assert.equal(getScoreStars(10), 0);
});

test("summarizeRun aggregates totals and averages", () => {
  const summary = summarizeRun([100, 50]);
  assert.equal(summary.total, 150);
  assert.equal(summary.max, 200);
  assert.equal(summary.average, 75);
  assert.equal(summary.rounds, 2);
  assert.equal(summary.stars, 2);
});

test("summarizeRun handles an empty run", () => {
  const summary = summarizeRun([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.max, 0);
  assert.equal(summary.average, 0);
  assert.equal(summary.rounds, 0);
});

test("getRunMessage returns a non-empty headline for any average", () => {
  for (const average of [0, 60, 80, 95]) {
    assert.ok(getRunMessage(average).length > 0);
  }
});
