import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const databasePath = path.join(rootDir, "data", "accesibilidad.sqlite");
const outputPath = path.join(rootDir, "src", "generated", "station-status.ts");
const wasmDir = path.join(rootDir, "node_modules", "sql.js", "dist");

const SQL = await initSqlJs({
	locateFile: (file) => path.join(wasmDir, file),
});

const databaseBytes = await fs.readFile(databasePath);
const db = new SQL.Database(databaseBytes);

const stationQuery = `
	WITH ranked AS (
		SELECT
			*,
			ROW_NUMBER() OVER (
				PARTITION BY idLinea, idEstacion, COALESCE(nombre_2024, nombre, descripcion)
				ORDER BY [commit-datetime] DESC, id DESC
			) AS rn
		FROM status
		WHERE LOWER(
			COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
		) LIKE '%ascensor%'
	),
	current_status AS (
		SELECT * FROM ranked WHERE rn = 1
	)
	SELECT
		idLinea,
		nombreLinea,
		idEstacion,
		nombreEstacion,
		COUNT(*) AS totalEquipos,
		SUM(CASE WHEN funcionando = 'True' OR funcionando = 1 THEN 1 ELSE 0 END) AS equiposFuncionando,
		SUM(CASE WHEN funcionando = 'True' OR funcionando = 1 THEN 0 ELSE 1 END) AS equiposConFalla,
		SUM(CASE WHEN fueraDeHorario = 'True' OR fueraDeHorario = 1 THEN 1 ELSE 0 END) AS equiposFueraDeHorario,
		MAX(fechaActualizacion) AS ultimaActualizacion
	FROM current_status
	GROUP BY idLinea, nombreLinea, idEstacion, nombreEstacion
	ORDER BY idLinea, idEstacion
`;

const metaQuery = `
	WITH ranked AS (
		SELECT
			*,
			ROW_NUMBER() OVER (
				PARTITION BY idLinea, idEstacion, COALESCE(nombre_2024, nombre, descripcion)
				ORDER BY [commit-datetime] DESC, id DESC
			) AS rn
		FROM status
		WHERE LOWER(
			COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
		) LIKE '%ascensor%'
	),
	current_status AS (
		SELECT * FROM ranked WHERE rn = 1
	)
	SELECT
		COUNT(DISTINCT CAST(idLinea AS TEXT) || ':' || CAST(idEstacion AS TEXT)) AS estaciones,
		COUNT(*) AS equipos,
		SUM(CASE WHEN funcionando = 'True' OR funcionando = 1 THEN 0 ELSE 1 END) AS alertas,
		MAX(fechaActualizacion) AS ultimaActualizacion
	FROM current_status
`;

const mapRows = (result) =>
	result.values.map((row) =>
		Object.fromEntries(row.map((value, index) => [result.columns[index], value])),
	);

const stations = mapRows(db.exec(stationQuery)[0]);
const [meta] = mapRows(db.exec(metaQuery)[0]);
db.close();

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(
	outputPath,
	[
		"export const meta = " + JSON.stringify(meta, null, 2) + " as const;",
		"export const stations = " + JSON.stringify(stations, null, 2) + " as const;",
		"",
	].join("\n\n"),
);

console.log(`Generated ${path.relative(rootDir, outputPath)} with ${stations.length} stations.`);
