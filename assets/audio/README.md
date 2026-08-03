# Sonidos / Sound effects

Para añadir sonido al juego **solo** tienes que:

1. Copiar el fichero de audio en esta carpeta (`assets/audio/`), por ejemplo
   `success.mp3`.
2. Descomentar (o añadir) la línea correspondiente en
   [`index.ts`](./index.ts):

   ```ts
   success: require("./success.mp3"),
   ```

No hace falta tocar nada más: la reproducción, el silenciado y la lógica ya
están conectados en `src/utils/sound.ts` y se llaman desde las pantallas de
juego. Un sonido sin fichero registrado simplemente se ignora.

## Efectos usados

| Nombre     | Cuándo suena                             | Fichero sugerido |
| ---------- | ---------------------------------------- | ---------------- |
| `tick`     | Al mover el selector de color (opcional) | `tick.mp3`       |
| `success`  | Acierto bueno (puntuación ≥ 90)          | `success.mp3`    |
| `fail`     | Acierto flojo                            | `fail.mp3`       |
| `gameOver` | Fin de partida / resumen                 | `game-over.mp3`  |

Formatos soportados: `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`.

Usa efectos cortos y con licencia adecuada para su distribución.
