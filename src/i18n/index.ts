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
  "common.back": "Inicio",
  "common.backShort": "Atrás",
  "common.exit": "Salir",
  "common.next": "Siguiente",
  "common.retry": "Reintentar",
  "common.share": "Compartir",
  "common.loading": "Cargando juego...",
  "common.continue": "Continuar",

  // Etiquetas que solo lee un lector de pantalla: iconos sueltos y controles
  // cuyo texto visible no describe la acción.
  "a11y.back": "Volver",
  "a11y.close": "Cerrar",
  "a11y.stars": "{{value}} de {{total}} estrellas",
  "a11y.rank": "Puesto {{position}}",
  "a11y.playersDecrease": "Quitar un jugador",
  "a11y.playersIncrease": "Añadir un jugador",
  "a11y.wheel": "Rueda de tono y saturación",
  "a11y.brightness": "Brillo",
  "a11y.selectedColor": "Color seleccionado",

  "landing.badge": "Color Quest",
  "landing.title": "Elige cómo\nquieres jugar",
  "landing.subtitle":
    "Practica en solitario o reúne a tus amigos alrededor de un mismo móvil.",
  "landing.online.title": "Online",
  "landing.online.description":
    "Compite contra otros jugadores en tiempo real.",
  "landing.online.locked": "Necesita conexión a internet",
  "landing.offline.title": "Offline",
  "landing.offline.description":
    "Modo práctica y partidas en grupo en este dispositivo.",
  "landing.soon": "Pronto",
  "landing.footer": "Offline funciona sin conexión; online necesita cuenta.",

  "offline.badge": "Modo offline",
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
  "party.final.winner": "Gana {{name}}",
  "party.final.tie": "¡Empate!",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} aciertos",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Media del equipo: {{average}}%",
  "party.final.contributions": "Aportaciones",
  "party.final.replay": "Jugar otra vez",
  "party.final.home": "Volver a modos",

  "home.badge": "Color Quest",
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
  "game.runLabel": "Partida",
  "game.hits": "Aciertos: {{count}}",
  "game.points": "{{score}} pts",

  "progress.label": "Progreso",
  "progress.counter": "Reto {{current}} de {{total}}",

  "timer.label": "Tiempo",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Racha",
  "streak.value": "{{count}}",

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
  "summary.record": "¡Nuevo récord!",
  "summary.best": "Mejor: {{score}}",
  "summary.bestStreak": "Mejor racha: {{count}}",
  "summary.points": "Puntos",
  "summary.hits": "Aciertos",
  "summary.hitsOf": "de {{rounds}} intentos",
  "summary.home": "Volver al inicio",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nPuntuación: {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Color Quest — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} aciertos ({{average}}%)\n{{stars}}",

  "daily.done.title": "Reto diario completado",
  "daily.done.subtitle": "Vuelve mañana para un color nuevo.",
  "daily.score": "Tu resultado de hoy: {{score}}%",


  "score.perfect": "¡Perfecto!",
  "score.close": "¡Muy cerca!",
  "score.good": "Buen intento",
  "score.tryAgain": "Sigue probando",

  "run.artist": "¡Ojo de artista!",
  "run.great": "¡Gran puntería!",
  "run.good": "Buen trabajo",
  "run.practice": "Sigue practicando",

  "validate.correct": "¡Correcto!",
  "validate.tryAgain": "Sigue probando.",

  "settings.title": "Ajustes de sonido",
  "settings.music": "Música",
  "settings.sfx": "Efectos",
  "settings.close": "Cerrar",

  // --- Modo online -------------------------------------------------------
  "online.session.restoring": "Recuperando tu sesión...",
  "online.level": "Nivel {{level}}",
  "online.xp": "{{xp}} XP",
  "online.xpToNext": "Faltan {{xp}} XP",

  "online.auth.badge": "Modo online",
  "online.auth.title": "Entra en tu cuenta",
  "online.auth.titleRegister": "Crea tu cuenta",
  "online.auth.subtitle":
    "Necesitas una cuenta para competir, tener amigos y aparecer en la clasificación.",
  "online.auth.subtitleRegister":
    "Elige un nombre, guarda tu progreso y compite con el resto de jugadores.",
  "online.auth.login": "Iniciar sesión",
  "online.auth.register": "Registrarse",
  "online.auth.username": "Nombre de jugador",
  "online.auth.usernamePlaceholder": "colorista",
  "online.auth.usernameHint":
    "De 3 a 24 caracteres: letras, números y . _ - Podrás cambiarlo luego.",
  "online.auth.email": "Email",
  "online.auth.emailPlaceholder": "tu@email.com",
  "online.auth.emailHint": "El email con el que creaste la cuenta.",
  "online.auth.password": "Contraseña",
  "online.auth.passwordPlaceholder": "••••••••",
  "online.auth.passwordHint": "Mínimo 8 caracteres.",
  "online.auth.switchToRegister": "¿Aún no tienes cuenta?",
  "online.auth.switchToLogin": "¿Ya tienes cuenta?",
  "online.auth.offlineNote":
    "El modo offline sigue funcionando sin cuenta ni conexión: tus récords locales no se tocan.",
  "online.auth.error.passwordRequired": "Escribe tu contraseña.",
  "online.auth.error.passwordShort": "Mínimo {{min}} caracteres.",
  "online.auth.error.usernameLength": "Entre 3 y 24 caracteres.",
  "online.auth.error.usernameChars": "Solo letras, números y . _ -",
  "online.auth.error.email": "Ese email no parece válido.",
  "online.auth.error.code": "El código tiene {{length}} dígitos.",
  "online.auth.or": "o",
  "online.auth.google": "Continuar con Google",
  "online.auth.apple": "Continuar con Apple",
  "online.auth.connecting": "Conectando...",
  "online.auth.unavailable":
    "El modo online no está configurado en esta versión de la app. El resto del juego funciona igual.",
  "online.auth.verify.title": "Confirma tu email",
  "online.auth.verify.subtitle":
    "Te hemos enviado un código de 6 dígitos a {{email}}.",
  "online.auth.verify.code": "Código de verificación",
  "online.auth.verify.codePlaceholder": "123456",
  "online.auth.verify.hint": "Mira también en la carpeta de spam.",
  "online.auth.verify.submit": "Confirmar",
  "online.auth.verify.resend": "Enviar otro código",
  "online.auth.verify.resent": "Código reenviado.",
  "online.auth.verify.back": "Cambiar de email",

  "online.hub.badge": "Modo online",
  "online.hub.title": "Tu cuenta",
  "online.hub.subtitle":
    "Gestiona tu perfil, tus amigos y mira cómo vas en la clasificación.",
  "online.hub.globalRank": "Puesto global",
  "online.hub.friendsRank": "Entre amigos",
  "online.hub.ofPlayers": "de {{total}} jugadores",
  "online.hub.friendCount": "{{count}} amigos",
  "online.hub.profile.title": "Perfil",
  "online.hub.profile.description": "Tu nivel, tu XP y los datos de la cuenta.",
  "online.hub.friends.title": "Amigos",
  "online.hub.friends.description": "Busca jugadores y gestiona tus solicitudes.",
  "online.hub.leaderboard.title": "Clasificación",
  "online.hub.leaderboard.description": "El ranking mundial y el de tus amigos.",
  "online.hub.match.title": "Partida online",
  "online.hub.match.description": "Compite en tiempo real contra otros jugadores.",
  "online.hub.match.locked": "Necesita partidas en tiempo real · en desarrollo",

  "online.profile.badge": "Perfil",
  "online.profile.title": "Tu perfil",
  "online.profile.subtitle": "Así te ven el resto de jugadores.",
  "online.profile.account": "Datos de la cuenta",
  "online.profile.memberSince": "Miembro desde",
  "online.profile.nextLevel": "Faltan {{xp}} XP para el nivel {{level}}.",
  "online.profile.edit": "Cambiar nombre",
  "online.profile.save": "Guardar",
  "online.profile.cancel": "Cancelar",
  "online.profile.saved": "Nombre actualizado.",
  "online.profile.session": "Sesión",
  "online.profile.sessionHint":
    "Al salir se borra la sesión de este dispositivo. El modo offline no se ve afectado.",
  "online.profile.logout": "Cerrar sesión",

  "online.friends.badge": "Amigos",
  "online.friends.title": "Tus amigos",
  "online.friends.subtitle": "Busca jugadores por su nombre y añádelos.",
  "online.friends.searchLabel": "Buscar jugadores",
  "online.friends.searchPlaceholder": "Nombre de usuario",
  "online.friends.searchHint": "Escribe al menos {{min}} caracteres.",
  "online.friends.searching": "Buscando...",
  "online.friends.noResults": "Nadie coincide con «{{query}}».",
  "online.friends.add": "Añadir",
  "online.friends.you": "Eres tú",
  "online.friends.alreadyFriend": "Ya sois amigos",
  "online.friends.requestSent": "Solicitud enviada",
  "online.friends.requestReceived": "Te ha escrito",
  "online.friends.incoming": "Solicitudes recibidas",
  "online.friends.incomingHint": "Acepta para veros en la clasificación de amigos.",
  "online.friends.outgoing": "Solicitudes enviadas",
  "online.friends.accept": "Aceptar",
  "online.friends.reject": "Rechazar",
  "online.friends.cancel": "Cancelar",
  "online.friends.remove": "Eliminar",
  "online.friends.list": "Amigos",
  "online.friends.listCount": "{{count}} en total.",
  "online.friends.loading": "Cargando amigos...",
  "online.friends.emptyTitle": "Todavía no tienes amigos",
  "online.friends.emptyHint":
    "Busca a alguien por su nombre de usuario y envíale una solicitud.",

  "online.leaderboard.badge": "Clasificación",
  "online.leaderboard.title": "Ranking",
  "online.leaderboard.subtitle": "Se ordena por XP acumulada.",
  "online.leaderboard.global": "Mundial",
  "online.leaderboard.friends": "Amigos",
  "online.leaderboard.total": "{{total}} jugadores",
  "online.leaderboard.you": "tú",
  "online.leaderboard.loading": "Cargando clasificación...",
  "online.leaderboard.loadMore": "Ver más",
  "online.leaderboard.loadingMore": "Cargando...",
  "online.leaderboard.emptyGlobal": "La clasificación está vacía",
  "online.leaderboard.emptyGlobalHint": "Sé el primero en sumar XP.",
  "online.leaderboard.emptyFriends": "Sin amigos en la clasificación",
  "online.leaderboard.emptyFriendsHint":
    "Añade amigos y aparecerán aquí ordenados por XP.",

  "online.error.generic": "Algo ha ido mal. Inténtalo otra vez.",
  "online.error.network":
    "No hemos podido conectar con el servidor. Revisa tu conexión.",
  "online.error.credentials": "Email o contraseña incorrectos.",
  "online.error.passwordPwned":
    "Esa contraseña ha aparecido en filtraciones conocidas. Elige otra.",
  "online.error.passwordWeak": "Esa contraseña es demasiado débil.",
  "online.error.codeIncorrect": "Ese código no es correcto.",
  "online.error.codeExpired": "El código ha caducado. Pide uno nuevo.",
  "online.error.captcha": "No hemos podido verificar que eres una persona.",
  "online.error.sessionExists": "Ya tienes la sesión abierta.",
  "online.error.emailUsed": "Ya hay una cuenta con ese email.",
  "online.error.usernameUsed": "Ese nombre de usuario ya está cogido.",
  "online.error.userNotFound": "No hemos encontrado a ese jugador.",
  "online.error.rateLimited": "Demasiados intentos. Espera un momento.",
  "online.error.validation": "Revisa los datos introducidos.",
  "online.error.sessionExpired": "Tu sesión ha caducado. Entra de nuevo.",
  "online.error.friendExists": "Ya existe una solicitud con ese jugador.",
  "online.error.friendSelf": "No puedes añadirte a ti mismo.",
  "online.error.friendNotFound": "Esa solicitud ya no existe.",
} as const;

export type TranslationKey = keyof typeof es;

const en: Record<TranslationKey, string> = {
  "common.back": "Home",
  "common.backShort": "Back",
  "common.exit": "Exit",
  "common.next": "Next",
  "common.retry": "Retry",
  "common.share": "Share",
  "common.loading": "Loading game...",
  "common.continue": "Continue",

  "a11y.back": "Go back",
  "a11y.close": "Close",
  "a11y.stars": "{{value}} out of {{total}} stars",
  "a11y.rank": "Rank {{position}}",
  "a11y.playersDecrease": "Remove a player",
  "a11y.playersIncrease": "Add a player",
  "a11y.wheel": "Hue and saturation wheel",
  "a11y.brightness": "Brightness",
  "a11y.selectedColor": "Selected colour",

  "landing.badge": "Color Quest",
  "landing.title": "Choose how\nyou want to play",
  "landing.subtitle":
    "Practise on your own or gather your friends around a single phone.",
  "landing.online.title": "Online",
  "landing.online.description": "Compete against other players in real time.",
  "landing.online.locked": "Needs an internet connection",
  "landing.offline.title": "Offline",
  "landing.offline.description":
    "Practice mode and group matches on this device.",
  "landing.soon": "Soon",
  "landing.footer": "Offline works with no connection; online needs an account.",

  "offline.badge": "Offline mode",
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
  "party.final.winner": "{{name}} wins",
  "party.final.tie": "It's a tie!",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} hits",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Team average: {{average}}%",
  "party.final.contributions": "Contributions",
  "party.final.replay": "Play again",
  "party.final.home": "Back to modes",

  "home.badge": "Color Quest",
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
  "game.runLabel": "Run",
  "game.hits": "Hits: {{count}}",
  "game.points": "{{score}} pts",

  "progress.label": "Progress",
  "progress.counter": "Challenge {{current}} of {{total}}",

  "timer.label": "Time",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Streak",
  "streak.value": "{{count}}",

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
  "summary.record": "New record!",
  "summary.best": "Best: {{score}}",
  "summary.bestStreak": "Best streak: {{count}}",
  "summary.points": "Points",
  "summary.hits": "Hits",
  "summary.hitsOf": "of {{rounds}} guesses",
  "summary.home": "Back to home",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nScore: {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Color Quest — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} hits ({{average}}%)\n{{stars}}",

  "daily.done.title": "Daily challenge complete",
  "daily.done.subtitle": "Come back tomorrow for a new color.",
  "daily.score": "Your result today: {{score}}%",


  "score.perfect": "Perfect!",
  "score.close": "Very close!",
  "score.good": "Good try",
  "score.tryAgain": "Keep trying",

  "run.artist": "Artist's eye!",
  "run.great": "Great aim!",
  "run.good": "Good job",
  "run.practice": "Keep practising",

  "validate.correct": "Correct!",
  "validate.tryAgain": "Keep trying.",

  "settings.title": "Sound settings",
  "settings.music": "Music",
  "settings.sfx": "Effects",
  "settings.close": "Close",

  // --- Online mode -------------------------------------------------------
  "online.session.restoring": "Restoring your session...",
  "online.level": "Level {{level}}",
  "online.xp": "{{xp}} XP",
  "online.xpToNext": "{{xp}} XP to go",

  "online.auth.badge": "Online mode",
  "online.auth.title": "Sign in",
  "online.auth.titleRegister": "Create your account",
  "online.auth.subtitle":
    "You need an account to compete, add friends and show up on the leaderboard.",
  "online.auth.subtitleRegister":
    "Pick a name, save your progress and compete with everyone else.",
  "online.auth.login": "Sign in",
  "online.auth.register": "Sign up",
  "online.auth.username": "Player name",
  "online.auth.usernamePlaceholder": "colorist",
  "online.auth.usernameHint":
    "3 to 24 characters: letters, numbers and . _ - You can change it later.",
  "online.auth.email": "Email",
  "online.auth.emailPlaceholder": "you@email.com",
  "online.auth.emailHint": "The email you signed up with.",
  "online.auth.password": "Password",
  "online.auth.passwordPlaceholder": "••••••••",
  "online.auth.passwordHint": "At least 8 characters.",
  "online.auth.switchToRegister": "No account yet?",
  "online.auth.switchToLogin": "Already have an account?",
  "online.auth.offlineNote":
    "Offline mode keeps working with no account and no connection: your local records stay untouched.",
  "online.auth.error.passwordRequired": "Enter your password.",
  "online.auth.error.passwordShort": "At least {{min}} characters.",
  "online.auth.error.usernameLength": "Between 3 and 24 characters.",
  "online.auth.error.usernameChars": "Only letters, numbers and . _ -",
  "online.auth.error.email": "That email does not look valid.",
  "online.auth.error.code": "The code has {{length}} digits.",
  "online.auth.or": "or",
  "online.auth.google": "Continue with Google",
  "online.auth.apple": "Continue with Apple",
  "online.auth.connecting": "Connecting...",
  "online.auth.unavailable":
    "Online mode is not configured in this build. The rest of the game works as usual.",
  "online.auth.verify.title": "Confirm your email",
  "online.auth.verify.subtitle": "We sent a 6-digit code to {{email}}.",
  "online.auth.verify.code": "Verification code",
  "online.auth.verify.codePlaceholder": "123456",
  "online.auth.verify.hint": "Check your spam folder too.",
  "online.auth.verify.submit": "Confirm",
  "online.auth.verify.resend": "Send another code",
  "online.auth.verify.resent": "Code sent again.",
  "online.auth.verify.back": "Use another email",

  "online.hub.badge": "Online mode",
  "online.hub.title": "Your account",
  "online.hub.subtitle":
    "Manage your profile and friends, and see how you rank.",
  "online.hub.globalRank": "Global rank",
  "online.hub.friendsRank": "Among friends",
  "online.hub.ofPlayers": "of {{total}} players",
  "online.hub.friendCount": "{{count}} friends",
  "online.hub.profile.title": "Profile",
  "online.hub.profile.description": "Your level, your XP and your account details.",
  "online.hub.friends.title": "Friends",
  "online.hub.friends.description": "Find players and handle your requests.",
  "online.hub.leaderboard.title": "Leaderboard",
  "online.hub.leaderboard.description": "The global ranking and your friends'.",
  "online.hub.match.title": "Online match",
  "online.hub.match.description": "Compete in real time against other players.",
  "online.hub.match.locked": "Needs real-time matches · in development",

  "online.profile.badge": "Profile",
  "online.profile.title": "Your profile",
  "online.profile.subtitle": "This is how other players see you.",
  "online.profile.account": "Account details",
  "online.profile.memberSince": "Member since",
  "online.profile.nextLevel": "{{xp}} XP to reach level {{level}}.",
  "online.profile.edit": "Change name",
  "online.profile.save": "Save",
  "online.profile.cancel": "Cancel",
  "online.profile.saved": "Name updated.",
  "online.profile.session": "Session",
  "online.profile.sessionHint":
    "Signing out clears the session on this device. Offline mode is unaffected.",
  "online.profile.logout": "Sign out",

  "online.friends.badge": "Friends",
  "online.friends.title": "Your friends",
  "online.friends.subtitle": "Search players by name and add them.",
  "online.friends.searchLabel": "Find players",
  "online.friends.searchPlaceholder": "Username",
  "online.friends.searchHint": "Type at least {{min}} characters.",
  "online.friends.searching": "Searching...",
  "online.friends.noResults": "Nobody matches \u201c{{query}}\u201d.",
  "online.friends.add": "Add",
  "online.friends.you": "That is you",
  "online.friends.alreadyFriend": "Already friends",
  "online.friends.requestSent": "Request sent",
  "online.friends.requestReceived": "They wrote to you",
  "online.friends.incoming": "Incoming requests",
  "online.friends.incomingHint": "Accept to appear in each other's friends ranking.",
  "online.friends.outgoing": "Sent requests",
  "online.friends.accept": "Accept",
  "online.friends.reject": "Decline",
  "online.friends.cancel": "Cancel",
  "online.friends.remove": "Remove",
  "online.friends.list": "Friends",
  "online.friends.listCount": "{{count}} in total.",
  "online.friends.loading": "Loading friends...",
  "online.friends.emptyTitle": "No friends yet",
  "online.friends.emptyHint":
    "Search someone by their username and send them a request.",

  "online.leaderboard.badge": "Leaderboard",
  "online.leaderboard.title": "Ranking",
  "online.leaderboard.subtitle": "Sorted by total XP.",
  "online.leaderboard.global": "Global",
  "online.leaderboard.friends": "Friends",
  "online.leaderboard.total": "{{total}} players",
  "online.leaderboard.you": "you",
  "online.leaderboard.loading": "Loading leaderboard...",
  "online.leaderboard.loadMore": "Show more",
  "online.leaderboard.loadingMore": "Loading...",
  "online.leaderboard.emptyGlobal": "The leaderboard is empty",
  "online.leaderboard.emptyGlobalHint": "Be the first to earn XP.",
  "online.leaderboard.emptyFriends": "No friends on the leaderboard",
  "online.leaderboard.emptyFriendsHint":
    "Add friends and they will show up here sorted by XP.",

  "online.error.generic": "Something went wrong. Try again.",
  "online.error.network":
    "We could not reach the server. Check your connection.",
  "online.error.credentials": "Wrong email or password.",
  "online.error.passwordPwned":
    "That password has shown up in known breaches. Pick another one.",
  "online.error.passwordWeak": "That password is too weak.",
  "online.error.codeIncorrect": "That code is not correct.",
  "online.error.codeExpired": "The code expired. Ask for a new one.",
  "online.error.captcha": "We could not verify that you are a human.",
  "online.error.sessionExists": "You are already signed in.",
  "online.error.emailUsed": "There is already an account with that email.",
  "online.error.usernameUsed": "That username is taken.",
  "online.error.userNotFound": "We could not find that player.",
  "online.error.rateLimited": "Too many attempts. Wait a moment.",
  "online.error.validation": "Check the details you entered.",
  "online.error.sessionExpired": "Your session expired. Sign in again.",
  "online.error.friendExists": "There is already a request with that player.",
  "online.error.friendSelf": "You cannot add yourself.",
  "online.error.friendNotFound": "That request no longer exists.",
};

const fr: Record<TranslationKey, string> = {
  "common.back": "Accueil",
  "common.backShort": "Retour",
  "common.exit": "Quitter",
  "common.next": "Suivant",
  "common.retry": "Réessayer",
  "common.share": "Partager",
  "common.loading": "Chargement du jeu...",
  "common.continue": "Continuer",

  "a11y.back": "Revenir",
  "a11y.close": "Fermer",
  "a11y.stars": "{{value}} étoiles sur {{total}}",
  "a11y.rank": "Place {{position}}",
  "a11y.playersDecrease": "Retirer un joueur",
  "a11y.playersIncrease": "Ajouter un joueur",
  "a11y.wheel": "Roue de teinte et saturation",
  "a11y.brightness": "Luminosité",
  "a11y.selectedColor": "Couleur sélectionnée",

  "landing.badge": "Color Quest",
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

  "offline.badge": "Mode hors ligne",
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
  "party.final.winner": "{{name}} gagne",
  "party.final.tie": "Égalité !",
  "party.final.points": "{{score}} pts",
  "party.final.rounds": "{{count}} réussites",
  "party.final.teamScore": "{{score}} / {{max}} pts",
  "party.final.teamAverage": "Moyenne de l'équipe : {{average}}%",
  "party.final.contributions": "Contributions",
  "party.final.replay": "Rejouer",
  "party.final.home": "Retour aux modes",

  "home.badge": "Color Quest",
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
  "game.runLabel": "Partie",
  "game.hits": "Réussites : {{count}}",
  "game.points": "{{score}} pts",

  "progress.label": "Progression",
  "progress.counter": "Défi {{current}} sur {{total}}",

  "timer.label": "Temps",
  "timer.seconds": "{{seconds}}s",
  "streak.label": "Série",
  "streak.value": "{{count}}",

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
  "summary.record": "Nouveau record !",
  "summary.best": "Meilleur : {{score}}",
  "summary.bestStreak": "Meilleure série : {{count}}",
  "summary.points": "Points",
  "summary.hits": "Réussites",
  "summary.hitsOf": "sur {{rounds}} essais",
  "summary.home": "Retour à l'accueil",
  "summary.shareText":
    "🎨 Color Quest — {{mode}}\nScore : {{total}}/{{max}} ({{average}}%)\n{{stars}}",
  "summary.shareTimed":
    "🎨 Color Quest — {{mode}}\n{{score}} pts · {{hits}}/{{rounds}} réussites ({{average}}%)\n{{stars}}",

  "daily.done.title": "Défi quotidien terminé",
  "daily.done.subtitle": "Reviens demain pour une nouvelle couleur.",
  "daily.score": "Ton résultat d'aujourd'hui : {{score}}%",


  "score.perfect": "Parfait !",
  "score.close": "Très proche !",
  "score.good": "Bon essai",
  "score.tryAgain": "Continue d'essayer",

  "run.artist": "Œil d'artiste !",
  "run.great": "Super visée !",
  "run.good": "Bon travail",
  "run.practice": "Continue de t'entraîner",

  "validate.correct": "Correct !",
  "validate.tryAgain": "Continue d'essayer.",

  "settings.title": "Réglages du son",
  "settings.music": "Musique",
  "settings.sfx": "Effets",
  "settings.close": "Fermer",

  // --- Mode en ligne -----------------------------------------------------
  "online.session.restoring": "Restauration de ta session...",
  "online.level": "Niveau {{level}}",
  "online.xp": "{{xp}} XP",
  "online.xpToNext": "Encore {{xp}} XP",

  "online.auth.badge": "Mode en ligne",
  "online.auth.title": "Connexion",
  "online.auth.titleRegister": "Cree ton compte",
  "online.auth.subtitle":
    "Il te faut un compte pour jouer, avoir des amis et figurer au classement.",
  "online.auth.subtitleRegister":
    "Choisis un nom, garde ta progression et affronte les autres joueurs.",
  "online.auth.login": "Se connecter",
  "online.auth.register": "S'inscrire",
  "online.auth.username": "Pseudo",
  "online.auth.usernamePlaceholder": "coloriste",
  "online.auth.usernameHint":
    "De 3 a 24 caracteres : lettres, chiffres et . _ - Tu pourras le changer.",
  "online.auth.email": "Email",
  "online.auth.emailPlaceholder": "toi@email.com",
  "online.auth.emailHint": "L'email utilise a la creation du compte.",
  "online.auth.password": "Mot de passe",
  "online.auth.passwordPlaceholder": "••••••••",
  "online.auth.passwordHint": "8 caracteres minimum.",
  "online.auth.switchToRegister": "Pas encore de compte ?",
  "online.auth.switchToLogin": "Deja un compte ?",
  "online.auth.offlineNote":
    "Le mode hors ligne fonctionne toujours sans compte ni connexion : tes records locaux ne bougent pas.",
  "online.auth.error.passwordRequired": "Saisis ton mot de passe.",
  "online.auth.error.passwordShort": "{{min}} caracteres minimum.",
  "online.auth.error.usernameLength": "Entre 3 et 24 caracteres.",
  "online.auth.error.usernameChars": "Uniquement lettres, chiffres et . _ -",
  "online.auth.error.email": "Cet email ne semble pas valide.",
  "online.auth.error.code": "Le code contient {{length}} chiffres.",
  "online.auth.or": "ou",
  "online.auth.google": "Continuer avec Google",
  "online.auth.apple": "Continuer avec Apple",
  "online.auth.connecting": "Connexion...",
  "online.auth.unavailable":
    "Le mode en ligne n'est pas configure dans cette version. Le reste du jeu fonctionne normalement.",
  "online.auth.verify.title": "Confirme ton email",
  "online.auth.verify.subtitle":
    "Nous avons envoye un code a 6 chiffres a {{email}}.",
  "online.auth.verify.code": "Code de verification",
  "online.auth.verify.codePlaceholder": "123456",
  "online.auth.verify.hint": "Regarde aussi dans les spams.",
  "online.auth.verify.submit": "Confirmer",
  "online.auth.verify.resend": "Envoyer un autre code",
  "online.auth.verify.resent": "Code renvoye.",
  "online.auth.verify.back": "Changer d'email",

  "online.hub.badge": "Mode en ligne",
  "online.hub.title": "Ton compte",
  "online.hub.subtitle":
    "Gere ton profil, tes amis et vois ou tu en es au classement.",
  "online.hub.globalRank": "Rang mondial",
  "online.hub.friendsRank": "Parmi tes amis",
  "online.hub.ofPlayers": "sur {{total}} joueurs",
  "online.hub.friendCount": "{{count}} amis",
  "online.hub.profile.title": "Profil",
  "online.hub.profile.description": "Ton niveau, ton XP et les donnees du compte.",
  "online.hub.friends.title": "Amis",
  "online.hub.friends.description": "Cherche des joueurs et gere tes demandes.",
  "online.hub.leaderboard.title": "Classement",
  "online.hub.leaderboard.description": "Le classement mondial et celui de tes amis.",
  "online.hub.match.title": "Partie en ligne",
  "online.hub.match.description": "Affronte d'autres joueurs en temps reel.",
  "online.hub.match.locked": "Necessite les parties en temps reel · en cours",

  "online.profile.badge": "Profil",
  "online.profile.title": "Ton profil",
  "online.profile.subtitle": "Voila comment les autres joueurs te voient.",
  "online.profile.account": "Donnees du compte",
  "online.profile.memberSince": "Membre depuis",
  "online.profile.nextLevel": "Encore {{xp}} XP pour le niveau {{level}}.",
  "online.profile.edit": "Changer de nom",
  "online.profile.save": "Enregistrer",
  "online.profile.cancel": "Annuler",
  "online.profile.saved": "Nom mis a jour.",
  "online.profile.session": "Session",
  "online.profile.sessionHint":
    "La deconnexion efface la session de cet appareil. Le mode hors ligne n'est pas touche.",
  "online.profile.logout": "Se deconnecter",

  "online.friends.badge": "Amis",
  "online.friends.title": "Tes amis",
  "online.friends.subtitle": "Cherche des joueurs par leur nom et ajoute-les.",
  "online.friends.searchLabel": "Chercher des joueurs",
  "online.friends.searchPlaceholder": "Pseudo",
  "online.friends.searchHint": "Saisis au moins {{min}} caracteres.",
  "online.friends.searching": "Recherche...",
  "online.friends.noResults": "Personne ne correspond a \u00ab {{query}} \u00bb.",
  "online.friends.add": "Ajouter",
  "online.friends.you": "C'est toi",
  "online.friends.alreadyFriend": "Deja amis",
  "online.friends.requestSent": "Demande envoyee",
  "online.friends.requestReceived": "Il t'a ecrit",
  "online.friends.incoming": "Demandes recues",
  "online.friends.incomingHint": "Accepte pour apparaitre dans vos classements d'amis.",
  "online.friends.outgoing": "Demandes envoyees",
  "online.friends.accept": "Accepter",
  "online.friends.reject": "Refuser",
  "online.friends.cancel": "Annuler",
  "online.friends.remove": "Supprimer",
  "online.friends.list": "Amis",
  "online.friends.listCount": "{{count}} au total.",
  "online.friends.loading": "Chargement des amis...",
  "online.friends.emptyTitle": "Pas encore d'amis",
  "online.friends.emptyHint":
    "Cherche quelqu'un par son pseudo et envoie-lui une demande.",

  "online.leaderboard.badge": "Classement",
  "online.leaderboard.title": "Classement",
  "online.leaderboard.subtitle": "Trie par XP cumulee.",
  "online.leaderboard.global": "Mondial",
  "online.leaderboard.friends": "Amis",
  "online.leaderboard.total": "{{total}} joueurs",
  "online.leaderboard.you": "toi",
  "online.leaderboard.loading": "Chargement du classement...",
  "online.leaderboard.loadMore": "Voir plus",
  "online.leaderboard.loadingMore": "Chargement...",
  "online.leaderboard.emptyGlobal": "Le classement est vide",
  "online.leaderboard.emptyGlobalHint": "Sois le premier a gagner de l'XP.",
  "online.leaderboard.emptyFriends": "Aucun ami au classement",
  "online.leaderboard.emptyFriendsHint":
    "Ajoute des amis et ils apparaitront ici, tries par XP.",

  "online.error.generic": "Quelque chose a mal tourne. Reessaie.",
  "online.error.network":
    "Impossible de joindre le serveur. Verifie ta connexion.",
  "online.error.credentials": "Email ou mot de passe incorrect.",
  "online.error.passwordPwned":
    "Ce mot de passe apparait dans des fuites connues. Choisis-en un autre.",
  "online.error.passwordWeak": "Ce mot de passe est trop faible.",
  "online.error.codeIncorrect": "Ce code n'est pas correct.",
  "online.error.codeExpired": "Le code a expire. Demandes-en un nouveau.",
  "online.error.captcha": "Nous n'avons pas pu verifier que tu es humain.",
  "online.error.sessionExists": "Tu es deja connecte.",
  "online.error.emailUsed": "Un compte utilise deja cet email.",
  "online.error.usernameUsed": "Ce pseudo est deja pris.",
  "online.error.userNotFound": "Joueur introuvable.",
  "online.error.rateLimited": "Trop de tentatives. Patiente un instant.",
  "online.error.validation": "Verifie les informations saisies.",
  "online.error.sessionExpired": "Ta session a expire. Reconnecte-toi.",
  "online.error.friendExists": "Une demande existe deja avec ce joueur.",
  "online.error.friendSelf": "Tu ne peux pas t'ajouter toi-meme.",
  "online.error.friendNotFound": "Cette demande n'existe plus.",
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
