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
  "common.continue": "Continuar",

  "landing.badge": "🎨 Color Quest",
  "landing.title": "Elige cómo\nquieres jugar",
  "landing.subtitle":
    "Practica en solitario o reúne a tus amigos alrededor de un mismo móvil.",
  "landing.online.title": "Online",
  "landing.online.description":
    "Compite contra otros jugadores en tiempo real.",
  "landing.online.locked": "Necesita conexión · en desarrollo",
  "landing.offline.title": "Offline",
  "landing.offline.description":
    "Modo práctica y partidas en grupo en este dispositivo.",
  "landing.soon": "Pronto",
  "landing.footer": "El modo online llegará con la próxima actualización.",

  "offline.badge": "🎮 Modo offline",
  "offline.title": "Práctica y grupo",
  "offline.subtitle": "Juega tú solo o pásate el móvil entre varias personas.",
  "offline.solo.section": "Un jugador",
  "offline.solo.hint": "Modos de práctica en solitario.",
  "offline.group.section": "En grupo · mismo móvil",
  "offline.group.hint": "Hasta 99 jugadores por turnos.",

  "party.mode.battle.title": "Batalla de adivinar",
  "party.mode.battle.description":
    "5 imágenes por turnos. Gana quien más se acerque.",
  "party.mode.battle-timed.title": "Batalla contrarreloj",
  "party.mode.battle-timed.description":
    "Un minuto por jugador para sumar los máximos aciertos.",
  "party.mode.coop.title": "Colaborativo",
  "party.mode.coop.description":
    "Sumad vuestras puntuaciones para una nota común.",
  "party.mode.coop-timed.title": "Colaborativo contrarreloj",
  "party.mode.coop-timed.description":
    "Un minuto por jugador; sumad todo lo posible en equipo.",

  "party.setup.title": "Configura la partida",
  "party.setup.playersLabel": "Número de jugadores",
  "party.setup.playersHint": "Entre {{min}} y {{max}} jugadores.",
  "party.setup.namesLabel": "Nombres (opcional)",
  "party.setup.namesHint": "Déjalo en blanco para usar «Jugador N».",
  "party.setup.battleInfo": "{{count}} imágenes iguales para todos.",
  "party.setup.coopInfo": "{{count}} imágenes por jugador.",
  "party.setup.timedInfo": "{{seconds}} s por jugador.",
  "party.setup.start": "Empezar partida",

  "party.playerN": "Jugador {{n}}",

  "party.handoff.title": "Turno de {{name}}",
  "party.handoff.subtitle": "Pasa el móvil a este jugador.",
  "party.handoff.image": "Imagen {{current}} de {{total}}",
  "party.handoff.timed": "Tienes {{seconds}} segundos.",
  "party.handoff.start": "Estoy listo",

  "party.play.image": "Imagen {{current}} de {{total}}",
  "party.play.solved": "Aciertos: {{count}}",
  "party.play.check": "Comprobar",

  "party.guess.title": "¡Guardado!",
  "party.guess.hidden": "Pasa el móvil sin mirar el color correcto.",

  "party.round.title": "Resultado de la imagen",
  "party.round.correct": "Color correcto",
  "party.round.you": "{{name}}",

  "party.final.title": "Clasificación final",
  "party.final.coopTitle": "Resultado del equipo",
  "party.final.winner": "🏆 Gana {{name}}",
  "party.final.tie": "🤝 ¡Empate!",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} aciertos",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Media del equipo: {{average}}%",
  "party.final.contributions": "Aportaciones",
  "party.final.replay": "Jugar otra vez",
  "party.final.home": "Volver a modos",

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
