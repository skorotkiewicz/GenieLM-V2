import {
	completeLogin,
	getSession,
	openaiAuthHeaders,
} from "@openai-oauth/web";
import { useEffect, useRef, useState } from "react";
import {
	type Chat,
	defaultProvider,
	type Message,
	restoreChatState,
} from "./chat-storage";
import { readChatStream } from "./chat-stream";

export type SelectChat = (id: string | null, replace?: boolean) => void;

export function useConversations(
	chatId: string | undefined,
	selectChat: SelectChat,
) {
	const [chats, setChats] = useState<Chat[]>([]);
	const [draft, setDraft] = useState("");
	const [provider, setProvider] = useState(defaultProvider);
	const [loaded, setLoaded] = useState(false);
	const [oauthSignedIn, setOAuthSignedIn] = useState(false);
	const [authMessage, setAuthMessage] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
	const request = useRef<{
		controller: AbortController;
		chatId?: string;
	} | null>(null);
	const activeChat = chats.find((chat) => chat.id === chatId);
	const providerReady =
		provider.type === "oauth"
			? oauthSignedIn && !!provider.oauthModel.trim()
			: !!provider.baseURL.trim() && !!provider.compatibleModel.trim();

	useEffect(() => {
		let mounted = true;
		async function initialize() {
			try {
				const session = (await completeLogin()) ?? (await getSession());
				if (mounted) setOAuthSignedIn(!!session);
			} catch (error) {
				if (mounted)
					setAuthMessage(
						error instanceof Error ? error.message : "ChatGPT sign-in failed.",
					);
			}
			if (!mounted) return;

			const requestedId =
				new URLSearchParams(window.location.search).get("chat") ?? undefined;
			const restored = restoreChatState(
				(key) => readStorage("localStorage", key),
				(key) => readStorage("sessionStorage", key),
				requestedId,
			);
			setChats(restored.chats);
			setProvider(restored.provider);
			if (restored.activeId && !requestedId)
				selectChat(restored.activeId, true);
			setLoaded(true);
		}

		void initialize();
		return () => {
			mounted = false;
			request.current?.controller.abort();
		};
	}, [selectChat]);

	useEffect(() => {
		if (loaded)
			writeStorage("localStorage", "genielm-chats", JSON.stringify(chats));
	}, [chats, loaded]);

	useEffect(() => {
		if (!loaded) return;
		const { apiKey, ...settings } = provider;
		writeStorage("localStorage", "genielm-provider", JSON.stringify(settings));
		writeStorage("sessionStorage", "genielm-api-key", apiKey || null);
	}, [provider, loaded]);

	const activeId = activeChat?.id ?? null;
	useEffect(() => {
		if (loaded) writeStorage("localStorage", "genielm-active-chat", activeId);
	}, [activeId, loaded]);

	function deleteChat(id: string) {
		if (request.current?.chatId === id) request.current.controller.abort();
		setChats((items) => items.filter((item) => item.id !== id));
		if (activeChat?.id === id) {
			setDraft("");
			selectChat(null, true);
		}
	}

	function deleteMessage(index: number) {
		if (!activeChat || request.current?.chatId === activeChat.id) return;
		setChats((items) =>
			items.map((chat) =>
				chat.id !== activeChat.id
					? chat
					: {
							...chat,
							messages: chat.messages.filter(
								(_, messageIndex) => messageIndex !== index,
							),
						},
			),
		);
	}

	async function send(value: string, openProvider: () => void) {
		const content = value.trim();
		if (!loaded || !content || request.current) return;
		if (!providerReady) {
			openProvider();
			return;
		}

		const selectedProvider =
			provider.type === "oauth"
				? { type: "oauth", model: provider.oauthModel.trim() }
				: {
						type: "compatible",
						baseURL: provider.baseURL.trim(),
						model: provider.compatibleModel.trim(),
						apiKey: provider.apiKey,
					};
		const pending = {
			controller: new AbortController(),
			chatId: activeChat?.id,
		};
		request.current = pending;
		const { signal } = pending.controller;
		setIsSending(true);
		try {
			let headers: HeadersInit = { "content-type": "application/json" };
			if (selectedProvider.type === "oauth") {
				try {
					headers = await openaiAuthHeaders({ headers });
				} catch (error) {
					if (!signal.aborted) {
						setAuthMessage(
							error instanceof Error
								? error.message
								: "Provider authentication failed.",
						);
						openProvider();
					}
					return;
				}
			}
			if (signal.aborted) return;

			const isNew = !activeChat;
			const chat = activeChat ?? {
				id: crypto.randomUUID(),
				title: content.slice(0, 48),
				createdAt: Date.now(),
				messages: [],
			};
			pending.chatId = chat.id;
			const messages: Message[] = [
				...chat.messages,
				{ id: crypto.randomUUID(), role: "user", content },
			];
			const answer: Message = {
				id: crypto.randomUUID(),
				role: "assistant",
				content: "",
			};
			const nextChat = { ...chat, messages: [...messages, answer] };
			setChats((items) =>
				isNew
					? [nextChat, ...items]
					: items.map((item) => (item.id === chat.id ? nextChat : item)),
			);
			setDraft((current) => (current === value ? "" : current));
			setStreamingChatId(chat.id);

			if (isNew) {
				selectChat(chat.id, true);
				void summarizeTitle(chat.id, content, selectedProvider, headers);
			}

			function updateAnswer() {
				const snapshot = { ...answer };
				setChats((items) =>
					items.map((item) =>
						item.id === chat.id
							? { ...item, messages: [...messages, snapshot] }
							: item,
					),
				);
			}

			try {
				const response = await fetch("/api/chat", {
					method: "POST",
					signal,
					headers,
					body: JSON.stringify({
						provider: selectedProvider,
						messages: messages.map((message) => ({
							id: message.id,
							role: message.role,
							parts: [{ type: "text", text: message.content }],
						})),
					}),
				});
				if (!response.ok || !response.body) throw new Error("Request failed");
				await readChatStream(response.body, (event) => {
					if (event.type === "tool-status") {
						const calls = answer.toolCalls ?? [];
						answer.toolCalls = calls.some((call) => call.id === event.call.id)
							? calls.map((call) =>
									call.id === event.call.id ? event.call : call,
								)
							: [...calls, event.call];
					} else if (event.type === "reasoning-delta") {
						answer.reasoning = (answer.reasoning ?? "") + event.text;
					} else {
						answer.content += event.text;
					}
					updateAnswer();
				});
				if (!answer.content) throw new Error("Empty response");
			} catch {
				if (!answer.content) {
					answer.content = signal.aborted
						? "Response stopped."
						: "Sorry, I could not reach the selected model. Please check your provider settings.";
					updateAnswer();
				}
			}
		} finally {
			request.current = null;
			setIsSending(false);
			setStreamingChatId(null);
		}
	}

	async function summarizeTitle(
		chatId: string,
		prompt: string,
		provider: object,
		headers: HeadersInit,
	) {
		try {
			const response = await fetch("/api/title", {
				method: "POST",
				headers,
				body: JSON.stringify({ provider, prompt }),
			});
			if (!response.ok) return;
			const { title } = await response.json();
			if (typeof title !== "string" || !title) return;
			setChats((items) =>
				items.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)),
			);
		} catch {
			// Keep the draft title when the provider cannot summarize it.
		}
	}

	return {
		chats,
		activeChat,
		draft,
		setDraft,
		provider,
		setProvider,
		providerReady,
		loaded,
		oauthSignedIn,
		setOAuthSignedIn,
		authMessage,
		setAuthMessage,
		isSending,
		streamingChatId,
		send,
		stop: () => request.current?.controller.abort(),
		deleteChat,
		deleteMessage,
	};
}

function readStorage(storage: "localStorage" | "sessionStorage", key: string) {
	try {
		return window[storage].getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(
	storage: "localStorage" | "sessionStorage",
	key: string,
	value: string | null,
) {
	try {
		if (value === null) window[storage].removeItem(key);
		else window[storage].setItem(key, value);
	} catch {
		// Chat remains usable when browser storage is blocked or full.
	}
}
