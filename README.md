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

## v0.5 — Integración

Los cuatro mods se instalan juntos por defecto. Agents y Workspace Status cuentan los mismos agentes y descendientes vivos, sin duplicados. La fuente compartida se distribuye en cada mod para mantenerlos independientes y evitar imports entre mods. No se añaden hooks, timers ni procesos en segundo plano.

Instalación selectiva (desde PowerShell con ejecución de scripts habilitada):

```powershell
.\install.ps1 -Mods spaces,agents
```

Sólo los mods seleccionados se usan en el layout jec; el resto vuelve a los componentes oficiales. Los archivos JEC previamente instalados pero no seleccionados pueden permanecer inactivos. El instalador verifica los mods seleccionados antes de cambiar archivos, vuelve a main, crea un respaldo de los destinos existentes y trata de revertir cambios si falla la instalación. Si no puede confirmar main, se detiene y conserva el respaldo. El layout personalizado se regenera desde el perfil de fábrica, no conserva ajustes manuales de tamaño del layout jec.

Restauración completa de los mods actuales (sin Node.js):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\restore-official.ps1
```

La limpieza de Chat antiguo es optativa con `-LegacyChat` (requiere Node.js). No modifica hooks sin esa opción.

Verificación local, sin GitHub Actions:

```powershell
node scripts/verify.cjs
```

Con la referencia oficial materializada, usar `node scripts/verify.cjs --require-upstream` para exigir la comparación exacta de los cuatro mods y el layout con upstream. Tras editar `shared/agent-summary.js`, ejecutar `node scripts/sync-shared.cjs` antes de verificar.

## v0.6 — Métricas de máquina

Workspace Status muestra CPU, RAM, disco del sistema y temperatura de CPU (si hay un sensor identificado) del espacio activo. Usa `exec` oficial con el destino `on` de Herdr. Linux: /proc/stat (muestra de un segundo), MemAvailable, df de / y sensores térmicos identificados. Windows: CIM Win32_Processor, Win32_OperatingSystem y Win32_LogicalDisk del disco del sistema; temperatura no disponible. macOS y otros sistemas todavía no soportados. Las cifras de disco no representan todos los volúmenes. No instala servicios, usa credenciales existentes de Herdr y no añade paneles.

Sólo consulta la máquina activa cuando su layout está listo y la ventana visible y activa. Una consulta a la vez, cada 15 segundos tras un resultado; reintento de fallos tras 60 segundos. El timer comprueba cada 5 segundos, sin trabajo en herdr-app check. No muestra datos antiguos tras 45 segundos; la temperatura no disponible se omite y el tooltip explica los datos ausentes. En máquinas remotas de plataforma desconocida intenta Linux y después Windows, con timeout por comando. Las métricas se guardan sólo en memoria.

## Desarrollo

La referencia oficial completa se obtiene opcionalmente con `git submodule update --init --depth 1 upstream/herdr-app`. Ver [inventario](upstream/README.md). Regenerar la extensión con `node scripts/derive-spaces.cjs`; verificar con `node scripts/derive-spaces.cjs --check`. Para Agents usar también `node scripts/derive-agents.cjs --check` (o sin `--check` para regenerar). Para Workspace Status usar `node scripts/derive-workspace-status.cjs --check` (o sin `--check` para regenerar). Para Workspace Chrome usar `node scripts/derive-workspace-chrome.cjs --check` (o sin `--check` para regenerar). Ejecutar pruebas locales con `node --test`. No se ejecuta CI automáticamente.

No se instala ningún otro mod JEC fuera de Spaces, Agents, Workspace Status y Workspace Chrome. El trabajo anterior de Chat y Machines permanece únicamente en el historial. `restore-official.ps1` retira los mods propios conservando respaldos.
