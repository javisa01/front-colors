# Iconos: símbolos universales

**14 símbolos** normalizados —señalización de seguridad ISO 7010, símbolos
universales y señales de tráfico— para usarlos como retos de color. No son
logos: no hay ninguna marca de empresa aquí, y esa es toda la diferencia con el
catálogo de `assets/done/`. Ver el apartado 1.bis de `PRODUCCION-PENDIENTE.md`.

## Cómo se eligieron

1. **Licencia comprobada archivo a archivo**, no por reputación del símbolo. Se
   consultó la API de Wikimedia Commons (`prop=imageinfo&iiprop=extmetadata`)
   para cada fichero y se leyeron `LicenseShortName` y `Restrictions` **antes**
   de descargarlo. Los 14 que quedan son `PUBLIC DOMAIN` o `CC0`; ninguno
   lleva marca de restricción.
2. **Con color propio.** Un símbolo en blanco y negro no sirve para un juego de
   color. El reciclaje se cambió por la versión verde y la «i» de información
   por una azul plana, descartando las versiones negras de ambos.
3. **El color que se adivina es el que significa algo**: el amarillo del
   triángulo, el verde de la señal de salvamento, el rojo del octógono de stop,
   el azul del símbolo de accesibilidad. Comprobado repintando los 14.

## Dónde viven

Los SVG están en esta carpeta y **no** en `assets/done/`, que es el archivo de
los logos. La procedencia máquina-a-máquina está en `assets/sources.json`, que
es lo que `npm run generate` copia al catálogo.

## Advertencia — ISO 7010, triángulo amarillo

| Icono | Color | Fuente | URL | Licencia | Trademark/restricciones | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| `warning.svg` | `#F9A800` | Señal de peligro general · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:ISO_7010_W001.svg) | `PUBLIC DOMAIN` | — | ISO 7010 W001 |
| `radiation.svg` | `#F9A800` | Señal de radiación ionizante · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:ISO_7010_W003.svg) | `PUBLIC DOMAIN` | — | ISO 7010 W003 |
| `biohazard.svg` | `#F9A800` | Señal de peligro biológico · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:ISO_7010_W009.svg) | `PUBLIC DOMAIN` | — | ISO 7010 W009 |
| `high-voltage.svg` | `#F9A800` | Señal de riesgo eléctrico · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:ISO_7010_W012.svg) | `PUBLIC DOMAIN` | — | ISO 7010 W012 |

## Condición segura y equipo contra incendios — ISO 7010, verde y rojo

| Icono | Color | Fuente | URL | Licencia | Trademark/restricciones | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| `emergency-exit.svg` | `#237F52` | Señal de salida de emergencia · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:ISO_7010_E001.svg) | `PUBLIC DOMAIN` | — | ISO 7010 E001 |
| `first-aid.svg` | `#237F52` | Señal de primeros auxilios · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:ISO_7010_E003.svg) | `PUBLIC DOMAIN` | — | ISO 7010 E003 |
| `defibrillator.svg` | `#237F52` | Señal de desfibrilador · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:ISO_7010_E010.svg) | `CC0` | — | ISO 7010 E010 |
| `fire-extinguisher.svg` | `#9B2423` | Señal de extintor · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:ISO_7010_F001.svg) | `PUBLIC DOMAIN` | — | ISO 7010 F001 |

## Símbolos universales

| Icono | Color | Fuente | URL | Licencia | Trademark/restricciones | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| `recycling.svg` | `#009900` | Símbolo universal de reciclaje · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:Recycle001.svg) | `PUBLIC DOMAIN` | — | anillo de Möbius |
| `accessibility.svg` | `#003F87` | Símbolo internacional de accesibilidad · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:Handicapped_Accessible_sign.svg) | `PUBLIC DOMAIN` | — | — |
| `information.svg` | `#0B0080` | Símbolo de información · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:Information_icon_(slanted,_monochromatic_dark_blue).svg) | `CC0` | — | — |

## Señalización viaria y de espacios públicos

| Icono | Color | Fuente | URL | Licencia | Trademark/restricciones | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| `stop.svg` | `#C0111E` | Señal de stop · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:Stop_sign.svg) | `PUBLIC DOMAIN` | — | — |
| `no-entry.svg` | `#DC0A14` | Señal de dirección prohibida · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:Vienna_Convention_road_sign_C1a-V1.svg) | `PUBLIC DOMAIN` | — | Convención de Viena C1a |
| `parking.svg` | `#154889` | Señal de aparcamiento · Wikimedia Commons | [archivo](https://commons.wikimedia.org/wiki/File:Zeichen_314_-_Parken,_StVO_2017.svg) | `PUBLIC DOMAIN` | — | StVO 314 |

## Lo que NO se ha descargado, y por qué

Los símbolos de tecnología que aparecían en el encargo son **marcas registradas
con programa de licencia propio**. Commons los tiene, y además marcados: el
campo `Restrictions` de su metadato dice literalmente `trademarked`. El dibujo
puede estar en dominio público —son formas simples— y la marca seguir viva, que
es exactamente la trampa descrita en el apartado 1.bis de
`PRODUCCION-PENDIENTE.md`.

| Símbolo | Titular | Estado | Por qué no entra |
| --- | --- | --- | --- |
| Bluetooth | Bluetooth SIG | `TRADEMARK / RESTRICTED` | La runa es marca figurativa registrada; el SIG solo la licencia a productos con certificación. |
| Wi-Fi | Wi-Fi Alliance | `TRADEMARK / RESTRICTED` | El logotipo identifica productos «Wi-Fi CERTIFIED»; su uso está reservado a miembros. |
| USB (tridente) | USB Implementers Forum | `TRADEMARK / RESTRICTED` | Uso condicionado a acuerdo de licencia con el USB-IF. |
| NFC (N-Mark) | NFC Forum | `TRADEMARK / RESTRICTED` | La N-Mark requiere licencia expresa; no hay versión libre equivalente. |
| Cruz Roja | Movimiento de la Cruz Roja | `OTHER — protegido por tratado` | Los Convenios de Ginebra prohíben usarla fuera de su cometido. Por eso primeros auxilios va con **cruz blanca sobre verde**, que es la norma ISO. |

No hay ningún icono en `review/`: los dudosos no se descargaron.

## Lo que la licencia cubre y lo que no

`PUBLIC DOMAIN` y `CC0` se refieren **al dibujo**. No dan derecho a señalizar
con él: colocar una salida de emergencia o un pictograma GHS falso en un
producto real está regulado por normativa de seguridad, no por copyright. Para
lo que hace esta app —enseñar el símbolo y pedir su color— no aplica.

## Dos avisos para quien mantenga esto

- **La tanda se recortó de 40 a 14** por los colores repetidos. Son
  normalizados: había seis triángulos compartiendo `#F9A800` y siete rombos GHS
  compartiendo `#FF0000`, y como reto de color el segundo de cada familia no
  enseñaba nada nuevo. Quedan cuatro triángulos amarillos y ningún rombo GHS.
  Si se vuelve a ampliar, mirar primero cuántos colores repite la familia.
- **Van sin `category`**, así que entran en el mismo saco que los logos y salen
  en «Juego rápido», «Contrarreloj» y «Reto diario». Si algún día quieren su
  propio modo, es añadirles `category` y una entrada en `CATEGORY_BY_MODE`.

