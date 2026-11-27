# herdr-jec

Mods propios para [Herdr Desktop](https://github.com/herdrdev/herdr-app), partiendo del layout original.

## jec-chat v0.5 (registro directo de sesiones Codex)

En el layout personal `jec-chat`, las terminales locales de Codex muestran un botón **Chat** en el encabezado. Cambia entre la conversación nativa y **Terminal** en el mismo espacio central, sin cerrar, reiniciar ni reemplazar el agente. El layout `main` y los mods de fábrica permanecen intactos. **La vista Chat conserva el marco, el icono, la ruta y el encabezado de 30 px de Herdr**; los botones de sesión y actualización quedan dentro de una fila secundaria compacta. La ventana anterior del chat aún puede abrirse desde la paleta.

- Windows 10/11, Linux y macOS (requiere Node.js >= 20 y Herdr Desktop).
- Lee `~/.codex/sessions/**/rollout-*.jsonl` o `$CODEX_HOME/sessions`.
- Con los hooks autorizados, Codex registra directamente el UUID y la ruta del JSONL en la etiqueta `jec.chat.codex` de su terminal Herdr. Chat abre ese archivo sin recorrer sesiones ni comparar texto.
- Para sesiones antiguas o sin hooks activos, se conserva el detector anterior (respuesta visible o UUID explícito) y el selector manual.
- Refresca la conversacion cada 4 segundos mientras esta abierta.
- Por ahora solo local: máquinas remotas, envío de mensajes y permisos interactivos quedan para siguientes versiones.

### Instalacion en Windows (PowerShell)

Clona el repo y ejecuta:

```powershell
git clone https://github.com/javijec/herdr-jec.git
cd herdr-jec
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

El instalador intenta activar el layout `jec-chat`. Si no lo consigue, ejecutá `herdr-app do layout.switch --name jec-chat` o elegilo con `Ctrl+Shift+L` en Herdr. Seleccioná una terminal **Codex** y pulsá **Chat** en su encabezado. Si detecta con seguridad la conversación abierta, se muestra directamente; de lo contrario, pedirá elegirla. El botón **Terminal** vuelve al terminal original sin reiniciar el agente.

### Activar el registro directo (Codex 0.170.0)

El instalador agrega los hooks `SessionStart`, `UserPromptSubmit`, `Stop` y `SessionEnd` a `$CODEX_HOME/hooks.json` (por defecto `~/.codex/hooks.json`), preservando los existentes y guardando una copia de seguridad si el archivo ya existía. Podés usar `-SkipCodexHooks` para instalar solo el mod.

1. Abrí Codex dentro de Herdr. Si estaba abierto antes de instalar, salí normalmente y reanudá la misma sesión. Usá el lanzador de Herdr o `codex --no-daemon resume` para elegirla.
2. Ejecutá `/hooks` y revisá/autoriza únicamente los hooks JEC cuyo comando ejecuta `session-hook.cjs`. El instalador no cambia las decisiones de confianza. Es posible que tengas que reanudar nuevamente para que se ejecute SessionStart.
3. Enviá un mensaje y esperá la respuesta. El hook Stop también registra el JSONL si todavía no existía al inicio.
4. Verificá con `hc get <terminal> --json`: `labels["jec.chat.codex"]` debe contener el UUID y el archivo. Chat mostrará `registro Codex`.

El hook necesita Node.js, `hc` accesible desde su entorno y `HC_TERMINAL_ID` heredado del terminal. No uses un daemon Codex compartido entre terminales: puede heredar la identidad de otra terminal. La instalación del mod no altera el comando de lanzamiento de Herdr. No se guardan prompts en la etiqueta.

Si Codex no fue reconocido automáticamente, todavía podés abrir el chat desde la paleta de comandos (`Ctrl+Shift+P`) y buscar manualmente sus sesiones. En cualquier caso, elegí la sesión correcta: compartir una carpeta no demuestra que sea la misma sesión.

### Desarrollo

```sh
node --test tests/*.test.cjs
node --check mods/jec-chat/providers/codex.cjs
herdr-app check ~/.config/herdr-app/mods/jec-chat
```

En Windows: `herdr-app check "$HOME\.config\herdr-app\mods\jec-chat"`.

**Estado:** alternancia y detección por pantalla verificadas en Windows. El registro de hooks y lectura directa tienen pruebas automatizadas, pero necesitan validación en Codex/Herdr reales. Consultar [RECIPE](mods/jec-chat/RECIPE.md) para alcance y decisiones.

Licencia: MIT.
