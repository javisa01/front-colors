import { getLocales } from "expo-localization";

/**
 * Lightweight i18n layer.
 *
 * The app ships Spanish today, but every user-facing string now goes through
 * `t()` so adding a new language is just a matter of dropping another dictionary
 * into `resources` below. Interpolation uses a simple `{{name}}` syntax.
 *
 * NOTE: `expo-localization` is used only to detect the device language. If it
 * is not installed yet run `npx expo install expo-localization`; the code falls
 * back to Spanish if detection fails.
 */

type Params = Record<string, string | number>;

const es = {
  "common.back": "← Inicio",
  "common.next": "Siguiente",
  "common.retry": "Reintentar",
  "common.share": "Compartir",
  "common.loading": "Cargando juego...",

  "home.badge": "🎨 Color Quest",
  "home.title": "Pon a prueba\ntu ojo para el color",
  "home.subtitle":
    "Elige un modo de juego y demuestra cuánto te acercas al color perfecto.",
  "home.footer": "Más modos de juego en camino.",
  "home.soon": "Pronto",
  "home.best": "Récord: {{score}}",

  "mode.quick.title": "Juego rápido",
  "mode.quick.description":
    "Adivina el color de cada reto y supera todos los niveles.",
  "mode.timed.title": "Contrarreloj",
  "mode.timed.description":
    "Acierta el máximo de colores antes de que acabe el tiempo.",
  "mode.daily.title": "Reto diario",
  "mode.daily.description":
    "Un color nuevo cada día para poner a prueba tu ojo.",
  "mode.multicolor.title": "Multicolor",
  "mode.multicolor.description":
    "Reconstruye todos los colores de un mismo logo, uno a uno.",

  "game.kicker": "Color Quest",
  "game.title": "Adivina el color",
  "game.subtitle":
    "Ajusta el selector hasta que el resultado se vea igual que el reto.",
  "game.check": "Comprobar",
  "game.empty.title": "No hay retos disponibles.",
  "game.empty.subtitle":
    "Revisa el catálogo generado o los metadatos de los retos.",
  "game.colorStep": "Color {{current}} de {{total}}",

  "progress.label": "Progreso",
  "progress.counter": "Reto {{current}} de {{total}}",

  "timer.label": "Tiempo",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Racha",
  "streak.value": "🔥 {{count}}",

  "result.kicker": "Resultado",
  "result.yours": "Tu color",
  "result.target": "Correcto",
  "result.deltaTitle": "Diferencia",
  "result.hue": "Tono",
  "result.saturation": "Saturación",
  "result.value": "Brillo",

  "summary.title": "Juego completado",
  "summary.subtitle": "Has superado todos los retos disponibles.",
  "summary.total": "Puntuación total",
  "summary.average": "Media",
  "summary.record": "🎉 ¡Nuevo récord!",
  "summary.best": "Mejor: {{score}}",
  "summary.bestStreak": "Mejor racha: {{count}}",
  "summary.home": "Volver al inicio",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nPuntuación: {{total}}/{{max}} ({{average}}%)\n{{stars}}",

  "daily.done.title": "Reto diario completado",
  "daily.done.subtitle": "Vuelve mañana para un color nuevo.",
  "daily.score": "Tu resultado de hoy: {{score}}%",

  "finished.emoji": "🏁",
} as const;

export type TranslationKey = keyof typeof es;

const resources: Record<string, Partial<Record<TranslationKey, string>>> = {
  es,
};

function detectLocale(): string {
  try {
    const [primary] = getLocales();
    const tag = primary?.languageCode ?? "es";
    return resources[tag] ? tag : "es";
  } catch {
    return "es";
  }
}

let activeLocale = detectLocale();

export function setLocale(locale: string): void {
  if (resources[locale]) {
    activeLocale = locale;
  }
}

export function getLocale(): string {
  return activeLocale;
}

function interpolate(template: string, params?: Params): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  );
}

export function t(key: TranslationKey, params?: Params): string {
  const dictionary = resources[activeLocale] ?? es;
  const template = dictionary[key] ?? es[key] ?? key;
  return interpolate(template, params);
}
