import mermaid from "mermaid";
import type { ChatArtifact } from "./markdown";

let nextId = 0;
let renderQueue = Promise.resolve();

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

export function renderMermaidPreviews(
	article: HTMLElement,
	diagrams: ChatArtifact[],
	mode: "light" | "dark",
	signal: AbortSignal,
) {
	for (const diagram of diagrams) {
		const figure = article.querySelector(
			`[data-genielm-mermaid="${diagram.id}"]`,
		);
		if (!figure) continue;

		// Mermaid shares a configuration across renders, so finish each render
		// before changing the theme for the next one.
		renderQueue = renderQueue.then(async () => {
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
					diagram.content,
				);
				const image = new Image();
				image.alt = diagram.title;
				// An SVG loaded as an image has no active script or links.
				image.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgWithIntrinsicSize(svg))}`;
				await image.decode();
				if (!signal.aborted && figure.isConnected)
					figure.replaceChildren(image);
			} catch {
				// Invalid diagrams keep the copyable source rendered by Markdown.
			}
		});
	}
}
