import assert from "node:assert/strict";
import { test } from "node:test";

import { hexToHSV } from "../src/utils/color";
import { hsvToHexWorklet } from "../src/utils/colorWorklets";
import {
  applyHueSaturation,
  applyValue,
  pointToHueSaturation,
  pointToValue,
} from "../src/utils/hsvGeometry";

const RADIUS = 120;
const TRAVEL = 220;
const THUMB = 28;

// ---------------------------------------------------------------------------
// Geometría de la rueda
// ---------------------------------------------------------------------------

test("el centro de la rueda es saturación cero", () => {
  const { s } = pointToHueSaturation(RADIUS, RADIUS, RADIUS);
  assert.equal(s, 0);
});

test("el tono avanza en sentido antihorario desde el este", () => {
  const east = pointToHueSaturation(RADIUS * 2, RADIUS, RADIUS);
  const north = pointToHueSaturation(RADIUS, 0, RADIUS);
  const west = pointToHueSaturation(0, RADIUS, RADIUS);
  const south = pointToHueSaturation(RADIUS, RADIUS * 2, RADIUS);

  assert.equal(Math.round(east.h), 0);
  assert.equal(Math.round(north.h), 90);
  assert.equal(Math.round(west.h), 180);
  assert.equal(Math.round(south.h), 270);
});

test("el borde de la rueda es saturación máxima", () => {
  const { s } = pointToHueSaturation(RADIUS * 2, RADIUS, RADIUS);
  assert.equal(Math.round(s), 100);
});

test("arrastrar fuera del disco satura al máximo en vez de ignorar el gesto", () => {
  const { s } = pointToHueSaturation(RADIUS * 3, RADIUS, RADIUS);
  assert.equal(s, 100);
});

// ---------------------------------------------------------------------------
// Geometría del deslizador de brillo
// ---------------------------------------------------------------------------

test("el deslizador va de 100 arriba a 0 abajo", () => {
  assert.equal(pointToValue(THUMB / 2, TRAVEL, THUMB), 100);
  assert.equal(pointToValue(TRAVEL + THUMB / 2, TRAVEL, THUMB), 0);
  assert.equal(pointToValue(TRAVEL / 2 + THUMB / 2, TRAVEL, THUMB), 50);
});

test("el deslizador se satura en los topes en lugar de salirse de rango", () => {
  assert.equal(pointToValue(-500, TRAVEL, THUMB), 100);
  assert.equal(pointToValue(5000, TRAVEL, THUMB), 0);
});

// ---------------------------------------------------------------------------
// La invariante del bug: cambiar el brillo no puede tocar tono ni saturación
// ---------------------------------------------------------------------------

/** Saturaciones de prueba, con especial atención a la zona degenerada. */
const SATURATIONS = [0, 0.4, 1, 2, 5, 12, 40, 75, 100];
const VALUES = [0, 1, 7, 25, 50, 88, 99, 100];

test("cambiar el brillo conserva tono y saturación en todo el rango", () => {
  for (const s of SATURATIONS) {
    for (const v of VALUES) {
      const start = { h: 210.4, s, v: 50 };
      const moved = applyValue(start, v);

      assert.equal(moved.h, start.h, `tono alterado con s=${s}, v=${v}`);
      assert.equal(moved.s, start.s, `saturación alterada con s=${s}, v=${v}`);
      assert.equal(moved.v, v);
    }
  }
});

test("con saturación cero el tono sigue siendo estable pese a ser ambiguo", () => {
  // Matemáticamente el tono no está definido cuando s = 0, pero para el jugador
  // debe seguir siendo el que eligió: al subir el brillo desde un gris tiene que
  // reaparecer su color, no un rojo.
  const gray = { h: 274.8, s: 0, v: 12 };

  const brightened = applyValue(gray, 90);
  assert.equal(brightened.h, 274.8);

  // Y ahora, subiendo la saturación desde ese gris, debe salir SU tono.
  const saturated = applyHueSaturation(brightened, { h: 274.8, s: 60 });
  assert.equal(saturated.h, 274.8);
  assert.equal(saturated.v, 90, "subir saturación no debe tocar el brillo");
});

test("cambios de brillo consecutivos no acumulan deriva", () => {
  let color = { h: 33.7, s: 3, v: 50 };

  // Cien movimientos seguidos del deslizador, como al arrastrar rápido.
  for (let index = 0; index < 100; index += 1) {
    color = applyValue(color, (index % 101) as number);
  }

  assert.equal(color.h, 33.7, "el tono ha derivado tras 100 cambios");
  assert.equal(color.s, 3, "la saturación ha derivado tras 100 cambios");
});

test("mover la rueda conserva el brillo elegido", () => {
  const dim = { h: 10, s: 50, v: 18 };
  const moved = applyHueSaturation(dim, { h: 300, s: 90 });

  assert.equal(moved.v, 18);
  assert.equal(moved.h, 300);
  assert.equal(moved.s, 90);
});

test("el tono se normaliza al rango 0-360 sin perder posición", () => {
  const base = { h: 0, s: 50, v: 50 };
  assert.equal(applyHueSaturation(base, { h: 370, s: 50 }).h, 10);
  assert.equal(applyHueSaturation(base, { h: -10, s: 50 }).h, 350);
});

// ---------------------------------------------------------------------------
// Regresión: por qué el estado no puede volver a pasar por hexadecimal
// ---------------------------------------------------------------------------

test("REGRESIÓN: el ciclo por hexadecimal destruye el tono con saturación baja", () => {
  // Esto reproduce lo que hacía la implementación anterior en CADA frame del
  // gesto: emitir un hexadecimal y reconstruir el HSV a partir de él. El test
  // afirma el comportamiento roto a propósito, para dejar constancia de por qué
  // la arquitectura nueva no puede volver a hacerlo.
  const chosen = { h: 210, s: 2, v: 20 };

  const hex = hsvToHexWorklet(chosen.h, chosen.s, chosen.v);
  const recovered = hexToHSV(hex);

  assert.notEqual(
    recovered.h,
    chosen.h,
    "si esto deja de fallar, la cuantización a 8 bits ha cambiado, no el bug",
  );
});

test("el camino nuevo conserva el tono donde el viejo lo perdía", () => {
  // Mismo color problemático, pero recorriendo la ruta real del picker: el HSV
  // se conserva y el hexadecimal es solo una salida.
  const chosen = { h: 210, s: 2, v: 20 };

  // El jugador sube el brillo con la barra vertical.
  const brightened = applyValue(chosen, 85);

  assert.equal(brightened.h, 210, "el tono debe sobrevivir al cambio de brillo");
  assert.equal(brightened.s, 2);
  assert.equal(brightened.v, 85);
});

// ---------------------------------------------------------------------------
// Conversión a hexadecimal
// ---------------------------------------------------------------------------

test("hsvToHexWorklet coincide con los colores primarios", () => {
  assert.equal(hsvToHexWorklet(0, 100, 100), "#FF0000");
  assert.equal(hsvToHexWorklet(120, 100, 100), "#00FF00");
  assert.equal(hsvToHexWorklet(240, 100, 100), "#0000FF");
  assert.equal(hsvToHexWorklet(0, 0, 100), "#FFFFFF");
  assert.equal(hsvToHexWorklet(0, 0, 0), "#000000");
});

test("hsvToHexWorklet acepta tonos fuera de rango y valores fraccionarios", () => {
  assert.equal(hsvToHexWorklet(360, 100, 100), "#FF0000");
  assert.equal(hsvToHexWorklet(-120, 100, 100), "#0000FF");
  assert.equal(hsvToHexWorklet(0, 100, 100.9), "#FF0000");
});

test("hsvToHexWorklet redondea, no trunca", () => {
  // La librería anterior usaba Math.floor al pasar a RGB y Math.round al
  // volver, así que cada ida y vuelta perdía brillo. Con redondeo simétrico el
  // valor se mantiene estable.
  let color = { h: 200, s: 60, v: 70 };

  for (let index = 0; index < 20; index += 1) {
    color = hexToHSV(hsvToHexWorklet(color.h, color.s, color.v));
  }

  assert.ok(
    Math.abs(color.v - 70) <= 1,
    `el brillo derivó hasta ${color.v} tras 20 ciclos`,
  );
});
