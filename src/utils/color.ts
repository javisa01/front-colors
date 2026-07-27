import convert from "color-convert";

import type { HSVColor } from "@/types/challenge";

export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

export function hexToHSV(hex: string): HSVColor {
  const rgb = convert.hex.rgb(hex.replace("#", ""));
  const [h, s, v] = convert.rgb.hsv(rgb);
  return { h, s, v };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const [r, g, b] = convert.hsv.rgb([h, s, v]);
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function normalizeHex(hex: string): string {
  const value = hex.replace("#", "").toUpperCase();
  return `#${value}`;
}

export function isWithinTolerance(
  selected: HSVColor,
  target: HSVColor,
  tolerance: HSVColor,
): boolean {
  return (
    hueDistance(selected.h, target.h) <= tolerance.h &&
    Math.abs(selected.s - target.s) <= tolerance.s &&
    Math.abs(selected.v - target.v) <= tolerance.v
  );
}
