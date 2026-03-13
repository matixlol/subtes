import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const databasePath = path.join(rootDir, "data", "accesibilidad.sqlite");
const stationsDatasetPath = path.join(rootDir, "data", "subte-estaciones.csv");
const outputPath = path.join(rootDir, "src", "generated", "station-status.ts");
const wasmDir = path.join(rootDir, "node_modules", "sql.js", "dist");

const ascensorCondition = `
	LOWER(
		COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
	) LIKE '%ascensor%'
`;

const escaleraCondition = `
	LOWER(
		COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
	) LIKE '%escalera%'
	AND LOWER(
		COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
	) NOT LIKE '%salvaescalera%'
`;

const ascensorOrEscaleraCondition = `
	(${ascensorCondition} OR ${escaleraCondition})
`;

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
		WHERE ${ascensorOrEscaleraCondition}
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
		WHERE ${ascensorOrEscaleraCondition}
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
		WHERE ${ascensorCondition}
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
		AND ${ascensorCondition}
	ORDER BY nombreEstacion, equipo, [commit-datetime] ASC, id ASC
`;

const currentEquipmentQuery = `
	WITH ranked AS (
		SELECT
			*,
			ROW_NUMBER() OVER (
				PARTITION BY idLinea, idEstacion, COALESCE(nombre_2024, nombre, descripcion)
				ORDER BY [commit-datetime] DESC, id DESC
			) AS rn
		FROM status
		WHERE ${ascensorOrEscaleraCondition}
	),
	current_status AS (
		SELECT * FROM ranked WHERE rn = 1
	)
	SELECT
		idLinea,
		nombreLinea,
		idEstacion,
		nombreEstacion,
		COALESCE(nombre_2024, nombre, descripcion) AS equipo
	FROM current_status
	ORDER BY idLinea, nombreEstacion, idEstacion, equipo
`;

const stationHistoryQuery = `
	SELECT
		idLinea,
		nombreLinea,
		idEstacion,
		nombreEstacion,
		COALESCE(NULLIF(TRIM(descripcion), ''), NULLIF(TRIM(nombre_2024), ''), NULLIF(TRIM(nombre), '')) AS equipo,
		LOWER(
			COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
		) AS searchText,
		funcionando,
		fueraDeHorario,
		fechaActualizacion,
		[commit-datetime] AS commitDatetime
	FROM status
	WHERE ${ascensorOrEscaleraCondition}
	ORDER BY idLinea, nombreEstacion, idEstacion, equipo, [commit-datetime] ASC, id ASC
`;

const accessibilityHistoryQuery = `
	SELECT
		idLinea,
		nombreLinea,
		idEstacion,
		nombreEstacion,
		COALESCE(NULLIF(TRIM(descripcion), ''), NULLIF(TRIM(nombre_2024), ''), NULLIF(TRIM(nombre), '')) AS equipo,
		LOWER(
			COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
		) AS searchText,
		funcionando,
		fueraDeHorario,
		fechaActualizacion,
		[commit-datetime] AS commitDatetime
	FROM status
	WHERE ${ascensorOrEscaleraCondition}
	ORDER BY idLinea, nombreEstacion, idEstacion, equipo, [commit-datetime] ASC, id ASC
`;

const networkStationsQuery = `
	SELECT
		idLinea,
		nombreLinea,
		nombreEstacion,
		MIN(idEstacion) AS stationOrder
	FROM status
	GROUP BY idLinea, nombreLinea, nombreEstacion
	ORDER BY idLinea, stationOrder, nombreEstacion
`;

const accessibilityCurrentQuery = `
	WITH ranked AS (
		SELECT
			*,
			ROW_NUMBER() OVER (
				PARTITION BY idLinea, idEstacion, COALESCE(nombre_2024, nombre, descripcion)
				ORDER BY [commit-datetime] DESC, id DESC
			) AS rn
		FROM status
		WHERE ${ascensorOrEscaleraCondition}
	),
	current_status AS (
		SELECT * FROM ranked WHERE rn = 1
	)
	SELECT
		idLinea,
		nombreLinea,
		idEstacion,
		nombreEstacion,
		COALESCE(
			NULLIF(TRIM(descripcion), ''),
			NULLIF(TRIM(nombre_2024), ''),
			NULLIF(TRIM(nombre), '')
		) AS equipo,
		tipo,
		LOWER(
			COALESCE(nombre_2024, '') || ' ' || COALESCE(nombre, '') || ' ' || COALESCE(descripcion, '')
		) AS searchText,
		funcionando,
		fueraDeHorario,
		fechaActualizacion,
		[commit-datetime] AS commitDatetime
	FROM current_status
	ORDER BY idLinea, nombreEstacion, idEstacion, equipo
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

const addMonths = (monthKey, offset) => {
	const [year, month] = monthKey.split("-").map(Number);
	const base = new Date(Date.UTC(year, month - 1 + offset, 1));
	return base.toISOString().slice(0, 7);
};

const getCompleteYearRange = (startDateKey, endDateKey) => {
	const startYear = Number(startDateKey.slice(0, 4));
	const endYear = Number(endDateKey.slice(0, 4));
	const firstFullYear = startDateKey === `${startYear}-01-01` ? startYear : startYear + 1;
	const lastFullYear = endDateKey === `${endYear}-12-31` ? endYear : endYear - 1;

	if (firstFullYear <= lastFullYear) {
		return {
			startYear: firstFullYear,
			endYear: lastFullYear,
		};
	}

	return {
		startYear,
		endYear,
	};
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

const getDailyFailureSeries = (events, dateKeys) => {
	let eventIndex = 0;
	let currentFailure = false;

	return dateKeys.map((dateKey) => {
		const { start, end } = buildServiceWindow(dateKey);

		while (eventIndex < events.length && events[eventIndex].timestamp < start) {
			currentFailure = events[eventIndex].isFailure;
			eventIndex += 1;
		}

		let failedDuringWindow = currentFailure;

		while (eventIndex < events.length && events[eventIndex].timestamp < end) {
			if (events[eventIndex].isFailure) {
				failedDuringWindow = true;
			}
			currentFailure = events[eventIndex].isFailure;
			eventIndex += 1;
		}

		return failedDuringWindow;
	});
};

const normalizeStationName = (value) =>
	`${value ?? ""}`
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/1°/g, "1")
		.replace(/–/g, "-")
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.trim()
		.toLowerCase();

const getStationKey = (idLinea, nombreEstacion) =>
	`${Number(idLinea)}::${normalizeStationName(nombreEstacion)}`;

const parseCsvRows = (source) => {
	const [headerLine = "", ...dataLines] = source.trim().split(/\r?\n/);
	const headers = headerLine
		.replace(/^\uFEFF/, "")
		.split(",")
		.map((value) => value.trim());

	return dataLines
		.filter((line) => line.trim().length > 0)
		.map((line) => {
			const values = line.split(",");
			return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
		});
};

const stationRows = getResultRows(stationQuery);
const [metaTotals = {
	estaciones: 0,
	equipos: 0,
	alertas: 0,
	ultimaActualizacion: new Date().toISOString(),
}] = getResultRows(metaQuery);
const lineDStationsList = getResultRows(lineDStationsQuery);
const lineDCurrentEquipment = getResultRows(lineDCurrentEquipmentQuery);
const lineDHistory = getResultRows(lineDHistoryQuery);
const currentEquipment = getResultRows(currentEquipmentQuery);
const stationHistoryRows = getResultRows(stationHistoryQuery);
const accessibilityHistoryRows = getResultRows(accessibilityHistoryQuery);
const networkStationsRows = getResultRows(networkStationsQuery);
const accessibilityCurrentRows = getResultRows(accessibilityCurrentQuery);
const stationDatasetCsv = await fs.readFile(stationsDatasetPath, "utf8");
const stationDatasetRows = parseCsvRows(stationDatasetCsv);

const lineMetadataByName = new Map();
const stationMetadataByKey = new Map();
for (const row of networkStationsRows) {
	const idLinea = Number(row.idLinea);
	if (!lineMetadataByName.has(row.nombreLinea)) {
		lineMetadataByName.set(row.nombreLinea, {
			idLinea,
			nombreLinea: row.nombreLinea,
		});
	}

	stationMetadataByKey.set(getStationKey(idLinea, row.nombreEstacion), {
		nombreEstacion: row.nombreEstacion,
		stationOrder: Number(row.stationOrder),
	});
}

const stationCatalog = stationDatasetRows
	.map((row) => {
		const nombreLinea = `Línea ${`${row.linea ?? ""}`.trim().toUpperCase()}`;
		const lineMetadata = lineMetadataByName.get(nombreLinea);
		if (!lineMetadata) return null;

		const stationKey = getStationKey(lineMetadata.idLinea, row.estacion);
		const stationMetadata = stationMetadataByKey.get(stationKey);

		return {
			idLinea: lineMetadata.idLinea,
			nombreLinea,
			nombreEstacion: stationMetadata?.nombreEstacion ?? `${row.estacion ?? ""}`.trim(),
			stationOrder: stationMetadata?.stationOrder ?? Number(row.id),
		};
	})
	.filter((station) => station !== null)
	.sort((a, b) =>
		a.idLinea === b.idLinea
			? a.stationOrder - b.stationOrder
			: a.idLinea - b.idLinea,
	);
const stationMetricsByKey = new Map(
	stationRows.map((row) => [getStationKey(row.idLinea, row.nombreEstacion), row]),
);

const stations = stationCatalog
	.map((station) => {
		const metrics = stationMetricsByKey.get(
			getStationKey(station.idLinea, station.nombreEstacion),
		);

		if (metrics) {
			return {
				idLinea: Number(metrics.idLinea),
				nombreLinea: metrics.nombreLinea,
				idEstacion: Number(metrics.idEstacion),
				nombreEstacion: metrics.nombreEstacion,
				totalEquipos: Number(metrics.totalEquipos),
				equiposFuncionando: Number(metrics.equiposFuncionando),
				equiposConFalla: Number(metrics.equiposConFalla),
				equiposFueraDeHorario: Number(metrics.equiposFueraDeHorario),
				ultimaActualizacion: metrics.ultimaActualizacion,
			};
		}

		return {
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			idEstacion: station.stationOrder,
			nombreEstacion: station.nombreEstacion,
			totalEquipos: 0,
			equiposFuncionando: 0,
			equiposConFalla: 0,
			equiposFueraDeHorario: 0,
			ultimaActualizacion: metaTotals.ultimaActualizacion,
		};
	})
	.sort((a, b) =>
		a.idLinea === b.idLinea
			? a.idEstacion - b.idEstacion
			: a.idLinea - b.idLinea,
	);

const meta = {
	...metaTotals,
	estaciones: stationCatalog.length,
	equipos: Number(metaTotals.equipos),
	alertas: Number(metaTotals.alertas),
};

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

const historyWindowDays = 30;
const stationHistoryEndDate = meta.ultimaActualizacion
	? getLocalDateKey(meta.ultimaActualizacion)
	: getLocalDateKey(new Date().toISOString());
const stationHistoryDates = Array.from({ length: historyWindowDays }, (_, index) =>
	addDays(stationHistoryEndDate, index - (historyWindowDays - 1)),
);

const stationEquipmentByName = new Map(
	stationCatalog.map((station) => [
		getStationKey(station.idLinea, station.nombreEstacion),
		{
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			nombreEstacion: station.nombreEstacion,
			equipos: new Set(),
		},
	]),
);
for (const row of currentEquipment) {
	const stationKey = getStationKey(row.idLinea, row.nombreEstacion);
	const equipmentKey = `${row.idEstacion}::${row.equipo}`;
	const existing = stationEquipmentByName.get(stationKey) ?? {
		idLinea: Number(row.idLinea),
		nombreLinea: row.nombreLinea,
		nombreEstacion: row.nombreEstacion,
		equipos: new Set(),
	};
	existing.equipos.add(equipmentKey);
	stationEquipmentByName.set(stationKey, existing);
}

const stationEventsByEquipment = new Map();
for (const row of stationHistoryRows) {
	const stationKey = getStationKey(row.idLinea, row.nombreEstacion);
	const equipmentKey = `${stationKey}::${row.idEstacion}::${row.equipo}`;
	const events = stationEventsByEquipment.get(equipmentKey) ?? [];
	events.push({
		timestamp: Date.parse(row.commitDatetime),
		isFailure: isFailureState(row),
	});
	stationEventsByEquipment.set(equipmentKey, events);
}

const stationHistory = Array.from(stationEquipmentByName.values())
	.sort((a, b) =>
		a.idLinea === b.idLinea
			? a.nombreEstacion.localeCompare(b.nombreEstacion, "es-AR")
			: a.idLinea - b.idLinea,
	)
	.map((station) => {
		const equipmentKeys = Array.from(station.equipos.values());
		const days = stationHistoryDates.map((date) => {
			const { start, end } = buildServiceWindow(date);
			const outages = equipmentKeys.reduce((count, equipmentKey) => {
				const events = stationEventsByEquipment.get(
					`${getStationKey(station.idLinea, station.nombreEstacion)}::${equipmentKey}`,
				) ?? [];
				return count + (deviceFailsDuringWindow(events, start, end) ? 1 : 0);
			}, 0);

			return {
				date,
				outages,
				totalEquipos: equipmentKeys.length,
				withoutAccess: equipmentKeys.length > 0 && outages >= equipmentKeys.length,
				withAnyFailure: outages > 0,
			};
		});

		let currentWithoutAccessStreak = 0;
		let currentFailureStreak = 0;

		for (let index = days.length - 1; index >= 0; index -= 1) {
			if (days[index].withoutAccess) {
				currentWithoutAccessStreak += 1;
			} else {
				break;
			}
		}

		for (let index = days.length - 1; index >= 0; index -= 1) {
			if (days[index].withAnyFailure) {
				currentFailureStreak += 1;
			} else {
				break;
			}
		}

		return {
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			nombreEstacion: station.nombreEstacion,
			windowDays: historyWindowDays,
			daysWithoutAccess: days.filter((day) => day.withoutAccess).length,
			daysWithAnyFailure: days.filter((day) => day.withAnyFailure).length,
			currentWithoutAccessStreak,
			currentFailureStreak,
			lastDate: stationHistoryDates.at(-1),
		};
	});

const networkStations = [...stationCatalog];

const classifyDeviceType = (row) => {
	if (Number(row.tipo) === 0) return "ascensor";
	if (Number(row.tipo) === 1) return "escalera";
	const normalized = `${row.searchText ?? ""}`.toLocaleLowerCase("es-AR");
	return normalized.includes("ascensor") ? "ascensor" : "escalera";
};

const getDeviceStatus = (row) => {
	if (truthy(row.funcionando)) return "funcionando";
	if (truthy(row.fueraDeHorario)) return "fuera-de-horario";
	return "con-falla";
};

const stationAccessibilityMap = new Map(
	stationCatalog.map((station) => [
		getStationKey(station.idLinea, station.nombreEstacion),
		{
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			nombreEstacion: station.nombreEstacion,
			devices: new Map(),
			ultimaActualizacion: meta.ultimaActualizacion,
		},
	]),
);
for (const row of accessibilityCurrentRows) {
	const stationKey = getStationKey(row.idLinea, row.nombreEstacion);
	const deviceType = classifyDeviceType(row);
	const deviceKey = `${deviceType}::${row.equipo}`;
	const existingStation = stationAccessibilityMap.get(stationKey) ?? {
		idLinea: Number(row.idLinea),
		nombreLinea: row.nombreLinea,
		nombreEstacion: row.nombreEstacion,
		devices: new Map(),
		ultimaActualizacion: row.fechaActualizacion,
	};
	const existingDevice = existingStation.devices.get(deviceKey);

	if (!existingDevice || row.commitDatetime > existingDevice.commitDatetime) {
		existingStation.devices.set(deviceKey, {
			nombre: row.equipo,
			tipo: deviceType,
			estado: getDeviceStatus(row),
			fechaActualizacion: row.fechaActualizacion,
			commitDatetime: row.commitDatetime,
		});
	}

	if (row.fechaActualizacion > existingStation.ultimaActualizacion) {
		existingStation.ultimaActualizacion = row.fechaActualizacion;
	}

	stationAccessibilityMap.set(stationKey, existingStation);
}

const stationAccessibility = Array.from(stationAccessibilityMap.values())
	.sort((a, b) =>
		a.idLinea === b.idLinea
			? a.nombreEstacion.localeCompare(b.nombreEstacion, "es-AR")
			: a.idLinea - b.idLinea,
	)
	.map((station) => {
		const devices = Array.from(station.devices.values())
			.sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR"))
			.map(({ commitDatetime, ...device }) => device);
		const counts = devices.reduce(
			(acc, device) => {
				if (device.estado === "funcionando") acc.funcionando += 1;
				if (device.estado === "fuera-de-horario") acc.fueraDeHorario += 1;
				if (device.estado === "con-falla") acc.conFalla += 1;
				return acc;
			},
			{
				total: devices.length,
				funcionando: 0,
				fueraDeHorario: 0,
				conFalla: 0,
			},
		);

		return {
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			nombreEstacion: station.nombreEstacion,
			ultimaActualizacion: station.ultimaActualizacion,
			...counts,
			devices,
		};
	});

const averageClosureYear = "2025";
const averageClosureDates = Array.from({ length: 365 }, (_, index) =>
	addDays(`${averageClosureYear}-01-01`, index),
);

const accessibilityEquipmentByStation = new Map(
	stationCatalog.map((station) => [
		getStationKey(station.idLinea, station.nombreEstacion),
		{
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			nombreEstacion: station.nombreEstacion,
			equipos: new Set(),
		},
	]),
);
for (const row of accessibilityCurrentRows) {
	const stationKey = getStationKey(row.idLinea, row.nombreEstacion);
	const deviceType = classifyDeviceType(row);
	const equipmentKey = `${Number(row.idEstacion)}::${deviceType}::${row.equipo}`;
	const existingStation = accessibilityEquipmentByStation.get(stationKey) ?? {
		idLinea: Number(row.idLinea),
		nombreLinea: row.nombreLinea,
		nombreEstacion: row.nombreEstacion,
		equipos: new Set(),
	};
	existingStation.equipos.add(equipmentKey);
	accessibilityEquipmentByStation.set(stationKey, existingStation);
}

const accessibilityEventsByEquipment = new Map();
for (const row of accessibilityHistoryRows) {
	const stationKey = getStationKey(row.idLinea, row.nombreEstacion);
	const deviceType = classifyDeviceType(row);
	const equipmentKey = `${stationKey}::${Number(row.idEstacion)}::${deviceType}::${row.equipo}`;
	const events = accessibilityEventsByEquipment.get(equipmentKey) ?? [];
	events.push({
		timestamp: Date.parse(row.commitDatetime),
		isFailure: isFailureState(row),
	});
	accessibilityEventsByEquipment.set(equipmentKey, events);
}

const stationEntryClosures = Array.from(accessibilityEquipmentByStation.values())
	.sort((a, b) =>
		a.idLinea === b.idLinea
			? a.nombreEstacion.localeCompare(b.nombreEstacion, "es-AR")
			: a.idLinea - b.idLinea,
	)
	.map((station) => {
		const equipmentKeys = Array.from(station.equipos.values());
		const totals = averageClosureDates.reduce(
			(acc, date) => {
				const { start, end } = buildServiceWindow(date);
				const closedEntries = equipmentKeys.reduce((count, equipmentKey) => {
					const events = accessibilityEventsByEquipment.get(
						`${getStationKey(station.idLinea, station.nombreEstacion)}::${equipmentKey}`,
					) ?? [];
					return count + (deviceFailsDuringWindow(events, start, end) ? 1 : 0);
				}, 0);
				return {
					daysWithClosedEntry:
						acc.daysWithClosedEntry + (closedEntries > 0 ? 1 : 0),
					totalClosedEntries: acc.totalClosedEntries + closedEntries,
				};
			},
			{
				daysWithClosedEntry: 0,
				totalClosedEntries: 0,
			},
		);
		const totalEntries = equipmentKeys.length;
		const totalEntryDays = averageClosureDates.length * totalEntries;

		return {
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			nombreEstacion: station.nombreEstacion,
			totalEntries,
			daysTracked: averageClosureDates.length,
			daysWithClosedEntry: totals.daysWithClosedEntry,
			totalClosedEntries: totals.totalClosedEntries,
			totalEntryDays,
			averageClosedEntryShare:
				totals.daysWithClosedEntry / averageClosureDates.length,
			averageClosedEntriesShare:
				totalEntryDays > 0 ? totals.totalClosedEntries / totalEntryDays : 0,
		};
	});

const lineEntryClosureAverages = Object.values(
	stationEntryClosures.reduce((acc, station) => {
		const line = acc[station.idLinea] ?? {
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			stations: 0,
			totalDays: 0,
			daysWithClosedEntry: 0,
		};
		line.stations += 1;
		line.totalDays += station.daysTracked;
		line.daysWithClosedEntry += station.daysWithClosedEntry;
		acc[station.idLinea] = line;
		return acc;
	}, {}),
)
	.sort((a, b) => a.idLinea - b.idLinea)
	.map((line) => ({
		idLinea: line.idLinea,
		nombreLinea: line.nombreLinea,
		stations: line.stations,
		daysTracked: averageClosureDates.length,
		daysWithClosedEntry: line.daysWithClosedEntry,
		averageClosedEntryShare:
			line.totalDays > 0 ? line.daysWithClosedEntry / line.totalDays : 0,
	}));

const totalStationDaysTracked = stationEntryClosures.reduce(
		(count, station) => count + station.daysTracked,
		0,
	);
const totalStationDaysWithClosedEntry = stationEntryClosures.reduce(
		(count, station) => count + station.daysWithClosedEntry,
		0,
	);

const averageEntryClosures = {
	year: averageClosureYear,
	totalStations: stationEntryClosures.length,
	daysTracked: averageClosureDates.length,
	totalStationDaysTracked,
	totalStationDaysWithClosedEntry,
	averageClosedEntryShare:
		totalStationDaysTracked > 0
			? totalStationDaysWithClosedEntry / totalStationDaysTracked
			: 0,
	lines: lineEntryClosureAverages,
};

const leastAccessibleStations2025 = {
	year: averageClosureYear,
	stations: [...stationEntryClosures]
		.sort((a, b) => {
			if (b.averageClosedEntriesShare !== a.averageClosedEntriesShare) {
				return b.averageClosedEntriesShare - a.averageClosedEntriesShare;
			}

			if (b.totalClosedEntries !== a.totalClosedEntries) {
				return b.totalClosedEntries - a.totalClosedEntries;
			}

			if (a.idLinea !== b.idLinea) {
				return a.idLinea - b.idLinea;
			}

			return a.nombreEstacion.localeCompare(b.nombreEstacion, "es-AR");
		})
		.slice(0, 5)
		.map((station, index) => ({
			rank: index + 1,
			...station,
		})),
};

const earliestAccessibilityCommitDatetime = accessibilityHistoryRows.reduce(
	(earliest, row) => {
		if (!row.commitDatetime) return earliest;
		if (!earliest || row.commitDatetime < earliest) return row.commitDatetime;
		return earliest;
	},
	null,
);
const lineAccessibilityHistoryStartDate = earliestAccessibilityCommitDatetime
	? getLocalDateKey(earliestAccessibilityCommitDatetime)
	: getLocalDateKey(meta.ultimaActualizacion);
const lineAccessibilityHistoryEndDate = meta.ultimaActualizacion
	? getLocalDateKey(meta.ultimaActualizacion)
	: getLocalDateKey(new Date().toISOString());
const lineAccessibilityTrendYears = getCompleteYearRange(
	lineAccessibilityHistoryStartDate,
	lineAccessibilityHistoryEndDate,
);
const lineAccessibilityTrendStartMonth = `${lineAccessibilityTrendYears.startYear}-01`;
const lineAccessibilityTrendEndMonth = `${lineAccessibilityTrendYears.endYear}-12`;
const lineAccessibilityTrendMonths =
	(lineAccessibilityTrendYears.endYear - lineAccessibilityTrendYears.startYear + 1) * 12;
const lineAccessibilityTrendMonthsList = Array.from(
	{ length: Math.max(lineAccessibilityTrendMonths, 1) },
	(_, index) => addMonths(lineAccessibilityTrendStartMonth, index),
);
const lineAccessibilityTrendStartDate = `${lineAccessibilityTrendMonthsList[0]}-01`;
const lineAccessibilityTrendEndDate = `${lineAccessibilityTrendMonthsList.at(-1)}-31`;
const lineAccessibilityTrendDates = [];

for (
	let dateKey = lineAccessibilityTrendStartDate;
	dateKey <= lineAccessibilityTrendEndDate;
	dateKey = addDays(dateKey, 1)
) {
	lineAccessibilityTrendDates.push(dateKey);
}

const lineAccessibilityTrendByLine = new Map();

for (const station of accessibilityEquipmentByStation.values()) {
	const equipmentKeys = Array.from(station.equipos.values());

	const dailyFailuresByEquipment = equipmentKeys.map((equipmentKey) =>
		getDailyFailureSeries(
			accessibilityEventsByEquipment.get(
				`${getStationKey(station.idLinea, station.nombreEstacion)}::${equipmentKey}`,
			) ?? [],
			lineAccessibilityTrendDates,
		),
	);

	const lineEntry = lineAccessibilityTrendByLine.get(station.idLinea) ?? {
		idLinea: station.idLinea,
		nombreLinea: station.nombreLinea,
		stationsTracked: 0,
		months: new Map(),
	};

	lineEntry.stationsTracked += 1;

	lineAccessibilityTrendDates.forEach((dateKey, dayIndex) => {
		const monthKey = dateKey.slice(0, 7);
		const stationWithClosedAccess = dailyFailuresByEquipment.some(
			(series) => series[dayIndex] === true,
		);
		const monthEntry = lineEntry.months.get(monthKey) ?? {
			month: monthKey,
			closedStationDays: 0,
			totalStationDays: 0,
		};

		monthEntry.totalStationDays += 1;
		if (stationWithClosedAccess) {
			monthEntry.closedStationDays += 1;
		}

		lineEntry.months.set(monthKey, monthEntry);
	});

	lineAccessibilityTrendByLine.set(station.idLinea, lineEntry);
}

const lineAccessibilityTrend = Array.from(lineAccessibilityTrendByLine.values())
	.sort((a, b) => a.idLinea - b.idLinea)
	.map((line) => ({
		idLinea: line.idLinea,
		nombreLinea: line.nombreLinea,
		stationsTracked: line.stationsTracked,
		points: lineAccessibilityTrendMonthsList.map((monthKey) => {
			const month = line.months.get(monthKey);
			const share =
				month && month.totalStationDays > 0
					? (month.closedStationDays / month.totalStationDays) * 100
					: null;

			return {
				month: monthKey,
				value: share,
			};
		}),
	}));

const accessibilityTrendMeta = {
	yearsTracked:
		lineAccessibilityTrendYears.endYear - lineAccessibilityTrendYears.startYear + 1,
	startYear: lineAccessibilityTrendYears.startYear,
	endYear: lineAccessibilityTrendYears.endYear,
	monthsTracked: lineAccessibilityTrendMonthsList.length,
	startMonth: lineAccessibilityTrendMonthsList[0],
	endMonth: lineAccessibilityTrendMonthsList.at(-1),
	endDate: lineAccessibilityTrendEndDate,
};

db.close();

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(
	outputPath,
	[
		"export const meta = " + JSON.stringify(meta, null, 2) + " as const;",
		"export const stations = " + JSON.stringify(stations, null, 2) + " as const;",
		"export const networkStations = " + JSON.stringify(networkStations, null, 2) + " as const;",
		"export const stationAccessibility = " + JSON.stringify(stationAccessibility, null, 2) + " as const;",
		"export const stationHistory = " + JSON.stringify(stationHistory, null, 2) + " as const;",
		"export const averageEntryClosures = " + JSON.stringify(averageEntryClosures, null, 2) + " as const;",
		"export const leastAccessibleStations2025 = " + JSON.stringify(leastAccessibleStations2025, null, 2) + " as const;",
		"export const accessibilityTrendMeta = " + JSON.stringify(accessibilityTrendMeta, null, 2) + " as const;",
		"export const lineAccessibilityTrend = " + JSON.stringify(lineAccessibilityTrend, null, 2) + " as const;",
		"export const lineDHeatmap = " + JSON.stringify(lineDHeatmap, null, 2) + " as const;",
		"",
	].join("\n\n"),
);

console.log(`Generated ${path.relative(rootDir, outputPath)} with ${stations.length} stations.`);
