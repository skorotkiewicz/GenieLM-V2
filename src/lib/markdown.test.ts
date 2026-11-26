import { expect, test } from "bun:test";
import { renderChatMarkdown, renderMarkdown } from "./markdown";

test("renders GFM-style content without executing raw HTML", () => {
	const html = renderMarkdown(
		"# Title\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>",
	);

	expect(html).toContain("<h1>Title</h1>");
	expect(html).toContain("<table>");
	expect(html).not.toContain("<script>");
	expect(html).toContain("&lt;script&gt;");
});

test("syntax-highlights supported fenced-code languages", () => {
	const html = renderMarkdown("```javascript\nconst answer = 42;\n```");

	expect(html).toContain('<pre class="hljs">');
	expect(html).toContain('<span class="copy-code-holder">');
	expect(html).toContain('<button type="button" class="copy-code"');
	expect(html).toContain('<span class="hljs-keyword">const</span>');
});

test("copyable unknown-language blocks remain escaped", () => {
	const html = renderMarkdown("```unknown\n<script>alert(1)</script>\n```");

	expect(html).toContain('class="copy-code"');
	expect(html).not.toContain("<script>");
	expect(html).toContain("&lt;script&gt;");
});

test("renders inline and display KaTeX", () => {
	const inline = renderMarkdown("Energy is $E = mc^2$.");
	const display = renderMarkdown("$$\nE = mc^2\n$$");

	expect(inline).toContain('class="katex"');
	expect(display).toContain("class='katex-block'");
});

test("renders old latex fences as KaTeX instead of code", () => {
	const html = renderMarkdown("```latex\nE = mc^2\n```");

	expect(html).toContain("class='katex-block'");
	expect(html).not.toContain("copy-code");
});

test("turns named Markdown and code fences into artifacts while keeping regular snippets inline", () => {
	const response = [
		"Here are the release notes.",
		"",
		'````markdown title="Release notes"',
		"# Changes",
		"",
		"```js",
		"console.log('inside the document');",
		"```",
		"```tex",
		"x = 1",
		"```",
		"````",
		"",
		'```typescript title="index.ts"',
		"export const count = 1;",
		"```",
		"",
		"```js",
		"const example = 42;",
		"```",
		"",
		"```tex",
		"E = mc^2",
		"```",
	].join("\n");

	const { html, artifacts } = renderChatMarkdown(response);

	expect(artifacts.map(({ title, kind }) => ({ title, kind }))).toEqual([
		{ title: "Release notes", kind: "document" },
		{ title: "index.ts", kind: "code" },
		{ title: "Code block 3", kind: "code" },
	]);
	expect(artifacts[0].content).toContain("```js");
	expect(artifacts[0].content).toContain("```tex");
	expect(artifacts[1].content).toBe("export const count = 1;\n");
	expect(html).toContain("Here are the release notes.");
	expect(html).toContain("const</span> example");
	expect(html).toContain("katex-block");
	expect(html).not.toContain("inside the document");
	expect(html).not.toContain("export const count");
});
