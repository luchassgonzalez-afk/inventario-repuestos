# Inventario de Repuestos

App para clasificar y vender un lote de repuestos de moto recibido como forma de pago. El socio del dueño tiene las piezas y sube fotos o videos; la app identifica cada pieza con IA, estima precio y arma el listado de venta. Todo el texto de la interfaz va en español rioplatense.

## Estado actual (15/11/2026)

La app se sacó de la plataforma de artefactos de Claude. Ahora:

- `index.html` + `config.js` (raíz del repo, publicados con GitHub Pages en https://luchassgonzalez-afk.github.io/inventario-repuestos/): frontend estático (sin build). Usa `@supabase/supabase-js@2.45.4` por CDN. Unos adaptadores (`makeCol`, `assetsApi`, `sample`, `downloadsApi`) imitan la API vieja de `claude.use(...)`, así el resto del código casi no cambió.
- Supabase: tabla `repuestos(id text, data jsonb, creado bigint)`; los cambios parciales van por la RPC `patch_repuesto` (`data || patch`). Realtime activado. Bucket público `repuestos` (lectura pública, escritura solo con sesión, 50 MB por archivo). Tabla `ml_token` solo para el servidor.
- Edge Functions: `ia` (Anthropic Messages API, recibe `{prompt, fotos:[ids]}` y baja las fotos del bucket), `precios-ml` (`/sites/MLA/search`, devuelve `ml:{q,n,min,mediana,enlace,titulo,condicion,listado,fecha}`), `ml-auth` (OAuth de MercadoLibre, una vez).
- Login: usuarios `lucas`, `franco`, `elvas` como `<usuario>@<DOMINIO_USUARIOS>` (hoy `avanor.com`, que es como lucas los creó en el panel el 16/11/2026; también se puede escribir el mail completo). `user_metadata.cambiar_clave=true` obliga a cambiar la contraseña al primer ingreso. Registro público desactivado.
- `README.md` tiene la guía de instalación. Los datos exportados del artefacto (`migracion/datos/`, 41 piezas y 44 fotos) NO van al repo público; se importan desde la app con `#importar` o con `scripts/migrar.mjs`.
- Proyecto Supabase: ref `mrcxsjdymnlfbwqdycmt`. Las funciones se subieron por el editor del panel en un solo archivo cada una (sin `_shared`), con "Verify JWT" apagado.

Artefacto viejo (solo referencia): https://claude.ai/artifact/SNE1aPn7NG8uDEjdiQ4BK8

## Documento `repuestos/<id>` (campo `data`)

`pieza, categoria, marca, compat, codigo, estado, cantidad, cantidadManual, precio, precioEstimado, precioFuente, busqueda, nota, confianza (alta|media|baja), comentario, ia (pendiente|listo|error), foto, fotos[], minis[] (miniaturas data-URL), video, origen (foto|video), fileHash, phashes[], ml{...}, creado, autor`

## Pendiente / límites conocidos

- La búsqueda en MercadoLibre no se pudo probar contra la API real desde el entorno de desarrollo (red bloqueada); probar después del paso 6 de la guía.
- Búsqueda por imagen (tipo Google Lens) sigue sin hacer; se podría sumar una API de búsqueda visual en otra función.
