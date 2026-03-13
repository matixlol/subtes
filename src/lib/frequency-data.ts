import { frequencySeries } from "../generated/frequency-series";

const subteSeries = frequencySeries.filter((series) => series.label !== "Premetro");

const percentFormatter = new Intl.NumberFormat("es-AR", {
	style: "percent",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

const getDefinedPoints = (points: ReadonlyArray<{ month: string; value: number | null }>) =>
	points.filter((point): point is { month: string; value: number } => point.value !== null);
const getPointsForYear = (
	points: ReadonlyArray<{ month: string; value: number }>,
	year: string,
) => points.filter((point) => point.month.startsWith(`${year}-`));

const averageValues = (points: ReadonlyArray<{ value: number }>) =>
	points.reduce((sum, point) => sum + point.value, 0) / points.length;

const comparisonStartYear = "2019";
const comparisonEndYear = "2025";

const formatSecondsAsMinutes = (value: number) => {
	const roundedValue = Math.round(value);
	const minutes = Math.floor(roundedValue / 60);
	const seconds = roundedValue % 60;

	return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const getFrequencySeriesForLineCode = (code: string) =>
	subteSeries.find((series) => series.label === `Línea ${code.toUpperCase()}`) ?? null;

export const getFrequencyChange = (
	series:
		| (typeof subteSeries)[number]
		| null
		| undefined,
) => {
	if (!series) return null;

	const definedPoints = getDefinedPoints(series.points);
	const startYearPoints = getPointsForYear(definedPoints, comparisonStartYear);
	const endYearPoints = getPointsForYear(definedPoints, comparisonEndYear);

	if (startYearPoints.length === 0 || endYearPoints.length === 0) return null;

	const firstPoint = {
		month: `${comparisonStartYear}-01`,
		value: averageValues(startYearPoints),
	};
	const latestPoint = {
		month: `${comparisonEndYear}-01`,
		value: averageValues(endYearPoints),
	};
	const delta = latestPoint.value - firstPoint.value;
	const changeRatio = delta / firstPoint.value;
	const isBetter = delta < 0;
	const direction = delta === 0 ? "igual" : isBetter ? "mejor" : "peor";

	return {
		series,
		firstPoint,
		latestPoint,
		delta,
		changeRatio,
		isBetter,
		direction,
		changeLabel:
			delta === 0
				? "sin cambio"
				: `${percentFormatter.format(Math.abs(changeRatio)).trim()} ${direction}`,
		firstValueLabel: formatSecondsAsMinutes(firstPoint.value),
		latestValueLabel: formatSecondsAsMinutes(latestPoint.value),
		firstPeriodLabel: comparisonStartYear,
		latestPeriodLabel: comparisonEndYear,
	};
};

export type FrequencyChange = NonNullable<ReturnType<typeof getFrequencyChange>>;

export const frequencyChangeByLine: FrequencyChange[] = subteSeries
	.map((series) => getFrequencyChange(series))
	.filter((entry): entry is FrequencyChange => entry !== null);

export const networkFrequencyChange = (() => {
	const firstValues = frequencyChangeByLine.map((line) => line.firstPoint.value);
	const latestValues = frequencyChangeByLine.map((line) => line.latestPoint.value);

	if (firstValues.length === 0 || latestValues.length === 0) return null;

	const average = (values: number[]) =>
		values.reduce((sum, value) => sum + value, 0) / values.length;

	const firstValue = average(firstValues);
	const latestValue = average(latestValues);
	const delta = latestValue - firstValue;
	const changeRatio = delta / firstValue;

	return {
		firstValue,
		latestValue,
		changeRatio,
		isBetter: delta < 0,
		changeLabel: percentFormatter.format(Math.abs(changeRatio)).trim(),
		firstYear: comparisonStartYear,
		latestYear: comparisonEndYear,
	};
})();
