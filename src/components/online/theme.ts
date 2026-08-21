/**
 * Tokens visuales del área online.
 *
 * Son los mismos valores que ya usaban `index.tsx` y `offline.tsx` a pelo
 * (paleta zinc sobre #09090B); aquí se les pone nombre para que las pantallas
 * nuevas no vuelvan a copiar los hex uno a uno.
 */
export const OnlinePalette = {
  background: "#09090B",
  surface: "#18181B",
  surfaceDeep: "#0A0A0D",
  border: "#27272A",
  borderActive: "#3B82F6",

  text: "#FFFFFF",
  textSoft: "#E4E4E7",
  textMuted: "#A1A1AA",
  textFaint: "#71717A",
  textDim: "#52525B",

  accent: "#3B82F6",
  accentDeep: "#2563EB",
  accentSoft: "#93C5FD",
  accentSurface: "#1E293B",

  success: "#10B981",
  successDeep: "#047857",
  danger: "#EF4444",
  dangerDeep: "#B91C1C",
  warning: "#F59E0B",
  gold: "#FBBF24",
} as const;

export const OnlineGradients = {
  screen: ["#09090B", "#0A0A0D", "#09090B"] as const,
  accent: ["#3B82F6", "#2563EB"] as const,
  success: ["#10B981", "#047857"] as const,
  danger: ["#EF4444", "#B91C1C"] as const,
  gold: ["#F59E0B", "#D97706"] as const,
  violet: ["#7C3AED", "#5B21B6"] as const,
  pink: ["#EC4899", "#BE185D"] as const,
};

/** Medalla del podio; a partir del cuarto puesto se pinta el número a secas. */
export function podiumEmoji(position: number): string | null {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return null;
}
