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

const lineDCurrentEquipmentQuery = `
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
		nombreLinea,
		nombreEstacion,
		COALESCE(nombre_2024, nombre, descripcion) AS equipo
	FROM current_status
	WHERE idLinea = 4
	GROUP BY nombreLinea, nombreEstacion, equipo
	ORDER BY nombreEstacion, equipo
`;

const lineDStationsQuery = `
	SELECT
		nombreEstacion,
		MIN(idEstacion) AS stationOrder
	FROM status
	WHERE idLinea = 4
	GROUP BY nombreEstacion
	ORDER BY stationOrder, nombreEstacion
`;

const lineDHistoryQuery = `
	SELECT
		nombreLinea,
		nombreEstacion,
		COALESCE(nombre_2024, nombre, descripcion) AS equipo,
		funcionando,
		fueraDeHorario,
		[commit-datetime] AS commitDatetime
	FROM status
	WHERE idLinea = 4
		AND LOWER(
			COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
		) LIKE '%ascensor%'
	ORDER BY nombreEstacion, equipo, [commit-datetime] ASC, id ASC
`;

const mapRows = (result) =>
	result.values.map((row) =>
		Object.fromEntries(row.map((value, index) => [result.columns[index], value])),
	);

const getResultRows = (query) => {
	const [result] = db.exec(query);
	return result ? mapRows(result) : [];
};

const truthy = (value) =>
	value === true ||
	value === 1 ||
	value === "1" ||
	value === "True" ||
	value === "true";

const isFailureState = (row) =>
	!truthy(row.funcionando) && !truthy(row.fueraDeHorario);

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: "America/Argentina/Buenos_Aires",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

const getLocalDateKey = (value) => {
	const parts = localDateFormatter.formatToParts(new Date(value));
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;

	return `${year}-${month}-${day}`;
};

const addDays = (dateKey, offset) => {
	const base = new Date(`${dateKey}T00:00:00Z`);
	base.setUTCDate(base.getUTCDate() + offset);
	return base.toISOString().slice(0, 10);
};

const buildServiceWindow = (dateKey) => ({
	start: Date.parse(`${dateKey}T11:00:00.000Z`),
	end: Date.parse(`${dateKey}T23:00:00.000Z`),
});

const deviceFailsDuringWindow = (events, windowStart, windowEnd) => {
	let latestStateBeforeWindow = null;

	for (const event of events) {
		if (event.timestamp <= windowStart) {
			latestStateBeforeWindow = event.isFailure;
			continue;
		}

		if (event.timestamp >= windowEnd) {
			break;
		}

		if (event.isFailure) {
			return true;
		}
	}

	return latestStateBeforeWindow === true;
};

const stations = getResultRows(stationQuery);
const [meta] = getResultRows(metaQuery);
const lineDStationsList = getResultRows(lineDStationsQuery);
const lineDCurrentEquipment = getResultRows(lineDCurrentEquipmentQuery);
const lineDHistory = getResultRows(lineDHistoryQuery);

const lineDStations = new Map();
for (const row of lineDStationsList) {
	lineDStations.set(row.nombreEstacion, {
		nombreEstacion: row.nombreEstacion,
		stationOrder: Number(row.stationOrder),
		totalEquipos: 0,
		equipos: new Set(),
	});
}

for (const row of lineDCurrentEquipment) {
	const existing = lineDStations.get(row.nombreEstacion) ?? {
		nombreEstacion: row.nombreEstacion,
		stationOrder: Number.MAX_SAFE_INTEGER,
		totalEquipos: 0,
		equipos: new Set(),
	};
	existing.equipos.add(row.equipo);
	existing.totalEquipos = existing.equipos.size;
	lineDStations.set(row.nombreEstacion, existing);
}

const eventsByStation = new Map();
let latestLineDCommitDatetime = null;

for (const row of lineDHistory) {
	const key = `${row.nombreEstacion}::${row.equipo}`;
	const events = eventsByStation.get(key) ?? [];
	events.push({
		timestamp: Date.parse(row.commitDatetime),
		isFailure: isFailureState(row),
	});
	eventsByStation.set(key, events);

	if (!latestLineDCommitDatetime || row.commitDatetime > latestLineDCommitDatetime) {
		latestLineDCommitDatetime = row.commitDatetime;
	}
}

const lineDDateEnd = latestLineDCommitDatetime
	? getLocalDateKey(latestLineDCommitDatetime)
	: getLocalDateKey(meta.ultimaActualizacion);
const heatmapWindowDays = 26 * 7;
const lineDDates = Array.from({ length: heatmapWindowDays }, (_, index) =>
	addDays(lineDDateEnd, index - (heatmapWindowDays - 1)),
);

let lineDMaxOutages = 0;
const lineDHeatmapStations = Array.from(lineDStations.values())
	.sort((a, b) => a.stationOrder - b.stationOrder)
	.map((station) => {
		const equipos = Array.from(station.equipos.values()).sort((a, b) =>
			a.localeCompare(b, "es-AR"),
		);
		const days = lineDDates.map((date) => {
			const { start, end } = buildServiceWindow(date);
			const outages = equipos.reduce((count, equipo) => {
				const events = eventsByStation.get(`${station.nombreEstacion}::${equipo}`) ?? [];
				return count + (deviceFailsDuringWindow(events, start, end) ? 1 : 0);
			}, 0);

			lineDMaxOutages = Math.max(lineDMaxOutages, outages);

			return {
				date,
				outages,
				totalEquipos: equipos.length,
			};
		});

		return {
			nombreEstacion: station.nombreEstacion,
			totalEquipos: equipos.length,
			days,
		};
	});

const lineDHeatmap = {
	nombreLinea: lineDCurrentEquipment[0]?.nombreLinea ?? "Línea D",
	serviceWindow: "08:00-20:00 UTC-3",
	startDate: lineDDates[0],
	endDate: lineDDates.at(-1),
	maxOutages: lineDMaxOutages,
	dates: lineDDates,
	stations: lineDHeatmapStations,
};

db.close();

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(
	outputPath,
	[
		"export const meta = " + JSON.stringify(meta, null, 2) + " as const;",
		"export const stations = " + JSON.stringify(stations, null, 2) + " as const;",
		"export const lineDHeatmap = " + JSON.stringify(lineDHeatmap, null, 2) + " as const;",
		"",
	].join("\n\n"),
);

console.log(`Generated ${path.relative(rootDir, outputPath)} with ${stations.length} stations.`);
