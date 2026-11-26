import { createFileRoute } from "@tanstack/react-router";
import {
	addKnowledgeDocument,
	deleteKnowledgeDocument,
	listKnowledgeDocuments,
} from "#/lib/server/knowledge";

const MAX_FILE_SIZE = 250_000;

const GET = () => {
	try {
		return Response.json({ documents: listKnowledgeDocuments() });
	} catch {
		return Response.json(
			{ error: "The local knowledge store is unavailable." },
			{ status: 503 },
		);
	}
};

const POST = async ({ request }: { request: Request }) => {
	const contentLength = Number(request.headers.get("content-length"));
	if (!Number.isSafeInteger(contentLength) || contentLength < 1) {
		return Response.json(
			{ error: "A bounded Content-Length is required." },
			{ status: 411 },
		);
	}
	if (contentLength > MAX_FILE_SIZE + 10_000) {
		return Response.json(
			{ error: "Document must be smaller than 250 KB." },
			{ status: 413 },
		);
	}

	try {
		const file = (await request.formData()).get("file");
		if (!(file instanceof File) || !file.size || file.size > MAX_FILE_SIZE) {
			return Response.json(
				{ error: "Select a document smaller than 250 KB." },
				{ status: 400 },
			);
		}

		const name = file.name.split(/[\\/]/).pop()?.slice(0, 200) ?? "";
		if (!/\.(?:md|txt)$/i.test(name)) {
			return Response.json(
				{ error: "Only Markdown and text documents are supported." },
				{ status: 400 },
			);
		}
		if (/^\[Memory\]\s/i.test(name)) {
			return Response.json(
				{ error: "The [Memory] namespace is reserved." },
				{ status: 400 },
			);
		}

		const content = await file.text();
		if (!content.trim())
			return Response.json({ error: "Document is empty." }, { status: 400 });

		const document = await addKnowledgeDocument(name, content);
		return Response.json({ document }, { status: 201 });
	} catch {
		return Response.json(
			{
				error:
					"Could not index the document. Check the local embedding model installation.",
			},
			{ status: 500 },
		);
	}
};

const DELETE = ({ request }: { request: Request }) => {
	const url = new URL(request.url);
	const id = Number(url.searchParams.get("id"));
	if (!Number.isSafeInteger(id) || id < 1) {
		return Response.json(
			{ error: "A valid document ID is required." },
			{ status: 400 },
		);
	}

	try {
		return deleteKnowledgeDocument(id)
			? new Response(null, { status: 204 })
			: Response.json({ error: "Document not found." }, { status: 404 });
	} catch {
		return Response.json(
			{ error: "Could not delete the document." },
			{ status: 500 },
		);
	}
};

export const Route = createFileRoute("/api/knowledge")({
	server: { handlers: { GET, POST, DELETE } },
});
