# jec-chat v0.9 — alcance y contrato

Se instala sobre el Herdr base. Conserva intactos el layout original `main`, la barra de tabs y el mod `agents`; agrega el layout personal `jec-chat` con un stack central para Chat/Terminal y el encabezado `jec-pane`.

## Arquitectura de proveedores (v0.8)

`provider-catalog.js` contiene los identificadores reconocidos, sus alias y las capacidades de local/remoto. Se mantiene una copia idéntica en ambos mods para evitar importar módulos fuera del directorio propio; CI comprueba que no diverjan. Los nombres editables de la terminal no determinan el agente.

`session.js` resuelve `{terminal, pane, cwd, machine, providerId}` desde el pane y la terminal reales. Los borradores se indexan por máquina, terminal, proveedor y sesión. Una dirección remota nunca se trata como local.

`providers/index.js` es el punto de selección del adaptador. Cada proveedor ofrece:

| Operación | Contrato |
| --- | --- |
| `identify(target)` | Registro de sesión activo, historial y estado; o pendiente/null |
| `list(target)`, `match(target, sessions)` | Descubrimiento opcional y sólo lectura |
| `read(target, session)` | Historial normalizado: messages, total, truncated |
| `status(record)` | Estado del agente |
| `send(target, session, text, stillCurrent)` | Envío explícito con revalidación |
| `interrupt(target, session, stillCurrent)` | Interrupción suave |
| `blockedPreview(target, session)` | Vista previa de un diálogo, sin responderlo |

Las capacidades `history`, `discovery`, `send`, `interrupt`, `blockedPreview`, `approval` y `remote` controlan la exposición de acciones. La vista no importa implementaciones concretas. El adaptador Codex delega a los métodos de v0.7, conservando hooks, registro, historial y acciones. El selector manual de Codex queda disponible sólo para un agente no identificado y local; no se usa como fallback para un agente reconocido diferente.

OpenCode v2 tiene un proveedor local experimental activo. Pi/Gentle Shell sigue reconocido sin adaptador. Remotos y aprobaciones estructuradas todavía no están habilitados. Para incorporar un agente, primero implementar y probar su registro de identidad y lector, luego registrar el adaptador y habilitar sus capacidades. No reutilizar el lector ni la identidad de Codex.

La rama `stable/v0.7` preserva el estado validado antes de la refactorización.

## OpenCode (v0.9)

El plugin cliente `integrations/opencode/tui.ts` usa el contrato público v2 `context.ui.router.current()`, `context.data.session.get`, `message.list`, `status`, `permission.list` y `form.list`. Sólo captura la conversación principal visible, no otros eventos globales ni sesiones de la misma carpeta. Publica un archivo por `HC_TERMINAL_ID` en el directorio local de Herdr, con un identificador de generación y lease de 6,5 s. La publicación se hace por reemplazo de archivo, aproximadamente cada segundo. Si cambia la ruta a home, subagente o pantalla sin sesión, publica un estado pendiente sin historial.

El adaptador `providers/opencode.js` verifica estado live, dirección local, versión del snapshot, frescura, generación e identificador de sesión. Antes de enviar, interrumpir o previsualizar el diálogo, vuelve a leer el snapshot y compara su identidad. El envío requiere estado idle de OpenCode e idle/done del core; se usa hc send sin force y la protección nativa contra blocked. La comprobación y envío no son atómicos respecto a cambios concurrentes de ruta, especialmente en done donde no existe --if done. No reintenta automáticamente. Detener exige que ambos informen working. El diálogo es una vista previa sin teclas de aprobación.

El adaptador declara discovery=false: no hay selector manual ni búsqueda de sesiones. La vista espera el registro activo y se actualiza automáticamente. La identidad se pierde si el plugin deja de publicar. El historial es una copia efímera de texto visible, no se escribe a la base de datos de OpenCode; el plugin limpia su archivo en una desactivación normal, y los archivos vencidos tras un cierre abrupto no se usan.

Referencias oficiales: [contrato de plugins](https://github.com/anomalyco/opencode/blob/dev/packages/cli-rs/docs/plugins.md), [contexto TUI](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/tui/context.ts), [esquema de mensajes](https://github.com/anomalyco/opencode/blob/dev/packages/schema/src/session-message.ts).

## Flujo

1. Activar el layout `jec-chat` (el instalador intenta hacerlo).
2. Seleccionar una terminal Codex local; el encabezado `jec-pane` ofrece el botón **Chat**.
3. Chat y Terminal son bloques de un `stack` del layout, así que el mismo terminal sigue funcionando. La selección se vincula al pane y su dirección exacta; al cambiar de tab, el chat no muestra datos de la pestaña anterior.
4. Consulta `hc get <terminal> --json`. Si existe `jec.chat.codex`, valida UUID, ruta canónica dentro de sessions y cwd; abre solo ese archivo. Si todavía no hay JSONL, espera a que el hook publique la ruta.
5. Sin registro, conserva el mecanismo anterior: búsqueda por cwd y comparación con `hc read <terminal> --lines 80` o UUID explícito. Si hay ambigüedad, aparece el selector.
6. Renderiza mensajes y herramientas del JSONL con `TextView.markdown`.
7. **Terminal** cambia al bloque original `main` sin detener nada; la sesión seleccionada se conserva al alternar. La paleta sigue abriendo la ventana de chat anterior en el layout base.

## Registro directo

Los hooks de Codex (registro validado en 0.172.0 en Windows) reciben `session_id`, `transcript_path` y `cwd`. El script `session-hook.cjs` lee el JSON por stdin y usa `HC_TERMINAL_ID` y `hc label` para vincular el thread raíz con la terminal. `SessionStart` registra el UUID, `UserPromptSubmit` y `Stop` actualizan la ruta, `SessionEnd` borra el registro si sigue correspondiendo al mismo UUID. No se guardan prompts ni respuestas. No hay base de datos adicional. Los errores no bloquean al agente.

`install-hooks.cjs` agrega los hooks preservando los existentes; crea backup antes de reemplazar el archivo, verifica que el original no cambió durante la escritura y no duplica entradas idénticas. La aprobación se hace en `/hooks`. El funcionamiento depende de la herencia de `HC_TERMINAL_ID` y del acceso a `hc` desde el hook. Usar Codex con `--no-daemon` para evitar que el servidor compartido registre otra terminal.

Si la etiqueta cambia con /new o /resume, la lectura periódica abre el nuevo archivo sin recorrer el historial. El selector manual es una salida de emergencia, no una fuente de identidad.

## Chat interactivo

- El composer usa `TextareaState` y `Textarea` nativos. Enter envía y Shift+Enter agrega líneas si el evento submit de Herdr expone los modificadores; el botón Enviar siempre funciona como alternativa.
- El proveedor valida el texto, exige una sesión registrada, consulta `hc get` para comparar el UUID y la ruta del archivo y verifica que la terminal esté live y Codex esté idle o done. Luego comprueba que el panel no cambió y usa `hc send --if idle --json -- <terminal> <texto>` si está idle, o `hc send --json -- <terminal> <texto>` si está done. Herdr no admite `--if done`: en este segundo caso la comprobación del estado no es atómica con el envío, pero el core sigue rechazando blocked sin --force. No usa --force ni crea otro proceso de Codex.
- No se reenvía automáticamente ante errores. Se conserva el borrador en memoria y se limpia únicamente después de una respuesta de envío exitosa; los mensajes del historial vienen exclusivamente del JSONL. Los borradores se mantienen separados por terminal y UUID durante la vida de la vista.
- Si Codex está trabajando o bloqueado, se permite preparar un borrador pero no enviarlo. Se usa Terminal para permisos, comandos slash y comandos shell. El picker de sesiones antiguas sigue siendo sólo lectura.
- Para el estado idle se requiere `hc send --if idle`; si el core no lo admite, falla sin enviar. Se requiere validación real de la GUI.

## Actividad, interrupción y diálogos (v0.7)

- Refresco cada ~1 s cuando Codex trabaja, espera el historial o hay diálogo bloqueado; en reposo cada ~2–3 s. No se ejecutan lecturas concurrentes y no se refresca en vistas ocultas. Se conserva el historial original de Codex.
- El aviso de envío se limpia cuando el historial avanza o Codex informa que está trabajando/bloqueado; no se inventa una respuesta.
- Detener verifica la identidad registrada y el estado working antes de ejecutar `hc interrupt`. El comando nativo no mata el agente. No hay garantía atómica de que el turno no cambie entre la comprobación y la acción.
- Si el estado es blocked, Ver solicitud lee únicamente la pantalla actual con `hc read --lines 0` y vuelve a verificar el UUID y estado. La captura es informativa; no representa una aprobación estructurada. Resolver en Terminal abre la misma TUI. No se inyectan teclas para aprobar/rechazar permisos ni se modifica la política del agente.
- No se añaden hooks ni se cambian autorizaciones.

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
- No se usan claves de API ni se editan archivos JSONL. Los mensajes se envían explícitamente mediante hc al agente activo; no se fuerzan permisos.
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
