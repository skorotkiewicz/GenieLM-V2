import { jsonSchema, tool } from "ai";
import { searchKnowledge } from "../knowledge";

type SearchKnowledgeInput = { query: string };

export async function findKnowledge(query: string) {
	const cleanQuery = typeof query === "string" ? query.trim() : "";
	if (!cleanQuery || cleanQuery.length > 500)
		return "Error: Query must be 1-500 characters.";

	try {
		const results = await searchKnowledge(cleanQuery);
		if (!results.length)
			return "No personal knowledge documents have been indexed.";

		return results
			.map(
				(result, index) =>
					`[${index + 1}] Source: ${result.name}\n${result.content}\nDistance: ${result.distance.toFixed(4)}`,
			)
			.join("\n\n");
	} catch {
		return "Error: The local knowledge store is unavailable.";
	}
}

export const searchPersonalKnowledge = tool({
	description:
		"Search the user's private local documents and saved memories for relevant context. Call at the start of each user turn unless the user asks to skip local knowledge. Cite source filenames when using the results.",
	inputSchema: jsonSchema<SearchKnowledgeInput>({
		type: "object",
		properties: { query: { type: "string", minLength: 1, maxLength: 500 } },
		required: ["query"],
		additionalProperties: false,
	}),
	execute: ({ query }) => findKnowledge(query),
});
