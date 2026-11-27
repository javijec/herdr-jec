# herdr-jec

Extensiones pequeñas de Herdr Desktop oficial. Sin fork ni compilación.

## v0.1 — Spaces

Partimos del mod oficial Spaces fijado en [upstream/herdr-app](upstream/herdr-app). Ya incluye agrupación por máquina, plegado, estado de conexión, login, reconexión, worktrees, menús y drag & drop. Conservamos esas funciones sin cambios.

JEC añade únicamente el total de espacios, un contador por máquina, una indicación del equipo activo (también plegado y en modo compacto) y un tooltip con cantidad de pestañas. Los conteos se obtienen de la API de Herdr existente; no hay nuevos timers ni llamadas remotas. En instalaciones con sólo la máquina local se conserva la presentación original sin grupo de máquina.

El layout jec es el main oficial con un único cambio: spaces → jec-spaces. Los mods y el layout de fábrica no se sobrescriben.

```powershell
git pull
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

Volver a la interfaz original: `herdr-app do layout.switch --name main`.

## Desarrollo

La referencia oficial completa se obtiene opcionalmente con `git submodule update --init --depth 1 upstream/herdr-app`. Ver [inventario](upstream/README.md). Regenerar la extensión con `node scripts/derive-spaces.cjs`; verificar con `node scripts/derive-spaces.cjs --check`. Ejecutar pruebas locales con `node --test`. No se ejecuta CI automáticamente.

No se instala ningún otro mod JEC. El trabajo anterior de Chat y Machines permanece únicamente en el historial. `restore-official.ps1` retira los mods propios conservando respaldos.
