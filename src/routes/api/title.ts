import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { modelForRequest } from "#/lib/server/provider";

const POST = async ({ request }: { request: Request }) => {
	let prompt: unknown;
	let provider: unknown;

	try {
		({ prompt, provider } = await request.json());
	} catch {
		return Response.json({ error: "Invalid request body." }, { status: 400 });
	}

	if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 10_000) {
		return Response.json(
			{ error: "Prompt must be a non-empty string." },
			{ status: 400 },
		);
	}

	let model: ReturnType<typeof modelForRequest>;
	try {
		model = modelForRequest(request, provider);
	} catch {
		return Response.json(
			{ error: "Invalid or unsigned provider configuration." },
			{ status: 400 },
		);
	}

	try {
		const { text } = await generateText({
			model,
			abortSignal: request.signal,
			system:
				"Create a concise 3-7 word sidebar title summarizing the user request. Return only the title, without quotes, punctuation, or Markdown.",
			prompt,
			temperature: 0,
			maxOutputTokens: 24,
			timeout: 30_000,
		});
		const title = text
			.trim()
			.split("\n")[0]
			.replace(/^#+\s*/, "")
			.replace(/^["'`]|["'`.!?]+$/g, "")
			.trim()
			.slice(0, 60);

		if (!title) throw new Error("Empty title");
		return Response.json({ title });
	} catch {
		return Response.json(
			{ error: "The selected provider could not create a title." },
			{ status: 502 },
		);
	}
};

export const Route = createFileRoute("/api/title")({
	server: { handlers: { POST } },
});
