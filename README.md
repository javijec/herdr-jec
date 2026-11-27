# herdr-jec

Punto de partida limpio para extender Herdr Desktop oficial. No hay mods JEC activos ni layouts propios en main.

## Base oficial

[upstream/herdr-app](upstream/herdr-app) es un submódulo fijado que contiene los 21 mods de fábrica, layouts, iconos, recursos y API. Consultar el [inventario y política de reutilización](upstream/README.md).

```powershell
git submodule update --init --depth 1 upstream/herdr-app
```

Es opcional para usar Herdr. No compilar ni instalar la referencia.

## Retirar los mods anteriores (Windows)

Con Herdr abierto, ejecutar:

```powershell
git pull
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

El script vuelve al layout main y respalda exclusivamente los antiguos mods/layouts JEC, entre ellos Chat y Machines. Retira sólo las integraciones específicas de Chat. No instala mods nuevos ni sobrescribe los oficiales. No elimina sesiones. Recargar los agentes al finalizar sus tareas si aún tienen integraciones antiguas en memoria.

El trabajo anterior se conserva en el [historial de Git](https://github.com/javijec/herdr-jec/tree/c31328e86e8a34c3268bbd2a990974e7d665a647); no forma parte del árbol activo. La rama experimental nativa sigue separada. No hay workflows automáticos de compilación.

## Desarrollo

Partir de los mods oficiales; modificar únicamente lo necesario y conservar la licencia de origen. Evitar recrear componentes, layouts y funcionalidades existentes. No modificar ni recompilar Herdr.
