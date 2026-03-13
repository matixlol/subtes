import { diagramLines } from "./line-data";

type OpenGraphPage = {
	assetPath: string;
};

const ogAssetDirectory = "./src/assets/opengraph";

export const homePageTitle = "Subte roto.";
export const homePageDescription = "El subte porteño se está deteriorando.";
export const homeOpenGraphPath = "/open-graph/home.png";

export const linePageDescription = (code: string) =>
	`Estado actual de accesibilidad y frecuencia de la línea ${code} del subte porteño.`;

export const lineOpenGraphPath = (code: string) => `/open-graph/linea/${code}.png`;

export const openGraphPages = {
	home: {
		assetPath: `${ogAssetDirectory}/home.png`,
	},
	...Object.fromEntries(
		diagramLines.map((line) => [
			`linea/${line.code}`,
			{
				assetPath: `${ogAssetDirectory}/line-${line.code}.png`,
			},
		]),
	),
} satisfies Record<string, OpenGraphPage>;
