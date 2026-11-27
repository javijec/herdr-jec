# herdr-jec

Mods propios para [Herdr Desktop](https://github.com/herdrdev/herdr-app), partiendo del layout original.

## jec-chat v0.11 (Pi / Gentle Shell experimental)

La v0.10 mantiene el adaptador común y añade recuperación automática de registro OpenCode, invalidación de acciones al cambiar la generación o el archivo de sesión, y envío habilitado sólo cuando OpenCode y Herdr confirman que está listo. Los borradores siguen en memoria por conversación; no se añade almacenamiento persistente.

En el layout personal `jec-chat`, las terminales locales de Codex muestran un botón **Chat** en el encabezado. Cambia entre la conversación nativa y **Terminal** en el mismo espacio central, sin cerrar, reiniciar ni reemplazar el agente. El layout `main` y los mods de fábrica permanecen intactos. **La vista Chat conserva el marco, el icono, la ruta y el encabezado de 30 px de Herdr**; los botones de sesión y actualización quedan dentro de una fila secundaria compacta. La ventana anterior del chat aún puede abrirse desde la paleta.

- Windows 10/11, Linux y macOS (requiere Node.js >= 20 y Herdr Desktop).
- Lee `~/.codex/sessions/**/rollout-*.jsonl` o `$CODEX_HOME/sessions`.
- Con los hooks autorizados, Codex registra directamente el UUID y la ruta del JSONL en la etiqueta `jec.chat.codex` de su terminal Herdr. Chat abre ese archivo sin recorrer sesiones ni comparar texto.
- Para sesiones antiguas o sin hooks activos, se conserva el detector anterior (respuesta visible o UUID explícito) y el selector manual.
- Actualización adaptativa: alrededor de 1 s durante actividad y 2–3 s en reposo, sólo con Chat visible; no fuerza el scroll cuando no cambió el historial.
- Composer nativo de varias líneas, con borradores en memoria separados por terminal y UUID. **Enviar** usa `hc send --if idle` cuando el agente está idle y `hc send` sin `--force` cuando está done; requiere registro directo y no inicia otro Codex.
- Los prompts enviados y respuestas aparecen cuando Codex escribe el JSONL. El botón Enviar no está disponible mientras trabaja o espera permisos. Detener interrumpe el turno mediante `hc interrupt`, sin cerrar Codex. Si está bloqueado, Ver solicitud muestra la pantalla original y Resolver en Terminal vuelve a la TUI.
- Por ahora solo local: máquinas remotas y aprobaciones interactivas quedan para siguientes versiones.

### Proveedores de agentes

La vista compartida usa el contrato de `mods/jec-chat/providers/index.js` para identificar la sesión, leer el historial, enviar, detener y mostrar diálogos. La detección de programa es independiente de la habilitación del proveedor. La identidad incluye máquina, terminal, proveedor y sesión.

| Agente | Estado de v0.11 |
| --- | --- |
| Codex local | Proveedor activo, conserva el comportamiento validado de v0.7 |
| OpenCode 2.x | Proveedor local probado por el usuario; registro de la TUI activa e interacción vía hc |
| Pi / Gentle Shell | Proveedor local experimental; extensión de sesión interactiva |
| Máquinas remotas | Identidad y capacidades contempladas, lectura/envío deshabilitados |

El instalador incorpora un plugin local de OpenCode v2, sin modificar sus archivos de configuración ni los hooks de Codex. No se habilitan acciones sobre agentes sin una sesión registrada. El punto de recuperación de la versión validada es la rama `stable/v0.7`.

### Pi / Gentle Shell (local, experimental)

El instalador copia la extensión `integrations/pi/jec-chat.ts` al directorio de extensiones de Pi (por defecto `~/.pi/agent/extensions`) y al home aislado de Gentle Shell si existe (`~/.gentle-shell/agent/extensions` por defecto). Respeta PI_CODING_AGENT_DIR, GENTLE_PI_AGENT_HOME y GENTLE_SHELL_HOME; para otros homes se puede ejecutar `install.ps1 -PiAgentHome <ruta-al-agent-home>`. Usá `-SkipPiExtension` para omitirla.

1. Reiniciá Pi/Gentle Shell desde Herdr (o /reload si ya heredó HC_TERMINAL_ID).
2. Abrí Chat en su pane. Debe indicar registro Pi.
3. Probá enviar un mensaje, volver a Terminal, cambiar de sesión con /new o /resume y comprobar que no se mezcla el historial.

La extensión usa la API de Pi (session_start/session_shutdown, getSessionId, getBranch, isIdle) para publicar las últimas 80 filas de la rama activa, en `data/jec-chat-pi/<terminal>.json`. No lee otras sesiones ni exporta razonamiento, argumentos, resultados completos o imágenes. Sólo se publican mensajes ya registrados en la rama; el streaming por token queda pendiente. El archivo local caduca a los 6,5 s y se elimina en el cierre normal. Sólo se registra la TUI interactiva, no procesos print/RPC.

Enviar y detener usan hc, con comprobación del ID, generación, estado de Pi y de Herdr; sin force ni reintentos. Los diálogos de permisos se resuelven en Terminal. No hay garantía atómica entre comprobar y ejecutar hc ni detección de todos los menús modales de Pi: cerrá cualquier menú antes de enviar. Pendiente validar en Pi/Gentle Shell reales. No incluye agentes remotos.

Referencias: [Pi extensions](https://docs.pi.dev/latest/extensions), [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell).

### OpenCode v2 (local)

1. Instalá el mod con el mismo `install.ps1` (o `-SkipOpenCodePlugin` para omitir el plugin de OpenCode).
2. Cerrá y volvé a abrir OpenCode **desde Herdr** para que herede `HC_TERMINAL_ID`. El plugin se instala en `~/.config/opencode/plugins/jec-chat-opencode/tui.ts` (o el directorio de configuración personalizado).
3. Si OpenCode solicita autorización, revisá `/plugins` y habilitá únicamente `jec-chat-opencode`. Necesita un OpenCode v2 con la API de TUI plugins y su host TypeScript/Bun habilitado.
4. Abrí una conversación principal (en la pantalla de inicio o en una vista de subagente no se registra una conversación). Luego pulsá Chat en Herdr. Debe mostrar `registro OpenCode`.
5. Para enviar mensajes, el core de Herdr debe reportar `idle` o `done` y la API de OpenCode debe reportar que esa sesión está idle. Si no aparece ese estado, revisá el indicador de agente de Herdr; no se fuerza el envío.

El plugin publica únicamente la sesión visible en la TUI, con un snapshot local acotado a las últimas 80 filas en `~/.config/herdr-app/data/jec-chat-opencode/<terminal>.json`. Contiene texto visible, ID y estado; excluye razonamiento, inputs/outputs de herramientas, adjuntos y metadatos. Se reemplaza aproximadamente cada segundo, se elimina al desactivar el plugin en forma normal y deja de ser válido después de 6,5 s sin actualizaciones. Un cierre abrupto puede dejar el archivo vencido en disco; se puede eliminar manualmente. No se expone un puerto, no se abre otro agente ni se lee una base de datos por fecha.

**Validación:** el usuario confirmó que Chat funciona en OpenCode. Las pruebas de regresión de v0.10 y la validación detallada de envío, interrupción y recuperación en la GUI real son independientes. No se promete compatibilidad con OpenCode 1.x ni con remotos en esta versión.

### Instalacion en Windows (PowerShell)

Clona el repo y ejecuta:

```powershell
git clone https://github.com/javijec/herdr-jec.git
cd herdr-jec
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

El instalador intenta activar el layout `jec-chat`. Si no lo consigue, ejecutá `herdr-app do layout.switch --name jec-chat` o elegilo con `Ctrl+Shift+L` en Herdr. Seleccioná una terminal **Codex** y pulsá **Chat** en su encabezado. Si detecta con seguridad la conversación abierta, se muestra directamente; de lo contrario, pedirá elegirla. El botón **Terminal** vuelve al terminal original sin reiniciar el agente.

### Activar el registro directo (validado en Codex 0.172.0 / Windows)

El instalador agrega los hooks `SessionStart`, `UserPromptSubmit`, `Stop` y `SessionEnd` a `$CODEX_HOME/hooks.json` (por defecto `~/.codex/hooks.json`), preservando los existentes y guardando una copia de seguridad si el archivo ya existía. Podés usar `-SkipCodexHooks` para instalar solo el mod.

1. Abrí Codex dentro de Herdr. Si estaba abierto antes de instalar, salí normalmente y reanudá la misma sesión. Usá el lanzador de Herdr o `codex --no-daemon resume` para elegirla.
2. Ejecutá `/hooks` y revisá/autoriza únicamente los hooks JEC cuyo comando ejecuta `session-hook.cjs`. El instalador no cambia las decisiones de confianza. Es posible que tengas que reanudar nuevamente para que se ejecute SessionStart.
3. Enviá un mensaje y esperá la respuesta. El hook Stop también registra el JSONL si todavía no existía al inicio.
4. Verificá con `hc get <terminal> --json`: `labels["jec.chat.codex"]` debe contener el UUID y el archivo. Chat mostrará `registro Codex`.

El hook necesita Node.js, `hc` accesible desde su entorno y `HC_TERMINAL_ID` heredado del terminal. No uses un daemon Codex compartido entre terminales: puede heredar la identidad de otra terminal. La instalación del mod no altera el comando de lanzamiento de Herdr. No se guardan prompts en la etiqueta.

Si Codex no fue reconocido automáticamente, todavía podés abrir el chat desde la paleta de comandos (`Ctrl+Shift+P`) y buscar manualmente sus sesiones. En cualquier caso, elegí la sesión correcta: compartir una carpeta no demuestra que sea la misma sesión.

### Enviar mensajes desde Chat

Con `registro Codex` visible y el agente en estado idle o done, escribí un mensaje y pulsá **Enviar**. Enter envía y Shift+Enter agrega una línea en las versiones de Herdr que exponen los modificadores del evento submit. El botón Enviar siempre queda como alternativa. No uses el composer para comandos slash, comandos del shell ni solicitudes de permisos: volvé a **Terminal** para eso. Si el envío falla, el texto se conserva y no se reintenta automáticamente; comprobá la TUI antes de reenviar. El envío exige una versión de Herdr Core con `hc send --if idle` (ver `hc send --help`).

Al actualizar desde la v0.5 ya funcional no es necesario reautorizar hooks si el instalador no modifica sus comandos.

### Desarrollo

```sh
node --test tests/*.test.cjs
node --check mods/jec-chat/providers/codex.cjs
herdr-app check ~/.config/herdr-app/mods/jec-chat
```

En Windows: `herdr-app check "$HOME\.config\herdr-app\mods\jec-chat"`.

**Estado:** alternancia y registro directo verificados por el usuario en Windows con Codex 0.172.0. El envío de v0.6 fue validado por el usuario en Windows. La v0.7 añade pruebas unitarias de interrupción y lectura del diálogo; resta validar los atajos y las acciones en la GUI real. Consultar [RECIPE](mods/jec-chat/RECIPE.md) para alcance y decisiones.

Licencia: MIT.
