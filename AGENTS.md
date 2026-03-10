# Repo Notes

- Always use Tailwind for styling unless required to do otherwise

## Data Overview

- Primary dataset: `data/accesibilidad.sqlite`
- Git storage: tracked with Git LFS via `.gitattributes`
- Source table: `status`
- Table shape: historical accessibility status records for subte equipment
- Important fields:
  - `idLinea`, `nombreLinea`
  - `idEstacion`, `nombreEstacion`
  - `funcionando`
  - `fueraDeHorario`
  - `fechaActualizacion`
  - `commit-datetime`
  - `nombre`, `nombre_2024`, `descripcion`
- In the current SQLite file, boolean-like fields are stored as `0/1` integers; do not assume `'True'/'False'` strings.

## Ascensor Filtering

- Do not rely on `status.tipo` alone to identify ascensores.
- The source data is not cleanly normalized by `tipo`; at least one record labeled as an ascensor in text does not sit in the expected `tipo` bucket.
- The app now treats a row as an ascensor when the combined text from `nombre_2024`, `nombre`, and `descripcion` contains `ascensor` case-insensitively.
- This intentionally excludes escaleras mecánicas and most salvaescaleras based on text, not on numeric type codes.

## Current Derivation

- The app does not ship the raw SQLite file to the browser.
- `sql.js` is used in `scripts/generate-station-status.mjs` to read the SQLite DB at generate/build time.
- Before deduping and aggregation, the script filters `status` rows with a case-insensitive string match for `ascensor` across `nombre_2024`, `nombre`, and `descripcion`.
- The script keeps only the latest record per device using:
  - partition by `idLinea`, `idEstacion`, `COALESCE(nombre_2024, nombre, descripcion)`
  - order by `commit-datetime DESC, id DESC`
- That result is aggregated into one row per current line/station pair.
- Aggregation must treat `funcionando` and `fueraDeHorario` as integer booleans (`1` truthy, `0` falsy), while still tolerating `'True'` if the source format changes later.
- Generated output lives in `src/generated/station-status.ts`.
- The homepage reads from the generated module, not from SQLite directly.

## UI Data Contract

- `meta` contains:
  - `estaciones`
  - `equipos`
  - `alertas`
  - `ultimaActualizacion`
- `stations` contains one row per current line/station pair with:
  - `nombreLinea`
  - `nombreEstacion`
  - `totalEquipos`
  - `equiposFuncionando`
  - `equiposConFalla`
  - `equiposFueraDeHorario`
  - `ultimaActualizacion`
