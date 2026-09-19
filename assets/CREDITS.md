# Créditos y licencias de los assets

La procedencia máquina-a-máquina vive en `assets/sources.json` (una entrada por
id) y se copia a `generated/<id>/metadata.json` y a `generated/challenges.json`
al ejecutar `npm run generate`. Este fichero es la versión legible y el sitio
donde viven los avisos de licencia que hay obligación de conservar.

---

## Banderas — flag-icons

**243 banderas**, importadas con `npm run import:flags -- --all` desde
[lipis/flag-icons](https://github.com/lipis/flag-icons).

Las banderas en sí son emblemas estatales, no obra protegida por copyright: lo
que cubre esta licencia es el trabajo de vectorización.

### Qué se dejó fuera, y por qué

De las 271 del repo se descartaron 28. El criterio está en el comentario de
`EXCLUDED`, en `tools/importFlags.ts`; en resumen:

- **Escritura religiosa** (`sa`, `af`, `iq`, `ir`, `bn`). La que de verdad
  importa: el juego *recolorea* la imagen, y cambiarle el color a la shahada o
  a caligrafía coránica no es un riesgo legal, es una ofensa.
- **Emblemas protegidos** (`eu`, `un`). El emblema europeo y el de la ONU exigen
  autorización previa, al contrario que las banderas nacionales.
- **Soberanía no reconocida universalmente** (`tw`, `xk`, `eh`, `ps`). No es una
  postura: es que las tiendas retiran apps por mercado. La línea es el
  reconocimiento de la *estatalidad*, no el trazado de fronteras.
- **Lo que no es un Estado**: emblemas de organizaciones (`arab`, `asean`,
  `cefta`, `eac`, `pc`), banderas subestatales (`es-ct`, `es-pv`, `es-ga`,
  `gb-eng`, `gb-sct`, `gb-wls`, `gb-nir`, `sh-*`, `ic`, `ea`) y el marcador de
  «bandera desconocida» (`xx`).

Los territorios dependientes con código ISO propio (Puerto Rico, Hong Kong,
Groenlandia…) sí entran: su bandera no la discute nadie.

```
The MIT License (MIT)

Copyright (c) 2013 Panayiotis Lipiridis

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Este aviso debe aparecer también en la pantalla de créditos de la app y en la
web. Es la única obligación del MIT.

---

## Logos de marcas (catálogo heredado)

Los SVG anteriores a la importación de banderas **no tienen procedencia
registrada**: se descargaron sin guardar de dónde. `npm run generate` los lista
al final de su informe como «sin procedencia».

Los grupos de riesgo A y B (personajes, marcas figurativas y deporte) se
borraron el 2026-09-19. Lo que queda es el grupo C: logos de solo texto o formas
geométricas. Ver `PRODUCCION-PENDIENTE.md`, apartado 1.bis.
