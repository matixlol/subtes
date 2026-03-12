import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dsvFormat } from "d3";

const repoRoot = process.cwd();
const inputPath = join(repoRoot, "data", "frecuencia_subte.csv");
const outputPath = join(repoRoot, "src", "generated", "frequency-series.ts");

const lineDefinitions = [
	{
		label: "Línea A",
		shortLabel: "Línea A",
		column: "servicio_frecuencia_a",
		color: "#00aedc",
	},
	{
		label: "Línea B",
		shortLabel: "Línea B",
		column: "servicio_frecuencia_b",
		color: "#ee1b2c",
	},
	{
		label: "Línea C",
		shortLabel: "Línea C",
		column: "servicio_frecuencia_c",
		color: "#0168b3",
	},
	{
		label: "Línea D",
		shortLabel: "Línea D",
		column: "servicio_frecuencia_d",
		color: "#008066",
	},
	{
		label: "Línea E",
		shortLabel: "Línea E",
		column: "servicio_frecuencia_e",
		color: "#6b1f7e",
	},
	{
		label: "Línea H",
		shortLabel: "Línea H",
		column: "servicio_frecuencia_h",
		color: "#fed105",
	},
	{
		label: "Premetro",
		shortLabel: "Premetro",
		column: "servicio_frecuencia_premetro",
		color: "#f4a024",
	},
];

const csv = dsvFormat(";");
const rawRows = csv.parse(readFileSync(inputPath, "utf8").replace(/^\uFEFF/, ""));

const parseMonth = (value) => {
	const trimmed = value?.trim();

	if (!trimmed) return null;

	const [yearPart, monthPart] = trimmed.split("-");
	const year = Number(yearPart);
	const month = Number(monthPart);

	if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
		return null;
	}

	return `${year}-${String(month).padStart(2, "0")}`;
};

const toSeconds = (value) => {
	const trimmed = value?.trim();

	if (!trimmed || !trimmed.includes(":")) return null;

	const [minutesPart, secondsPart] = trimmed.split(":");
	const minutes = Number(minutesPart);
	const seconds = Number(secondsPart);

	if (!Number.isInteger(minutes) || !Number.isInteger(seconds)) return null;

	return minutes * 60 + seconds;
};

const months = rawRows
	.map((row) => parseMonth(row.mes_anio))
	.filter((month) => month !== null);

const frequencySeries = lineDefinitions.map((line) => ({
	label: line.label,
	shortLabel: line.shortLabel,
	color: line.color,
	points: rawRows
		.map((row) => {
			const month = parseMonth(row.mes_anio);

			if (!month) return null;

			return {
				month,
				value: toSeconds(row[line.column]),
			};
		})
		.filter((point) => point !== null),
}));

const frequencyMeta = {
	firstMonth: months[0] ?? null,
	lastMonth: months.at(-1) ?? null,
	totalMonths: months.length,
};

const fileContents = `export const frequencyMeta = ${JSON.stringify(
	frequencyMeta,
	null,
	2,
)} as const;

export const frequencySeries = ${JSON.stringify(frequencySeries, null, 2)} as const;
`;

writeFileSync(outputPath, fileContents);

console.log(
	`Generated src/generated/frequency-series.ts with ${frequencyMeta.totalMonths} months.`,
);
