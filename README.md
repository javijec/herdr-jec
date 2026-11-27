# herdr-jec

Extensiones pequeñas de Herdr Desktop oficial. Sin fork ni compilación.

## v0.1 — Spaces

Partimos del mod oficial Spaces fijado en [upstream/herdr-app](upstream/herdr-app). Ya incluye agrupación por máquina, plegado, estado de conexión, login, reconexión, worktrees, menús y drag & drop. Conservamos esas funciones sin cambios.

JEC añade únicamente el total de espacios, un contador por máquina, una indicación del equipo activo (también plegado y en modo compacto) y un tooltip con cantidad de pestañas. Los conteos se obtienen de la API de Herdr existente; no hay nuevos timers ni llamadas remotas. En instalaciones con sólo la máquina local se conserva la presentación original sin grupo de máquina.

## v0.2 — Agents

Partimos de Agents oficial. Conservamos sus modos Priority y Grouped by space, pines, árboles, navegación, estados, menús y temporizadores. El encabezado muestra el total de agentes visibles en las fuentes oficiales (incluyendo descendientes vivos no listados por separado), los que necesitan atención y los que trabajan. Se deduplican por dirección; las cuentas de grupos y subagentes permanecen visibles también al desplegarlos. El tooltip desglosa estados. Los subagentes sólo se cuentan si están expuestos por Herdr Core; no se agregan hooks ni adaptadores de agentes.

## v0.3 — Workspace Status

La barra inferior oficial conserva la rama Git, el resumen original de agentes y el acceso a la paleta. Se añade un punto de estado del layout de la máquina activa, su nombre y un acceso directo a la configuración oficial de máquinas. El tooltip informa cuántos layouts están listos. También se muestra el espacio activo y su cantidad de pestañas; el tooltip incluye la carpeta. No se hacen consultas de CPU/RAM ni se interpreta un layout listo como una prueba de conectividad SSH. Sin nuevos procesos, timers ni dependencias.

## v0.4 — Workspace Chrome

El encabezado y pie oficiales conservan el logo, búsqueda, plegado de la barra lateral, Settings con aviso de actualización y Add machine. Se añade Machines como acceso directo a la configuración oficial, con un contador de layouts listos/total y tooltip de estados. En modo compacto permanece el icono y se señala si algún layout está indisponible. Se agregan ayudas para búsqueda y plegado. El pie aumenta 28 px para una fila adicional. No se mide conectividad SSH ni se introduce un panel, proceso o temporizador nuevo.

El layout jec deriva de main con cuatro mods sustituidos: Spaces, Agents, Workspace Status y Workspace Chrome (encabezado y pie); sólo se amplía el pie en 28 px. Los mods y el layout de fábrica no se sobrescriben.

```powershell
git pull
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

Volver a la interfaz original: `herdr-app do layout.switch --name main`.

## Desarrollo

La referencia oficial completa se obtiene opcionalmente con `git submodule update --init --depth 1 upstream/herdr-app`. Ver [inventario](upstream/README.md). Regenerar la extensión con `node scripts/derive-spaces.cjs`; verificar con `node scripts/derive-spaces.cjs --check`. Para Agents usar también `node scripts/derive-agents.cjs --check` (o sin `--check` para regenerar). Para Workspace Status usar `node scripts/derive-workspace-status.cjs --check` (o sin `--check` para regenerar). Para Workspace Chrome usar `node scripts/derive-workspace-chrome.cjs --check` (o sin `--check` para regenerar). Ejecutar pruebas locales con `node --test`. No se ejecuta CI automáticamente.

No se instala ningún otro mod JEC fuera de Spaces, Agents, Workspace Status y Workspace Chrome. El trabajo anterior de Chat y Machines permanece únicamente en el historial. `restore-official.ps1` retira los mods propios conservando respaldos.
