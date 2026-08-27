import assert from "node:assert/strict";
import { test } from "node:test";

import { hsvToLab } from "../src/utils/color";
import {
  HIT_THRESHOLD,
  calculateColorScore,
  countHits,
  deltaE2000,
  getCircularHueDistance,
  getHSVDelta,
  getRunMessage,
  getScoreStars,
  isHit,
  longestStreak,
  scoreTimedGuess,
  summarizeRun,
  timedRunPoints,
  trailingStreak,
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

test("isHit se decide en el umbral, que es inclusivo", () => {
  assert.equal(isHit(HIT_THRESHOLD), true);
  assert.equal(isHit(HIT_THRESHOLD - 1), false);
  assert.equal(isHit(100), true);
  assert.equal(isHit(0), false);
});

test("countHits solo cuenta los intentos por encima del umbral", () => {
  // El fallo que arregla: antes cualquier intento enviado contaba como acierto.
  assert.equal(countHits([100, 59, 60, 12, 88]), 3);
  assert.equal(countHits([10, 20, 30]), 0);
  assert.equal(countHits([]), 0);
});

test("trailingStreak cuenta hacia atrás y un fallo la corta", () => {
  assert.equal(trailingStreak([100, 20, 80, 90]), 2);
  assert.equal(trailingStreak([100, 90, 20]), 0);
  assert.equal(trailingStreak([70, 70, 70]), 3);
  assert.equal(trailingStreak([]), 0);
});

test("longestStreak encuentra la mejor racha de la tanda", () => {
  assert.equal(longestStreak([90, 90, 10, 80, 80, 80, 10]), 3);
  assert.equal(longestStreak([10, 10]), 0);
  assert.equal(longestStreak([]), 0);
});

test("scoreTimedGuess resta por debajo del umbral y suma por encima", () => {
  assert.equal(scoreTimedGuess(100), 60);
  assert.equal(scoreTimedGuess(80), 40);
  assert.equal(scoreTimedGuess(HIT_THRESHOLD), 20);
  assert.equal(scoreTimedGuess(40), -5);
  assert.equal(scoreTimedGuess(0), -15);
});

test("scoreTimedGuess nunca deja un fallo sin coste", () => {
  // Quedarse a un punto del acierto es un fallo y tiene que restar algo, por
  // poco que sea; si no, apurar el umbral saldría gratis.
  for (let accuracy = 0; accuracy < HIT_THRESHOLD; accuracy += 1) {
    assert.ok(scoreTimedGuess(accuracy) < 0, `${accuracy}% debería restar`);
  }
});

/**
 * La regla que evita el caso que se veía en partida: cuatro aciertos por debajo
 * de dos. Si el acierto más flojo vale más que el fallo más grave, cambiar un
 * fallo por un acierto siempre sale a favor.
 */
test("el acierto más flojo pesa más que el fallo más grave", () => {
  const worstHit = scoreTimedGuess(HIT_THRESHOLD);
  const worstMiss = scoreTimedGuess(0);
  assert.ok(worstHit > Math.abs(worstMiss));
});

test("a igualdad de precisión, acertar más veces suma más", () => {
  // El caso que se veía en partida: cuatro aciertos quedando por debajo de dos.
  const four = timedRunPoints([75, 75, 75, 75, 30, 30, 30]);
  const two = timedRunPoints([75, 75, 30]);
  assert.ok(four > two, `${four} debería superar a ${two}`);
});

test("seguir intentando compensa aunque se falle la mitad de lo nuevo", () => {
  const cautious = timedRunPoints([80, 80]);
  // Los mismos dos aciertos, más uno nuevo y un fallo nuevo.
  const bolder = timedRunPoints([80, 80, 80, 20]);
  assert.ok(bolder > cautious, `${bolder} debería superar a ${cautious}`);
});

test("timedRunPoints hace que fallar cueste puntos", () => {
  assert.equal(timedRunPoints([100, 100]), 120);
  assert.equal(timedRunPoints([]), 0);
  // Disparar al azar sin apuntar sigue saliendo a pérdidas: es la razón de ser
  // de la penalización ahora que el contrarreloj no tiene límite de imágenes.
  assert.ok(timedRunPoints([20, 25, 30, 20]) < 0);
});
