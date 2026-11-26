import { katex } from "@mdit/plugin-katex";
import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
	html: false,
	breaks: true,
	linkify: true,
});

markdown.options.highlight = (code, language) => {
	const highlighted =
		language && hljs.getLanguage(language)
			? hljs.highlight(code, { language, ignoreIllegals: true }).value
			: markdown.utils.escapeHtml(code);
	return `<pre class="hljs"><span class="copy-code-holder"><button type="button" class="copy-code" aria-label="Copy code">Copy</button></span><code>${highlighted}</code></pre>`;
};

markdown.use(katex, { delimiters: "all", mathFence: true });
markdown.core.ruler.after("block", "math_fence_alias", ({ tokens }) => {
	for (const token of tokens) {
		if (token.type === "fence" && /^(?:latex|tex)$/i.test(token.info.trim())) {
			token.info = "math";
		}
	}
});

export type ChatArtifact = {
	id: number;
	kind: "document" | "code";
	title: string;
	language: string;
	content: string;
};

export function renderMarkdown(content: string) {
	return markdown.render(content);
}

function parseChatMarkdown(content: string) {
	const env = {};
	const artifacts: ChatArtifact[] = [];
	const tokens = markdown.parse(content, env).filter((token) => {
		if (token.type !== "fence" || !token.map || !token.content.trim())
			return true;
		const info = token.info.trim();
		const [language = ""] = info.toLowerCase().split(/\s+/, 1);
		if (["math", "latex", "tex"].includes(language)) return true;

		const titleMatch = info.match(
			/(?:^|\s)title=(?:"([^"]+)"|'([^']+)')(?=\s|$)/i,
		);
		const title = (titleMatch?.[1] ?? titleMatch?.[2])?.trim().slice(0, 120);
		const isDocument = language === "markdown" || language === "md";
		artifacts.push({
			id: token.map[0],
			kind: isDocument ? "document" : "code",
			title:
				title ||
				(isDocument
					? "Markdown document"
					: `Code block ${artifacts.length + 1}`),
			language,
			content: token.content,
		});

		// A named top-level fence represents a standalone file.
		return !title || token.level !== 0;
	});
	return { tokens, env, artifacts };
}

export function renderChatMarkdown(content: string) {
	const { tokens, env, artifacts } = parseChatMarkdown(content);
	return {
		html: markdown.renderer.render(tokens, markdown.options, env),
		artifacts,
	};
}

export function getChatArtifact(content: string, id: number) {
	return parseChatMarkdown(content).artifacts.find(
		(artifact) => artifact.id === id,
	);
}
