export type Message = {
	id: string;
	role: "user" | "assistant";
	content: string;
	reasoning?: string;
};

export type Chat = {
	id: string;
	title: string;
	createdAt: number;
	messages: Message[];
};

export type ProviderSettings = {
	type: "compatible" | "oauth";
	baseURL: string;
	compatibleModel: string;
	oauthModel: string;
	apiKey: string;
};

export const defaultProvider: ProviderSettings = {
	type: "compatible",
	baseURL: "",
	compatibleModel: "",
	oauthModel: "gpt-5.4-mini",
	apiKey: "",
};

type StorageReader = (key: string) => string | null | undefined;

function parseStored(read: StorageReader, key: string): unknown {
	try {
		return JSON.parse(read(key) ?? "null");
	} catch {
		return null;
	}
}

type StoredMessage = Omit<Message, "id"> & { id?: string };
type StoredChat = Omit<Chat, "messages"> & { messages: StoredMessage[] };

function isMessage(value: unknown): value is StoredMessage {
	if (!value || typeof value !== "object") return false;
	const message = value as Partial<Message>;
	return (
		(message.role === "user" || message.role === "assistant") &&
		typeof message.content === "string" &&
		(message.id === undefined || typeof message.id === "string") &&
		(message.reasoning === undefined || typeof message.reasoning === "string")
	);
}

function isChat(value: unknown): value is StoredChat {
	if (!value || typeof value !== "object") return false;
	const chat = value as Partial<Chat>;
	return (
		typeof chat.id === "string" &&
		typeof chat.title === "string" &&
		typeof chat.createdAt === "number" &&
		Array.isArray(chat.messages) &&
		chat.messages.every(isMessage)
	);
}

export function restoreChatState(
	readLocal: StorageReader,
	readSession: StorageReader,
	requestedId: string | undefined,
) {
	const storedChats = parseStored(readLocal, "genielm-chats");
	const chats: Chat[] = Array.isArray(storedChats)
		? storedChats.filter(isChat).map((chat) => ({
				...chat,
				messages: chat.messages.map((message, index) => ({
					...message,
					id: message.id ?? `${chat.id}-${index}`,
				})),
			}))
		: [];
	const storedProvider = parseStored(
		readLocal,
		"genielm-provider",
	) as Partial<ProviderSettings> | null;
	const provider = { ...defaultProvider };
	if (storedProvider?.type === "oauth") provider.type = "oauth";
	for (const key of ["baseURL", "compatibleModel", "oauthModel"] as const) {
		const value = storedProvider?.[key];
		if (typeof value === "string") provider[key] = value;
	}
	provider.apiKey = readSession("genielm-api-key") ?? "";
	const id = requestedId ?? readLocal("genielm-active-chat");

	return {
		chats,
		provider,
		activeId: chats.some((chat) => chat.id === id) ? (id ?? null) : null,
	};
}

function historyLabel(timestamp: number) {
	const date = new Date(timestamp);
	const today = new Date();
	const startOfToday = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
	).getTime();
	const startOfDate = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	).getTime();
	const age = Math.round((startOfToday - startOfDate) / 86_400_000);

	if (age === 0) return "Today";
	if (age === 1) return "Yesterday";
	if (age < 7) return "Last 7 Days";
	return date.toLocaleString(undefined, { month: "long" });
}

export function groupHistory(chats: Chat[]) {
	const groups = new Map<string, Chat[]>();
	for (const chat of chats) {
		const label = historyLabel(chat.createdAt);
		const group = groups.get(label);
		if (group) group.push(chat);
		else groups.set(label, [chat]);
	}
	return groups;
}
