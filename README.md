# herdr-jec

Mods propios para [Herdr Desktop](https://github.com/herdrdev/herdr-app), partiendo del layout original.

## jec-chat v0.1 (Codex, vista de solo lectura)

Abre el historial nativo de una sesion Codex en un dialogo **dentro de Herdr**. El terminal original y su proceso no se reemplazan ni se reinician. Cerrando el dialogo se vuelve al terminal. No usa API keys ni inicia servidores.

- Windows 10/11, Linux y macOS (requiere Node.js >= 20 y Herdr Desktop).
- Lee `~/.codex/sessions/**/rollout-*.jsonl` o `$CODEX_HOME/sessions`.
- Exige **elegir explícitamente** la sesión de la carpeta, incluso si hay una sola coincidencia: el directorio no prueba qué sesión controla la terminal.
- Refresca la conversacion cada 4 segundos mientras esta abierta.
- Por ahora solo local: maquinas remotas, envio de mensajes y permisos interactivos quedan para siguientes versiones.

### Instalacion en Windows (PowerShell)

Clona el repo y ejecuta:

```powershell
git clone https://github.com/javijec/herdr-jec.git
cd herdr-jec
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

En Herdr selecciona la terminal de **Codex** y abre la paleta de comandos (`Ctrl+Shift+P`). Busca **JEC Chat: ver conversacion de Codex**.

Si el agente no fue reconocido automaticamente, la ventana permite buscar manualmente las sesiones de la carpeta actual. Es importante elegir la sesion correcta.

### Desarrollo

```sh
node --test tests/*.test.cjs
node --check mods/jec-chat/providers/codex.cjs
herdr-app check ~/.config/herdr-app/mods/jec-chat
```

En Windows: `herdr-app check "$HOME\.config\herdr-app\mods\jec-chat"`.

**Estado:** implementacion inicial; aun no validada en una instalacion real de Herdr con Codex. Consultar [RECIPE](mods/jec-chat/RECIPE.md) para alcance y decisiones.

Licencia: MIT.
