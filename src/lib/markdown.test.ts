import { expect, test } from "bun:test";
import { getChatArtifact, renderChatMarkdown, renderMarkdown } from "./markdown";

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
		"```",
		'NAME="Alpine Linux"',
		"```",
		"",
		'> ```sh title="Nested example"',
		"> echo nested",
		"> ```",
		"",
		"```tex",
		"E = mc^2",
		"```",
	].join("\n");

	const { html, artifacts } = renderChatMarkdown(response);

	expect(artifacts.map(({ title, kind }) => ({ title, kind }))).toEqual([
		{ title: "Release notes", kind: "document" },
		{ title: "index.ts", kind: "code" },
	]);
	expect(artifacts[0].content).toContain("```js");
	expect(artifacts[0].content).toContain("```tex");
	expect(artifacts[1].content).toBe("export const count = 1;\n");
	expect(html).toContain("Here are the release notes.");
	expect(html).toContain("const</span> example");
	expect(html).toContain("Alpine Linux");
	expect(html).toContain("nested");
	expect(getChatArtifact(response, artifacts[1].id)).toEqual(artifacts[1]);
	expect(html).toContain("katex-block");
	expect(html).not.toContain("inside the document");
	expect(html).not.toContain("export const count");
});

test("promotes HTML to an artifact when the model titles the fence", () => {
	const page = "<!doctype html>\n<h1>Artifact preview</h1>\n";
	const content = [
		'```html title="index.html"',
		page.trimEnd(),
		"```",
		"",
		"```html",
		"<p>Inline example</p>",
		"```",
	].join("\n");
	const { html, artifacts } = renderChatMarkdown(content);

	expect(artifacts).toEqual([
		{
			id: 0,
			title: "index.html",
			kind: "code",
			language: "html",
			content: page,
		},
	]);
	expect(html).not.toContain("Artifact preview");
	expect(html).toContain("Inline example");
});

test("marks Mermaid fences for chat previews and retains their source as artifacts", () => {
	const source = "flowchart LR\n  A --> B\n";
	const content = [
		"Before",
		"",
		'```mermaid title="Workflow"',
		source.trimEnd(),
		"```",
		"",
		"After",
	].join("\n");
	const { html, artifacts, diagrams } = renderChatMarkdown(content);

	expect(html).toContain('<figure data-genielm-mermaid="2">');
	expect(html.indexOf("Before")).toBeLessThan(html.indexOf("<figure"));
	expect(html.indexOf("</figure>")).toBeLessThan(html.indexOf("After"));
	expect(artifacts).toEqual([
		{
			id: 2,
			title: "Workflow",
			kind: "code",
			language: "mermaid",
			content: source,
		},
	]);
	expect(diagrams).toEqual(artifacts);
	expect(renderMarkdown(content)).not.toContain("data-genielm-mermaid");
});
