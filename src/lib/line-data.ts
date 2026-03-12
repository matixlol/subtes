import {
	meta,
	networkStations,
	stationAccessibility,
	stationHistory,
} from "../generated/station-status";

export const lineColors: Record<string, string> = {
	"Línea A": "#00aedc",
	"Línea B": "#ee1b2c",
	"Línea C": "#0168b3",
	"Línea D": "#008066",
	"Línea E": "#6b1f7e",
	"Línea H": "#fed105",
};

const normalizeStationKey = (value: string) =>
	value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/1°/g, "1")
		.replace(/–/g, "-")
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.trim()
		.toLowerCase();

const stationAccessibilityByKey = new Map(
	stationAccessibility.map((station) => [
		`${normalizeStationKey(station.nombreLinea)}::${normalizeStationKey(
			station.nombreEstacion,
		)}`,
		station,
	]),
);

const stationHistoryByKey = new Map(
	stationHistory.map((station) => [
		`${normalizeStationKey(station.nombreLinea)}::${normalizeStationKey(
			station.nombreEstacion,
		)}`,
		station,
	]),
);

export const getLineCode = (nombreLinea: string) =>
	nombreLinea.replace("Línea ", "").trim().toUpperCase();

export const getLineInk = (nombreLinea: string) =>
	getLineCode(nombreLinea) === "H" ? "#3a2b00" : "#ffffff";

export const getAccessibilityState = (
	station:
		| (typeof stationAccessibility)[number]
		| null
		| undefined,
) => {
	if (!station || station.total === 0) return "no-data";
	if (station.conFalla === 0 && station.fueraDeHorario === 0) return "full";
	if (station.funcionando === 0 && station.conFalla > 0) return "blocked";
	if (station.funcionando === 0 && station.fueraDeHorario > 0)
		return "off-hours";
	return "partial";
};

export const getAccessibilityStateLabel = (
	station:
		| (typeof stationAccessibility)[number]
		| null
		| undefined,
) => {
	const state = getAccessibilityState(station);

	if (state === "full") return "Todo funcionando";
	if (state === "blocked") return "Sin acceso ahora";
	if (state === "off-hours") return "Fuera de horario";
	if (state === "partial") return "Acceso parcial";
	return "Sin datos";
};

export const getDeviceStatusLabel = (status: string) => {
	if (status === "funcionando") return "funciona";
	if (status === "fuera-de-horario") return "fuera de horario";
	return "con falla";
};

export const formatDeviceName = (
	device: (typeof stationAccessibility)[number]["devices"][number],
) =>
	/ascensor|escalera/i.test(device.nombre)
		? device.nombre
		: `${device.tipo === "ascensor" ? "Ascensor" : "Escalera"} ${device.nombre}`;

export const diagramLines = Object.values(
	networkStations.reduce<
		Record<
			number,
			{
				idLinea: number;
				nombreLinea: string;
				code: string;
				color: string;
				ink: string;
				stations: Array<
					(typeof networkStations)[number] & {
						accessibility:
							| (typeof stationAccessibility)[number]
							| null;
						history: (typeof stationHistory)[number] | null;
						state: string;
					}
				>;
			}
		>
	>((acc, station) => {
		const line = acc[station.idLinea] ?? {
			idLinea: station.idLinea,
			nombreLinea: station.nombreLinea,
			code: getLineCode(station.nombreLinea),
			color: lineColors[station.nombreLinea] ?? "#b8ab9d",
			ink: getLineInk(station.nombreLinea),
			stations: [],
		};
		const key = `${normalizeStationKey(station.nombreLinea)}::${normalizeStationKey(
			station.nombreEstacion,
		)}`;
		const accessibility = stationAccessibilityByKey.get(key) ?? null;
		const history = stationHistoryByKey.get(key) ?? null;

		line.stations.push({
			...station,
			accessibility,
			history,
			state: getAccessibilityState(accessibility),
		});
		acc[station.idLinea] = line;
		return acc;
	}, {}),
)
	.sort((a, b) => a.idLinea - b.idLinea)
	.map((line) => ({
		...line,
		totalStations: line.stations.length,
		stationsWithDetail: line.stations.filter((station) => station.accessibility)
			.length,
		blockedStations: line.stations.filter((station) => station.state === "blocked")
			.length,
	}));

export const overviewMeta = {
	ultimaActualizacion: meta.ultimaActualizacion,
	totalStations: diagramLines.reduce((count, line) => count + line.totalStations, 0),
	stationsWithDetail: diagramLines.reduce(
		(count, line) => count + line.stationsWithDetail,
		0,
	),
};
