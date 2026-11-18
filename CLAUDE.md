# Inventario de Repuestos

App para clasificar y vender un lote de repuestos de moto recibido como forma de pago. El socio del dueño tiene las piezas y sube fotos o videos; la app identifica cada pieza con IA, estima precio y arma el listado de venta. Todo el texto de la interfaz va en español rioplatense.

## Estado actual (18/11/2026)

La app se sacó de la plataforma de artefactos de Claude. Ahora:

- `index.html` + `config.js` (raíz del repo, publicados con GitHub Pages en https://luchassgonzalez-afk.github.io/inventario-repuestos/): frontend estático (sin build). Usa `@supabase/supabase-js@2.45.4` por CDN. Unos adaptadores (`makeCol`, `assetsApi`, `sample`, `downloadsApi`) imitan la API vieja de `claude.use(...)`, así el resto del código casi no cambió.
- Supabase: tabla `repuestos(id text, data jsonb, creado bigint)`; los cambios parciales van por la RPC `patch_repuesto` (`data || patch`). Realtime activado. Bucket público `repuestos` (lectura pública, escritura solo con sesión, 50 MB por archivo). La tabla `ml_token` (de la migración 002) ya no se usa.
- Edge Functions (usan `npm:@anthropic-ai/sdk@1.4.0`, API `2026-10-21`, cliente común en `_shared/claude.ts`, modelo `ANTHROPIC_MODEL` o `claude-sonnet-5-5`): `ia` (recibe `{prompt, fotos:[ids]}` y baja las fotos del bucket) y `precios-ml`. MercadoLibre dejó de dar de alta apps nuevas en nov. 2026 (el formulario de pedido está cerrado), así que `precios-ml` no usa su API: Claude busca con `web_search_20260209` limitado a `mercadolibre.com.ar` (hasta 3 búsquedas, US$ 0,01 cada una) y devuelve un JSON de publicaciones; la función calcula `ml:{q,n,total,min,mediana,enlace,titulo,condicion,listado,fecha,fuente:"ia"}`. Errores para la app: `rate_limited`, `ia_tardo`, `ia_sin_credito`, `ia_clave`, `sampling_disabled`. La vieja `ml-auth` (OAuth de MercadoLibre) sigue publicada en Supabase pero no se usa; su código quedó en el historial de git.
- Login: usuarios `lucas`, `franco`, `elvas` como `<usuario>@<DOMINIO_USUARIOS>` (hoy `avanor.com`, que es como lucas los creó en el panel el 16/11/2026; también se puede escribir el mail completo). `user_metadata.cambiar_clave=true` obliga a cambiar la contraseña al primer ingreso. Registro público desactivado.
- `README.md` tiene la guía de instalación. Los datos exportados del artefacto (`migracion/datos/`, 41 piezas y 44 fotos) NO van al repo público; se importan desde la app con `#importar` o con `scripts/migrar.mjs`.
- Proyecto Supabase: ref `mrcxsjdymnlfbwqdycmt`. Las funciones se suben por el editor del panel en un solo archivo cada una (con `_shared/comun.ts` y `_shared/claude.ts` pegados adentro), con "Verify JWT" apagado.

Artefacto viejo (solo referencia): https://claude.ai/artifact/SNE1aPn7NG8uDEjdiQ4BK8

## Documento `repuestos/<id>` (campo `data`)

`pieza, categoria, marca, compat, codigo, estado, cantidad, cantidadManual, precio, precioEstimado, precioFuente, busqueda, nota, confianza (alta|media|baja), comentario, ia (pendiente|listo|error), foto, fotos[], minis[] (miniaturas data-URL), video, origen (foto|video), fileHash, phashes[], ml{...}, creado, autor`

## Pendiente / límites conocidos

- Los precios de MercadoLibre salen de lo que indexa la búsqueda web: pueden estar unos días atrasados y traen menos publicaciones que la API oficial. Si MercadoLibre vuelve a dar de alta apps, se puede volver a la API (ver el historial de `precios-ml`).
- Búsqueda por imagen (tipo Google Lens) sigue sin hacer; se podría sumar una API de búsqueda visual en otra función.
