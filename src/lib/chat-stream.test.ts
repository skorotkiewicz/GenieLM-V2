import { expect, test } from "bun:test";
import {
	type ChatStreamEvent,
	createChatStreamResponse,
	readChatStream,
} from "./chat-stream";

test("streams reasoning, answer text, and the provider's model ID separately", async () => {
	async function* modelStream() {
		yield { type: "reasoning-start" };
		yield { type: "reasoning-delta", text: "Check " };
		yield { type: "reasoning-delta", text: "the facts." };
		yield { type: "text-delta", text: "The answer." };
		yield { type: "finish-step", response: { modelId: "provider-model" } };
		yield { type: "finish" };
	}

	const response = createChatStreamResponse(modelStream());
	const events: ChatStreamEvent[] = [];
	if (!response.body) throw new Error("Expected a response stream");
	await readChatStream(response.body, (event) => {
		events.push(event);
	});

	expect(events).toEqual([
		{ type: "reasoning-delta", text: "Check " },
		{ type: "reasoning-delta", text: "the facts." },
		{ type: "text-delta", text: "The answer." },
		{ type: "model-info", model: "provider-model" },
	]);
});

test("streams tool activity with stable IDs and statuses", async () => {
	async function* modelStream() {
		yield { type: "tool-input-start", id: "weather-1", toolName: "getWeather" };
		yield {
			type: "tool-call",
			toolCallId: "weather-1",
			toolName: "getWeather",
			input: { location: "Fixture city" },
		};
		yield { type: "tool-call", toolCallId: "search-1", toolName: "webSearch" };
		yield {
			type: "tool-result",
			toolCallId: "weather-1",
			toolName: "getWeather",
			output: "Partly cloudy",
			preliminary: true,
		};
		yield {
			type: "tool-result",
			toolCallId: "weather-1",
			toolName: "getWeather",
			output: "Partly cloudy",
		};
		yield {
			type: "tool-result",
			toolCallId: "search-1",
			toolName: "webSearch",
			output: "Error: The search timed out.",
		};
		yield { type: "tool-error", toolCallId: "fetch-1", toolName: "webFetch" };
		yield { type: "text-delta", text: "The weather is partly cloudy." };
	}

	const response = createChatStreamResponse(modelStream());
	if (!response.body) throw new Error("Expected a response stream");
	const events: ChatStreamEvent[] = [];
	await readChatStream(response.body, (event) => {
		events.push(event);
	});

	expect(events).toEqual([
		{
			type: "tool-status",
			call: { id: "weather-1", name: "getWeather", status: "pending" },
		},
		{
			type: "tool-status",
			call: { id: "weather-1", name: "getWeather", status: "running" },
		},
		{
			type: "tool-status",
			call: { id: "search-1", name: "webSearch", status: "running" },
		},
		{
			type: "tool-status",
			call: { id: "weather-1", name: "getWeather", status: "complete" },
		},
		{
			type: "tool-status",
			call: { id: "search-1", name: "webSearch", status: "error" },
		},
		{
			type: "tool-status",
			call: { id: "fetch-1", name: "webFetch", status: "error" },
		},
		{ type: "text-delta", text: "The weather is partly cloudy." },
	]);
});

test("reads events split across network chunks", async () => {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode('{"type":"reason'));
			controller.enqueue(
				encoder.encode('ing-delta","text":"work"}\n{"type":"text-delta"'),
			);
			controller.enqueue(encoder.encode(',"text":"done"}'));
			controller.close();
		},
	});
	const events: ChatStreamEvent[] = [];

	await readChatStream(stream, (event) => {
		events.push(event);
	});

	expect(events).toEqual([
		{ type: "reasoning-delta", text: "work" },
		{ type: "text-delta", text: "done" },
	]);
});
