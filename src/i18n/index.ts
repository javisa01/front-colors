import { getLocales } from "expo-localization";

/**
 * Lightweight i18n layer.
 *
 * The app ships Spanish, English and French. Spanish (`es`) is the source of
 * truth and the fallback; `en` and `fr` mirror the same keys. Every user-facing
 * string goes through `t()`, so adding another language is just a matter of
 * dropping another dictionary into `resources` below. Interpolation uses a
 * simple `{{name}}` syntax.
 *
 * NOTE: `expo-localization` is used only to detect the device language. If it
 * is not installed yet run `npx expo install expo-localization`; the code falls
 * back to Spanish if detection fails.
 */

type Params = Record<string, string | number>;

const es = {
  "common.back": "← Inicio",
  "common.backShort": "← Atrás",
  "common.exit": "← Salir",
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
  "offline.solo.section": "Solitario",
  "offline.solo.hint": "Modos de práctica para un jugador.",
  "offline.group.section": "En grupo · mismo móvil",
  "offline.group.hint": "Hasta 99 jugadores por turnos.",

  "party.mode.battle.title": "Batalla de adivinar",
  "party.mode.battle.description":
    "5 imágenes por turnos. Gana quien más se acerque.",
  "party.mode.battle-timed.title": "Batalla contrarreloj",
  "party.mode.battle-timed.description":
    "20 segundos por jugador para sumar los máximos aciertos.",
  "party.mode.coop.title": "Colaborativo",
  "party.mode.coop.description":
    "Sumad vuestras puntuaciones para una nota común.",
  "party.mode.coop-timed.title": "Colaborativo contrarreloj",
  "party.mode.coop-timed.description":
    "20-30 s por jugador según cuántos seáis; sumad todo en equipo.",

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

const en: Record<TranslationKey, string> = {
  "common.back": "← Home",
  "common.backShort": "← Back",
  "common.exit": "← Exit",
  "common.next": "Next",
  "common.retry": "Retry",
  "common.share": "Share",
  "common.loading": "Loading game...",
  "common.continue": "Continue",

  "landing.badge": "🎨 Color Quest",
  "landing.title": "Choose how\nyou want to play",
  "landing.subtitle":
    "Practise on your own or gather your friends around a single phone.",
  "landing.online.title": "Online",
  "landing.online.description": "Compete against other players in real time.",
  "landing.online.locked": "Needs a connection · in development",
  "landing.offline.title": "Offline",
  "landing.offline.description":
    "Practice mode and group matches on this device.",
  "landing.soon": "Soon",
  "landing.footer": "Online mode is coming in the next update.",

  "offline.badge": "🎮 Offline mode",
  "offline.title": "Practice & group",
  "offline.subtitle": "Play solo or pass the phone around several people.",
  "offline.solo.section": "Single player",
  "offline.solo.hint": "Single-player practice modes.",
  "offline.group.section": "Group · same phone",
  "offline.group.hint": "Up to 99 players, taking turns.",

  "party.mode.battle.title": "Guessing battle",
  "party.mode.battle.description":
    "5 images in turns. Whoever gets closest wins.",
  "party.mode.battle-timed.title": "Timed battle",
  "party.mode.battle-timed.description":
    "20 seconds per player to rack up the most hits.",
  "party.mode.coop.title": "Cooperative",
  "party.mode.coop.description": "Add up your scores for a shared team result.",
  "party.mode.coop-timed.title": "Timed cooperative",
  "party.mode.coop-timed.description":
    "20-30 s per player depending on group size; add it all up as a team.",

  "party.setup.title": "Set up the match",
  "party.setup.playersLabel": "Number of players",
  "party.setup.playersHint": "Between {{min}} and {{max}} players.",
  "party.setup.namesLabel": "Names (optional)",
  "party.setup.namesHint": "Leave blank to use “Player N”.",
  "party.setup.battleInfo": "{{count}} identical images for everyone.",
  "party.setup.coopInfo": "{{count}} images per player.",
  "party.setup.timedInfo": "{{seconds}} s per player.",
  "party.setup.start": "Start match",

  "party.playerN": "Player {{n}}",

  "party.handoff.title": "{{name}}'s turn",
  "party.handoff.subtitle": "Pass the phone to this player.",
  "party.handoff.image": "Image {{current}} of {{total}}",
  "party.handoff.timed": "You have {{seconds}} seconds.",
  "party.handoff.start": "I'm ready",

  "party.play.image": "Image {{current}} of {{total}}",
  "party.play.solved": "Hits: {{count}}",
  "party.play.check": "Check",

  "party.guess.title": "Saved!",
  "party.guess.hidden": "Pass the phone without looking at the correct color.",

  "party.round.title": "Image result",
  "party.round.correct": "Correct color",
  "party.round.you": "{{name}}",

  "party.final.title": "Final ranking",
  "party.final.coopTitle": "Team result",
  "party.final.winner": "🏆 {{name}} wins",
  "party.final.tie": "🤝 It's a tie!",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} hits",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Team average: {{average}}%",
  "party.final.contributions": "Contributions",
  "party.final.replay": "Play again",
  "party.final.home": "Back to modes",

  "home.badge": "🎨 Color Quest",
  "home.title": "Put your eye\nfor color to the test",
  "home.subtitle":
    "Pick a game mode and show how close you get to the perfect color.",
  "home.footer": "More game modes on the way.",
  "home.soon": "Soon",
  "home.best": "Best: {{score}}",

  "mode.quick.title": "Quick game",
  "mode.quick.description":
    "Guess the color of each challenge and clear every level.",
  "mode.timed.title": "Time attack",
  "mode.timed.description":
    "Hit as many colors as you can before time runs out.",
  "mode.daily.title": "Daily challenge",
  "mode.daily.description": "A new color every day to test your eye.",
  "mode.multicolor.title": "Multicolor",
  "mode.multicolor.description":
    "Rebuild every color of a single logo, one by one.",

  "game.kicker": "Color Quest",
  "game.title": "Guess the color",
  "game.subtitle":
    "Tune the picker until the result looks just like the challenge.",
  "game.check": "Check",
  "game.empty.title": "No challenges available.",
  "game.empty.subtitle":
    "Check the generated catalog or the challenge metadata.",
  "game.colorStep": "Color {{current}} of {{total}}",

  "progress.label": "Progress",
  "progress.counter": "Challenge {{current}} of {{total}}",

  "timer.label": "Time",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Streak",
  "streak.value": "🔥 {{count}}",

  "result.kicker": "Result",
  "result.yours": "Your color",
  "result.target": "Correct",
  "result.deltaTitle": "Difference",
  "result.hue": "Hue",
  "result.saturation": "Saturation",
  "result.value": "Brightness",

  "summary.title": "Game complete",
  "summary.subtitle": "You've cleared every available challenge.",
  "summary.total": "Total score",
  "summary.average": "Average",
  "summary.record": "🎉 New record!",
  "summary.best": "Best: {{score}}",
  "summary.bestStreak": "Best streak: {{count}}",
  "summary.home": "Back to home",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nScore: {{total}}/{{max}} ({{average}}%)\n{{stars}}",

  "daily.done.title": "Daily challenge complete",
  "daily.done.subtitle": "Come back tomorrow for a new color.",
  "daily.score": "Your result today: {{score}}%",

  "finished.emoji": "🏁",
};

const fr: Record<TranslationKey, string> = {
  "common.back": "← Accueil",
  "common.backShort": "← Retour",
  "common.exit": "← Quitter",
  "common.next": "Suivant",
  "common.retry": "Réessayer",
  "common.share": "Partager",
  "common.loading": "Chargement du jeu...",
  "common.continue": "Continuer",

  "landing.badge": "🎨 Color Quest",
  "landing.title": "Choisis comment\ntu veux jouer",
  "landing.subtitle":
    "Entraîne-toi en solo ou rassemble tes amis autour d'un même téléphone.",
  "landing.online.title": "En ligne",
  "landing.online.description": "Affronte d'autres joueurs en temps réel.",
  "landing.online.locked": "Nécessite une connexion · en développement",
  "landing.offline.title": "Hors ligne",
  "landing.offline.description":
    "Mode entraînement et parties de groupe sur cet appareil.",
  "landing.soon": "Bientôt",
  "landing.footer": "Le mode en ligne arrivera avec la prochaine mise à jour.",

  "offline.badge": "🎮 Mode hors ligne",
  "offline.title": "Entraînement & groupe",
  "offline.subtitle":
    "Joue seul ou fais passer le téléphone entre plusieurs personnes.",
  "offline.solo.section": "Un joueur",
  "offline.solo.hint": "Modes d'entraînement pour un joueur.",
  "offline.group.section": "En groupe · même téléphone",
  "offline.group.hint": "Jusqu'à 99 joueurs, chacun son tour.",

  "party.mode.battle.title": "Bataille de devinettes",
  "party.mode.battle.description":
    "5 images à tour de rôle. Le plus proche gagne.",
  "party.mode.battle-timed.title": "Bataille contre la montre",
  "party.mode.battle-timed.description":
    "20 secondes par joueur pour cumuler le plus de réussites.",
  "party.mode.coop.title": "Coopératif",
  "party.mode.coop.description":
    "Additionnez vos scores pour une note commune.",
  "party.mode.coop-timed.title": "Coopératif contre la montre",
  "party.mode.coop-timed.description":
    "20-30 s par joueur selon le nombre ; cumulez tout en équipe.",

  "party.setup.title": "Configure la partie",
  "party.setup.playersLabel": "Nombre de joueurs",
  "party.setup.playersHint": "Entre {{min}} et {{max}} joueurs.",
  "party.setup.namesLabel": "Noms (facultatif)",
  "party.setup.namesHint": "Laisse vide pour utiliser « Joueur N ».",
  "party.setup.battleInfo": "{{count}} images identiques pour tous.",
  "party.setup.coopInfo": "{{count}} images par joueur.",
  "party.setup.timedInfo": "{{seconds}} s par joueur.",
  "party.setup.start": "Commencer la partie",

  "party.playerN": "Joueur {{n}}",

  "party.handoff.title": "Au tour de {{name}}",
  "party.handoff.subtitle": "Passe le téléphone à ce joueur.",
  "party.handoff.image": "Image {{current}} sur {{total}}",
  "party.handoff.timed": "Tu as {{seconds}} secondes.",
  "party.handoff.start": "Je suis prêt",

  "party.play.image": "Image {{current}} sur {{total}}",
  "party.play.solved": "Réussites : {{count}}",
  "party.play.check": "Vérifier",

  "party.guess.title": "Enregistré !",
  "party.guess.hidden": "Passe le téléphone sans regarder la bonne couleur.",

  "party.round.title": "Résultat de l'image",
  "party.round.correct": "Bonne couleur",
  "party.round.you": "{{name}}",

  "party.final.title": "Classement final",
  "party.final.coopTitle": "Résultat de l'équipe",
  "party.final.winner": "🏆 {{name}} gagne",
  "party.final.tie": "🤝 Égalité !",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} réussites",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Moyenne de l'équipe : {{average}}%",
  "party.final.contributions": "Contributions",
  "party.final.replay": "Rejouer",
  "party.final.home": "Retour aux modes",

  "home.badge": "🎨 Color Quest",
  "home.title": "Mets ton œil\npour la couleur à l'épreuve",
  "home.subtitle":
    "Choisis un mode de jeu et montre à quel point tu approches la couleur parfaite.",
  "home.footer": "D'autres modes de jeu arrivent.",
  "home.soon": "Bientôt",
  "home.best": "Record : {{score}}",

  "mode.quick.title": "Partie rapide",
  "mode.quick.description":
    "Devine la couleur de chaque défi et passe tous les niveaux.",
  "mode.timed.title": "Contre la montre",
  "mode.timed.description":
    "Devine un maximum de couleurs avant la fin du temps.",
  "mode.daily.title": "Défi quotidien",
  "mode.daily.description":
    "Une nouvelle couleur chaque jour pour tester ton œil.",
  "mode.multicolor.title": "Multicolore",
  "mode.multicolor.description":
    "Reconstitue toutes les couleurs d'un même logo, une par une.",

  "game.kicker": "Color Quest",
  "game.title": "Devine la couleur",
  "game.subtitle":
    "Ajuste le sélecteur jusqu'à ce que le résultat ressemble au défi.",
  "game.check": "Vérifier",
  "game.empty.title": "Aucun défi disponible.",
  "game.empty.subtitle":
    "Vérifie le catalogue généré ou les métadonnées des défis.",
  "game.colorStep": "Couleur {{current}} sur {{total}}",

  "progress.label": "Progression",
  "progress.counter": "Défi {{current}} sur {{total}}",

  "timer.label": "Temps",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Série",
  "streak.value": "🔥 {{count}}",

  "result.kicker": "Résultat",
  "result.yours": "Ta couleur",
  "result.target": "Correcte",
  "result.deltaTitle": "Différence",
  "result.hue": "Teinte",
  "result.saturation": "Saturation",
  "result.value": "Luminosité",

  "summary.title": "Jeu terminé",
  "summary.subtitle": "Tu as réussi tous les défis disponibles.",
  "summary.total": "Score total",
  "summary.average": "Moyenne",
  "summary.record": "🎉 Nouveau record !",
  "summary.best": "Meilleur : {{score}}",
  "summary.bestStreak": "Meilleure série : {{count}}",
  "summary.home": "Retour à l'accueil",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nScore : {{total}}/{{max}} ({{average}}%)\n{{stars}}",

  "daily.done.title": "Défi quotidien terminé",
  "daily.done.subtitle": "Reviens demain pour une nouvelle couleur.",
  "daily.score": "Ton résultat d'aujourd'hui : {{score}}%",

  "finished.emoji": "🏁",
};

const resources: Record<string, Partial<Record<TranslationKey, string>>> = {
  es,
  en,
  fr,
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
