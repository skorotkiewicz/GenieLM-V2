import {
	CodeBlock,
	type CodeLanguageToken,
	createCodeLanguage,
} from "@astryxdesign/core/CodeBlock";
import hljs from "highlight.js/lib/common";
import type { ChatArtifact } from "#/lib/markdown";

const syntaxTokens = new Map([
	["hljs-tag", "tag"],
	["hljs-name", "tag"],
	["hljs-attr", "attribute"],
	["hljs-attribute", "property"],
	["hljs-selector-tag", "tag"],
	["hljs-selector-class", "type"],
	["hljs-selector-id", "type"],
	["hljs-selector-pseudo", "type"],
	["hljs-selector-attr", "attribute"],
	["hljs-meta", "keyword"],
	["hljs-keyword", "keyword"],
	["hljs-string", "string"],
	["hljs-regexp", "string"],
	["hljs-comment", "comment"],
	["hljs-number", "number"],
	["hljs-literal", "constant"],
	["hljs-built_in", "function"],
	["hljs-title", "function"],
	["hljs-type", "type"],
	["hljs-operator", "operator"],
]);

const htmlLanguage = createCodeLanguage({
	name: "HTML",
	identifiers: ["html"],
	tokenize(code) {
		if (typeof DOMParser === "undefined") return [];
		// Highlight.js escapes the source and recognizes CSS and JavaScript inside HTML.
		const markup = hljs.highlight(code, { language: "html" }).value;
		const document = new DOMParser().parseFromString(
			`<body>${markup}`,
			"text/html",
		);
		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_TEXT,
		);
		const tokens: CodeLanguageToken[] = [];
		let start = 0;
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const end = start + (node.nodeValue?.length ?? 0);
			const scope = node.parentElement?.closest("[class^='hljs-']");
			const type = syntaxTokens.get(scope?.classList[0] ?? "");
			if (type && end > start) tokens.push({ type, start, end });
			start = end;
		}
		return start === code.length ? tokens : [];
	},
});

export function ArtifactCode({ artifact }: { artifact: ChatArtifact }) {
	return (
		<CodeBlock
			code={artifact.content}
			language={
				artifact.language === "html"
					? htmlLanguage
					: artifact.language || "plaintext"
			}
			width="100%"
			container="section"
			highlightMode="spans"
			hasLineNumbers
			hasLanguageLabel={false}
			hasCopyButton={false}
		/>
	);
}
