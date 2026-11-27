import { expect, test } from "bun:test";
import { restoreChatState } from "./chat-storage";

const legacyChat = {
	id: "saved",
	title: "Saved conversation",
	createdAt: 123456789,
	messages: [
		{ role: "assistant" as const, content: "Hello", reasoning: "A thought" },
	],
};

test("restores Svelte history and provider settings with the API key from the current tab", () => {
	const storage = new Map([
		["genielm-chats", JSON.stringify([legacyChat])],
		["genielm-active-chat", "saved"],
		[
			"genielm-provider",
			JSON.stringify({ type: "compatible", apiKey: "obsolete" }),
		],
	]);
	const result = restoreChatState(
		(key) => storage.get(key),
		(key) => (key === "genielm-api-key" ? "tab-key" : null),
		undefined,
	);

	expect(result.chats).toEqual([
		{ ...legacyChat, messages: [{ ...legacyChat.messages[0], id: "saved-0" }] },
	]);
	expect(result.activeId).toBe("saved");
	expect(result.provider.apiKey).toBe("tab-key");
});

test("keeps the home view when a URL names a missing conversation", () => {
	const storage = new Map([
		["genielm-chats", JSON.stringify([legacyChat])],
		["genielm-active-chat", "saved"],
	]);
	const result = restoreChatState(
		(key) => storage.get(key),
		() => null,
		"missing",
	);
	expect(result.chats).toHaveLength(1);
	expect(result.activeId).toBeNull();
});

test("keeps each reply's model when restoring a mixed conversation", () => {
	const messages = [
		...legacyChat.messages,
		{ id: "a", role: "assistant", content: "First answer", model: "model-a" },
		{ id: "b", role: "assistant", content: "Second answer", model: "model-b" },
	];
	const storage = new Map([
		["genielm-chats", JSON.stringify([{ ...legacyChat, messages }])],
		["genielm-provider", JSON.stringify({ compatibleModel: "model-c" })],
	]);
	const result = restoreChatState(
		(key) => storage.get(key),
		() => null,
		"saved",
	);

	expect(result.chats[0].messages.map((message) => message.model)).toEqual([
		undefined,
		"model-a",
		"model-b",
	]);
});
