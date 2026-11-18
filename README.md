# Inventario de Repuestos: versión propia (fuera de Claude)

La misma app de siempre, pero con base de datos, fotos y login propios en **Supabase**, la IA llamada desde el servidor (la clave de Anthropic nunca llega al teléfono) y **precios reales de MercadoLibre**, que la IA busca en publicaciones de mercadolibre.com.ar.

**App publicada:** <https://luchassgonzalez-afk.github.io/inventario-repuestos/> (se entra con usuario y contraseña).

## Qué hay en esta carpeta

| Carpeta | Qué es |
|---|---|
| `index.html`, `config.js` | La app y los datos públicos del proyecto de Supabase. GitHub Pages publica esto. |
| `supabase/migrations/001_inicial.sql` | Crea la tabla, los permisos y el lugar para las fotos. |
| `supabase/functions/ia` | Identifica repuestos por foto y estima precios (usa tu clave de Anthropic). |
| `supabase/functions/precios-ml` | La IA busca publicaciones de MercadoLibre Argentina y devuelve precio mínimo, mediana, cantidad de publicaciones y enlace a la más barata. |
| `scripts/crear-usuarios.mjs` | Crea los usuarios lucas, franco y elvas. |
| `scripts/migrar.mjs` | Pasa las piezas y fotos que había en Claude a Supabase. |
| `migracion/datos/` | Lo exportado del artefacto el 15/11/2026: **41 piezas y 44 fotos**. No está en el repositorio público: está en el .zip que se entregó aparte. |

Para los pasos con comandos necesitás una computadora con [Node.js 18 o más nuevo](https://nodejs.org) y la [CLI de Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) (`npm i -g supabase` o `brew install supabase/tap/supabase`).

## Paso a paso

### 1. Crear el proyecto en Supabase (gratis)
1. Entrá a <https://supabase.com>, creá una cuenta y un proyecto nuevo (región São Paulo es la más cercana).
2. En **Project Settings → API** anotá: `Project URL`, la `anon public` key y la `service_role` key. La service_role es secreta: no la pegues en la app ni la compartas.

### 2. Crear la base
**SQL Editor → New query**, pegá todo `supabase/migrations/001_inicial.sql` y tocá **Run**.

### 3. Cerrar el registro público
**Authentication → Sign In / Providers → Email**: dejá Email activado y **desactivá "Allow new users to sign up"**. Así solo entran los usuarios que crees vos.

### 4. Crear los 3 usuarios
```bash
cd app-repuestos
SUPABASE_URL=https://TU-PROYECTO.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/crear-usuarios.mjs
```
Te pide la contraseña inicial (la escribís en ese momento; no queda guardada en ningún archivo). Se crean `lucas`, `franco` y `elvas`. **La primera vez que cada uno entra, la app le pide elegir una contraseña nueva de 8 caracteres o más**, porque una inicial como 123456 se adivina enseguida. Después se puede cambiar cuando quieran con el botón "Cambiar contraseña".

### 5. Publicar las funciones del servidor
```bash
supabase login
supabase link --project-ref TU-PROYECTO          # el código que está en la URL del proyecto
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # de https://platform.claude.com/settings/keys
supabase functions deploy ia
supabase functions deploy precios-ml
# En el panel, apagá "Verify JWT with legacy secret" en las dos funciones (cada una revisa el login por su cuenta).
```
Opcional: `supabase secrets set ANTHROPIC_MODEL=...` para cambiar el modelo (por defecto `claude-sonnet-5-5`).

### 6. Precios de MercadoLibre (no hay que configurar nada)
La API de MercadoLibre pide una aplicación registrada, y en noviembre de 2026 MercadoLibre dejó de dar de alta aplicaciones nuevas. Por eso `precios-ml` no usa esa API: le pide a Claude que busque publicaciones con su búsqueda web, limitada a mercadolibre.com.ar, y calcula el precio mínimo y la mediana con lo que encuentra. Alcanza con la `ANTHROPIC_API_KEY` del paso 5.

Cada repuesto hace hasta 3 búsquedas web (US$ 10 cada 1.000 búsquedas) más los tokens de la IA. Los precios salen de lo que muestran los buscadores, así que pueden estar unos días atrasados: tocá "Ver la más barata" para confirmar antes de publicar.

### 7. Pasar los datos de Claude
Opción fácil, desde la app: abrí la app con `#importar` al final del enlace (por ejemplo `https://.../index.html#importar`), entrá con tu usuario, tocá **Elegir carpeta "datos"** y elegí `migracion/datos`.

Opción por comandos:
```bash
SUPABASE_URL=https://TU-PROYECTO.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrar.mjs
```
Cualquiera de las dos sube las 44 fotos con el mismo nombre que tenían y las 41 piezas con todos sus datos (precios, notas, códigos, miniaturas, marcas de repetidos). Se puede correr de nuevo sin duplicar nada.

> Lo que se cargue en la app vieja de Claude **después del 15/11/2026** no está en esta exportación. Conviene dejar de usarla y, si hace falta, pedir una exportación nueva antes de migrar.

### 8. Publicar la app
1. Editá `config.js` con tu `SUPABASE_URL` y la `anon public` key.
2. Publicá `index.html` y `config.js` en un hosting estático gratis. Este repositorio usa **GitHub Pages** (Settings → Pages → Deploy from a branch → `main` / root). También sirven Netlify o Cloudflare Pages.
3. Mandale el enlace a franco y elvas. En el celular se puede "Agregar a pantalla de inicio".

## Qué cambió en la app

- **Login** con usuario y contraseña; arriba muestra quién está conectado, "Cambiar contraseña" y "Salir".
- **Precios de MercadoLibre:** cada ficha tiene "Buscar precio en MercadoLibre" y muestra *desde $X · mediana $Y (N publicaciones nuevas/usadas)*, con enlace a la más barata y el botón "Usar mediana". Arriba está "Buscar precios en MercadoLibre" para todas las piezas a la vez (salta las que ya se buscaron en la última semana). Cuando la IA identifica una pieza nueva, busca el precio sola. La búsqueda la hace la IA en publicaciones reales de MercadoLibre (tarda unos segundos por repuesto); en el lote, si la IA está ocupada, espera un minuto y sigue sola.
- **Estimar precios faltantes** ahora le pasa a la IA los precios reales de MercadoLibre de cada pieza, no solo los que cargaste a mano.
- **Excel** suma columnas *ML mínimo*, *ML mediana*, *Publicaciones ML* y *Enlace ML*.
- **Videos:** ahora se guardan enteros hasta 50 MB, incluidos los .mov de iPhone (el .mov se ve bien en iPhone y Safari; en algunos Android puede no reproducirse, pero los cuadros quedan siempre como fotos).
- Todo lo demás sigue igual: repetidos, filtros, copiar listado, visor de fotos, Google Lens.

## Costos aproximados
- Supabase: plan gratis (500 MB de base, 1 GB de fotos). Ojo: un proyecto gratis se pausa si pasa una semana sin uso; se reactiva desde el panel.
- Anthropic: se paga por uso, con el crédito que cargás en <https://platform.claude.com>. Identificar una foto cuesta centavos de dólar, y buscar el precio de un repuesto en MercadoLibre también (búsqueda web más tokens).
- El hosting: gratis.

## Si algo falla
- **"Usuario o contraseña incorrectos":** revisá que el `DOMINIO_USUARIOS` de `config.js` sea el mismo que usó `crear-usuarios.mjs`.
- **"Se terminó el crédito de Claude":** cargá saldo en <https://platform.claude.com> → Billing.
- **"La IA está ocupada":** las cuentas nuevas de Anthropic tienen un límite de uso por minuto. Esperá un rato; la búsqueda en lote espera y reintenta sola.
- **La IA dice "No se pudo identificar":** revisá en Supabase → Edge Functions → ia → Logs; casi siempre es la `ANTHROPIC_API_KEY` mal cargada o sin saldo.
