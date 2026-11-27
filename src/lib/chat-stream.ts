export type ChatToolCall = {
	id: string;
	name: string;
	status: "pending" | "running" | "complete" | "error";
};

export type ChatStreamEvent =
	| { type: "reasoning-delta" | "text-delta"; text: string }
	| { type: "tool-status"; call: ChatToolCall }
	| { type: "model-info"; model: string };

type ModelStreamPart = {
	type: string;
	text?: string;
	id?: string;
	toolCallId?: string;
	toolName?: string;
	output?: unknown;
	preliminary?: boolean;
	response?: { modelId?: string };
};

export function isChatToolCall(value: unknown): value is ChatToolCall {
	if (!value || typeof value !== "object") return false;
	const { id, name, status } = value as Partial<ChatToolCall>;
	return (
		typeof id === "string" &&
		typeof name === "string" &&
		(status === "pending" ||
			status === "running" ||
			status === "complete" ||
			status === "error")
	);
}

function toChatStreamEvent(part: ModelStreamPart): ChatStreamEvent | undefined {
	if (part.type === "finish-step") {
		const model = part.response?.modelId?.trim();
		if (model) return { type: "model-info", model };
		return;
	}

	if (part.type === "reasoning-delta" || part.type === "text-delta") {
		if (typeof part.text === "string")
			return { type: part.type, text: part.text };
		return;
	}

	const id = part.type === "tool-input-start" ? part.id : part.toolCallId;
	const name = part.toolName;
	if (!id || !name) return;

	let status: ChatToolCall["status"];
	switch (part.type) {
		case "tool-input-start":
			status = "pending";
			break;
		case "tool-call":
			status = "running";
			break;
		case "tool-result":
			if (part.preliminary) return;
			status =
				typeof part.output === "string" && part.output.startsWith("Error:")
					? "error"
					: "complete";
			break;
		case "tool-error":
		case "tool-output-denied":
			status = "error";
			break;
		default:
			return;
	}
	return { type: "tool-status", call: { id, name, status } };
}

export function createChatStreamResponse(
	source: AsyncIterable<ModelStreamPart>,
) {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for await (const part of source) {
					const event = toChatStreamEvent(part);
					if (event)
						controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
				}
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
	});

	return new Response(stream, {
		headers: {
			"cache-control": "no-cache",
			"content-type": "application/x-ndjson; charset=utf-8",
		},
	});
}

function parseChatStreamEvent(line: string): ChatStreamEvent {
	const event: unknown = JSON.parse(line);
	if (!event || typeof event !== "object")
		throw new Error("Invalid chat stream event.");

	const { type, text, call, model } = event as Record<string, unknown>;
	if (
		(type === "reasoning-delta" || type === "text-delta") &&
		typeof text === "string"
	)
		return { type, text };
	if (type === "tool-status" && isChatToolCall(call)) return { type, call };
	if (type === "model-info" && typeof model === "string" && model.trim())
		return { type, model };

	throw new Error("Invalid chat stream event.");
}

export async function readChatStream(
	stream: ReadableStream<Uint8Array>,
	onEvent: (event: ChatStreamEvent) => void | Promise<void>,
) {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

		let newline = buffer.indexOf("\n");
		while (newline !== -1) {
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);
			if (line) await onEvent(parseChatStreamEvent(line));
			newline = buffer.indexOf("\n");
		}

		if (done) break;
	}

	if (buffer.trim()) await onEvent(parseChatStreamEvent(buffer));
}
