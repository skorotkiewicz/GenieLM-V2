import mermaid from "mermaid";

let nextId = 0;
let renderQueue = Promise.resolve();

export type RenderedMermaid = {
	src: string;
	width: number;
	height: number;
};

function svgWithIntrinsicSize(svg: string) {
	const root = new DOMParser().parseFromString(
		svg,
		"image/svg+xml",
	).documentElement;
	if (!(root instanceof SVGSVGElement)) return svg;

	const { width, height } = root.viewBox.baseVal;
	if (width <= 0 || height <= 0) return svg;

	// Mermaid emits responsive SVGs with width="100%". An image needs
	// intrinsic dimensions to avoid the browser's default 300px width.
	root.setAttribute("width", String(width));
	root.setAttribute("height", String(height));
	return new XMLSerializer().serializeToString(root);
}

export function renderMermaidPreview(
	source: string,
	mode: "light" | "dark",
	signal: AbortSignal,
): Promise<RenderedMermaid | undefined> {
	// Mermaid shares configuration across renders. Wait for the previous
	// render before changing its theme.
	const preview = renderQueue.then(async () => {
		if (signal.aborted) return;
		try {
			mermaid.initialize({
				startOnLoad: false,
				securityLevel: "strict",
				htmlLabels: false,
				suppressErrorRendering: true,
				theme: mode === "dark" ? "dark" : "neutral",
				secure: [
					"secure",
					"securityLevel",
					"startOnLoad",
					"maxTextSize",
					"maxEdges",
					"htmlLabels",
					"flowchart",
					"suppressErrorRendering",
				],
			});
			const { svg } = await mermaid.render(
				`genielm-diagram-${++nextId}`,
				source,
			);
			const image = new Image();
			// An SVG loaded as an image has no active script or links.
			image.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgWithIntrinsicSize(svg))}`;
			await image.decode();
			if (
				!signal.aborted &&
				image.naturalWidth > 0 &&
				image.naturalHeight > 0
			) {
				return {
					src: image.src,
					width: image.naturalWidth,
					height: image.naturalHeight,
				};
			}
		} catch {
			// Invalid diagrams keep the copyable source rendered by Markdown.
		}
	});
	renderQueue = preview.then(() => {});
	return preview;
}
