import { OGImageRoute } from "astro-og-canvas";
import { openGraphPages } from "../../lib/open-graph";

export const prerender = true;

const hiddenText = "\u200B";
const hiddenTextColor = [214, 214, 212] as const;

export const { getStaticPaths, GET } = await OGImageRoute({
	param: "route",
	pages: openGraphPages,
	getImageOptions: (_route, page) => ({
		title: hiddenText,
		bgImage: {
			path: page.assetPath,
			fit: "fill",
		},
		padding: 0,
		font: {
			title: {
				size: 1,
				color: hiddenTextColor,
			},
			description: {
				size: 1,
				color: hiddenTextColor,
			},
		},
	}),
});
