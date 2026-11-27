# jec-chat v0.1 — alcance y contrato

Se instala sobre el Herdr base, sin sustituir el layout, la barra de tabs ni el mod `agents`.

## Flujo

1. Seleccionar una terminal Codex local.
2. Paleta de comandos → **JEC Chat: ver conversacion de Codex**.
3. El mod congela la identidad de la terminal, y toma su `cwd` y máquina del modelo Herdr.
4. El lector Node local busca `session_meta.payload.cwd` en los rollout de Codex.
5. Una o varias coincidencias: selector explícito. Nunca se deduce la sesión activa solo por la carpeta. Ninguna: aviso.
6. Renderiza mensajes y herramientas del JSONL con `TextView.markdown`.
7. **← Terminal** cierra el diálogo y muestra el terminal sin detener nada.

## Seguridad y límites

- El lector sólo lee archivos regulares dentro del directorio de sesiones Codex y
  verifica que `session_meta.payload.cwd` coincida con el `cwd` elegido.
- No se envía texto al agente, no se usan claves de API, no se alteran sesiones.
- Incluso con un único Codex encontrado en la carpeta, no puede inferirse con certeza cuál usa la
  terminal actual: el usuario debe seleccionar.
- La detección de Codex depende de los metadatos de programa de Herdr;
  se ofrece búsqueda manual cuando no hay un indicador fiable.
- Limitado a las últimas 80 filas (hasta 12k caracteres por fila) y a sesiones
  JSONL menores de 100 MiB; no muestra imágenes ni outputs completos de herramientas.
- La fase de texto de Codex se respeta (`commentary` vs respuesta final).
- No está todavía implementado: control RPC, remotos, otra clase de agente,
  vista embebida que sustituya físicamente al pane de terminal, ni aprobaciones.
- Requiere Node.js en el PATH de la aplicación Herdr y no en uno exclusivo de la terminal.
- Sin pruebas E2E con la GUI: verificar en Windows real y con Herdr instalado.
- Instalar con `install.ps1` o copiar `mods/jec-chat` a `~/.config/herdr-app/mods/jec-chat`
  y correr `herdr-app check`.

## Referencias

- https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md
- https://github.com/ryanrozich/herdr-agent-threads
- https://github.com/ChmaraX/herdr-chat
