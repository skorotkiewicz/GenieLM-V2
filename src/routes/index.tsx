import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { GenieShell } from "#/app/shell-side-nav/page";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): { chat?: string } => ({
		chat:
			typeof search.chat === "string" && search.chat ? search.chat : undefined,
	}),
	component: Home,
});

function Home() {
	const { chat } = Route.useSearch();
	const navigate = Route.useNavigate();
	const selectChat = useCallback(
		(id: string | null, replace = false) => {
			void navigate({
				search: { chat: id ?? undefined },
				replace,
				resetScroll: false,
			});
		},
		[navigate],
	);
	return <GenieShell chatId={chat} selectChat={selectChat} />;
}
