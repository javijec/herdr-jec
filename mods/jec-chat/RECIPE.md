# jec-chat v0.5 — alcance y contrato

Se instala sobre el Herdr base. Conserva intactos el layout original `main`, la barra de tabs y el mod `agents`; agrega el layout personal `jec-chat` con un stack central para Chat/Terminal y el encabezado `jec-pane`.

## Flujo

1. Activar el layout `jec-chat` (el instalador intenta hacerlo).
2. Seleccionar una terminal Codex local; el encabezado `jec-pane` ofrece el botón **Chat**.
3. Chat y Terminal son bloques de un `stack` del layout, así que el mismo terminal sigue funcionando. La selección se vincula al pane y su dirección exacta; al cambiar de tab, el chat no muestra datos de la pestaña anterior.
4. Consulta `hc get <terminal> --json`. Si existe `jec.chat.codex`, valida UUID, ruta canónica dentro de sessions y cwd; abre solo ese archivo. Si todavía no hay JSONL, espera a que el hook publique la ruta.
5. Sin registro, conserva el mecanismo anterior: búsqueda por cwd y comparación con `hc read <terminal> --lines 80` o UUID explícito. Si hay ambigüedad, aparece el selector.
6. Renderiza mensajes y herramientas del JSONL con `TextView.markdown`.
7. **Terminal** cambia al bloque original `main` sin detener nada; la sesión seleccionada se conserva al alternar. La paleta sigue abriendo la ventana de chat anterior en el layout base.

## Registro directo

Los hooks de Codex 0.170.0 reciben `session_id`, `transcript_path` y `cwd`. El script `session-hook.cjs` lee el JSON por stdin y usa `HC_TERMINAL_ID` y `hc label` para vincular el thread raíz con la terminal. `SessionStart` registra el UUID, `UserPromptSubmit` y `Stop` actualizan la ruta, `SessionEnd` borra el registro si sigue correspondiendo al mismo UUID. No se guardan prompts ni respuestas. No hay base de datos adicional. Los errores no bloquean al agente.

`install-hooks.cjs` agrega los hooks preservando los existentes; crea backup antes de reemplazar el archivo, verifica que el original no cambió durante la escritura y no duplica entradas idénticas. La aprobación se hace en `/hooks`. El funcionamiento depende de la herencia de `HC_TERMINAL_ID` y del acceso a `hc` desde el hook. Usar Codex con `--no-daemon` para evitar que el servidor compartido registre otra terminal.

Si la etiqueta cambia con /new o /resume, la lectura periódica abre el nuevo archivo sin recorrer el historial. El selector manual es una salida de emergencia, no una fuente de identidad.

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
