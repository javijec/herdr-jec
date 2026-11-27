# jec-chat v0.4 — alcance y contrato

Se instala sobre el Herdr base. Conserva intactos el layout original `main`, la barra de tabs y el mod `agents`; agrega el layout personal `jec-chat` con un stack central para Chat/Terminal y el encabezado `jec-pane`.

## Flujo

1. Activar el layout `jec-chat` (el instalador intenta hacerlo).
2. Seleccionar una terminal Codex local; el encabezado `jec-pane` ofrece el botón **Chat**.
3. Chat y Terminal son bloques de un `stack` del layout, así que el mismo terminal sigue funcionando. La selección se vincula al pane y su dirección exacta; al cambiar de tab, el chat no muestra datos de la pestaña anterior.
4. El lector Node local busca `session_meta.payload.cwd` en los rollout de Codex.
5. Al abrir Chat, consulta `hc get --json <terminal>` y `hc read <terminal> --lines 80`. Intenta identificar la sesión por UUID explícito en `codex resume <UUID>` o una respuesta distintiva que coincida con la pantalla real. Si hay varias coincidencias o evidencia insuficiente, aparece el selector. Ninguna: aviso.
6. Renderiza mensajes y herramientas del JSONL con `TextView.markdown`.
7. **Terminal** cambia al bloque original `main` sin detener nada; la sesión seleccionada se conserva al alternar. La paleta sigue abriendo la ventana de chat anterior en el layout base.

## Integración visual

- No se cambian los mods originales ni el layout `main`.
- El chat embebido reproduce el marco redondeado, borde, fondo e icono de la terminal de Herdr.
- Su encabezado ocupa 30 px, como el de `jec-pane`, mostrando programa, carpeta y botón **Terminal**.
- **Sesión** y **Actualizar** quedan en la fila de información de conversación, no en una barra de aplicación separada.
- La vista abierta desde la paleta conserva su encabezado de diálogo, separado de la versión embebida.
- La barra de pestañas, el panel Files/Changes, Spaces, Agents y la barra de estado permanecen sin cambios.

## Seguridad y límites

- El lector sólo lee archivos regulares dentro del directorio de sesiones Codex y
  verifica que `session_meta.payload.cwd` coincida con el `cwd` elegido.
- No se envía texto al agente, no se usan claves de API, no se alteran sesiones.
- Ni la fecha de actualización, ni una carpeta compartida, ni la existencia de una sola sesión prueban por sí solas la identidad activa.
- La identificación por pantalla compara hasta 10 sesiones; con más sesiones y sin UUID explícito se utiliza el selector.
- Tras un cambio de la TUI a Chat, se reevalúa la sesión: Codex puede cambiar de conversación con `/new` o `/resume`.
- La detección de Codex depende de los metadatos de programa de Herdr;
  se ofrece búsqueda manual cuando no hay un indicador fiable.
- Limitado a las últimas 80 filas (hasta 12k caracteres por fila) y a sesiones
  JSONL menores de 100 MiB; no muestra imágenes ni outputs completos de herramientas.
- La fase de texto de Codex se respeta (`commentary` vs respuesta final).
- No está todavía implementado: control RPC, remotos, otros agentes, una vista por cada pane de un split complejo, ni aprobaciones.
- El stack es el área central completa del tab activo. No cambia el tipo del pane terminal (ni lo destruye), y sólo ofrece la acción Chat para Codex local.
- Requiere Node.js en el PATH de la aplicación Herdr y no en uno exclusivo de la terminal.
- Sin pruebas E2E con la GUI: verificar en Windows real y con Herdr instalado.
- Instalar con `install.ps1`, que copia `mods/jec-chat`, `mods/jec-pane` y `layouts/jec-chat.json`.
- Correr `herdr-app check` en los dos mods y probar visualmente el layout en Windows.

## Referencias

- https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md
- https://github.com/ryanrozich/herdr-agent-threads
- https://github.com/ChmaraX/herdr-chat
