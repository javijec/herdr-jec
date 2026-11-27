# herdr-jec

Mods propios para [Herdr Desktop](https://github.com/herdrdev/herdr-app), partiendo del layout original.

## jec-chat v0.3 (Codex, detección automática de la sesión activa)

En el layout personal `jec-chat`, las terminales locales de Codex muestran un botón **Chat** en el encabezado. Cambia entre la conversación nativa y **Terminal** en el mismo espacio central, sin cerrar, reiniciar ni reemplazar el agente. El layout `main` y los mods de fábrica permanecen intactos. La ventana anterior del chat aún puede abrirse desde la paleta.

- Windows 10/11, Linux y macOS (requiere Node.js >= 20 y Herdr Desktop).
- Lee `~/.codex/sessions/**/rollout-*.jsonl` o `$CODEX_HOME/sessions`.
- Al abrir **Chat**, identifica automáticamente la sesión cuando puede verificarla contra el contenido visible de **esa terminal Codex** o un `codex resume <UUID>` explícito. Si hay dudas, mantiene el selector manual. **Nunca elige solo por fecha o carpeta.**
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

Si Codex no fue reconocido automáticamente, todavía podés abrir el chat desde la paleta de comandos (`Ctrl+Shift+P`) y buscar manualmente sus sesiones. En cualquier caso, elegí la sesión correcta: compartir una carpeta no demuestra que sea la misma sesión.

### Desarrollo

```sh
node --test tests/*.test.cjs
node --check mods/jec-chat/providers/codex.cjs
herdr-app check ~/.config/herdr-app/mods/jec-chat
```

En Windows: `herdr-app check "$HOME\.config\herdr-app\mods\jec-chat"`.

**Estado:** la interfaz ya fue probada visualmente en Windows con Codex; la identificación automática está probada con fixtures, pero falta validarla en el Codex real de una terminal Herdr. Consultar [RECIPE](mods/jec-chat/RECIPE.md) para alcance y decisiones.

Licencia: MIT.
