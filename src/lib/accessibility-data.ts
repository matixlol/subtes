import {
	accessibilityTrendMeta,
	lineAccessibilityTrend,
} from "../generated/station-status";

export { accessibilityTrendMeta };

export const getAccessibilityTrendSeriesForLineCode = (code: string) =>
	lineAccessibilityTrend.find(
		(series) => series.nombreLinea === `Línea ${code.toUpperCase()}`,
	) ?? null;
