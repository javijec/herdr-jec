# herdr-jec

Mods sobre Herdr Desktop oficial, sin modificar ni compilar el ejecutable.

## JEC Machines v0.1 (experimental)

Primer paso: una vista nativa de equipos locales/remotos, disponibilidad del layout, espacios, cantidad de pestañas y estados de agentes. Usa las APIs oficiales machines(), spaces(), agents() y space.select. Se abre desde la paleta, sin modificar el sidebar ni el layout. No mide CPU/RAM, no prueba conectividad por SSH, no instala agentes. La disponibilidad es la del layout según Herdr.

```powershell
git pull
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

El instalador desactiva JEC Chat antes de instalar Machines. Abre Ctrl+Shift+P y busca JEC Machines. Para solo desactivar Chat, ejecuta disable-chat.ps1. El desactivador vuelve a main, respalda los archivos de los mods/layouts, retira los hooks específicos de Codex y respalda las integraciones específicas de OpenCode y Pi/Gentle Shell. No mata agentes ni borra sesiones; recarga/reinicia los agentes al terminar el trabajo actual. Usa -PiAgentHome para homes personalizados. Datos históricos/snapshots no se eliminan.

## JEC Chat (archivado)

Desarrollo suspendido. Código conservado en el repositorio; no se instala por defecto. [Documentación histórica](archive/CHAT.md). La rama experimental nativa se mantiene separada.
