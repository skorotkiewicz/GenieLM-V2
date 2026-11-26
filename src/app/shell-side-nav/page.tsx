// Copyright (c) Meta Platforms, Inc. and affiliates.

import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { useClipboard, useContainerReveal } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent, LayoutHeader } from "@astryxdesign/core/Layout";
import { MobileNavToggle } from "@astryxdesign/core/MobileNav";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import {
	SideNav,
	SideNavHeading,
	SideNavItem,
	SideNavSection,
} from "@astryxdesign/core/SideNav";
import { HStack, Stack, StackItem } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { useToast } from "@astryxdesign/core/Toast";
import {
	BookOpen,
	MessageSquare,
	Plus,
	Settings,
	Share,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ChatPane } from "#/app/ai-chat/page";
import { type Chat, groupHistory } from "#/lib/chat-storage";
import { type SelectChat, useConversations } from "#/lib/use-conversations";
import { KnowledgeDialog } from "./knowledge-dialog";
import { ProviderDialog } from "./provider-dialog";

export function GenieShell({
	chatId,
	selectChat,
}: {
	chatId?: string;
	selectChat: SelectChat;
}) {
	const [isMobileNavOpen, setMobileNavOpen] = useState(false);
	const [dialog, setDialog] = useState<"provider" | "knowledge" | null>(null);
	const confirm = useImperativeAlertDialog();
	const showToast = useToast();
	const { copy } = useClipboard({ announce: "Copied" });
	const app = useConversations(chatId, selectChat);
	const history = useMemo(() => groupHistory(app.chats), [app.chats]);
	const model = app.providerReady
		? (app.provider.type === "oauth"
				? app.provider.oauthModel
				: app.provider.compatibleModel
			).trim()
		: "";
	const providerStatus = !app.loaded
		? "Loading provider"
		: app.providerReady
			? "Provider configured"
			: "Provider setup required";

	function openDialog(type: "provider" | "knowledge") {
		setMobileNavOpen(false);
		setDialog(type);
	}

	function newChat() {
		app.setDraft("");
		selectChat(null);
		setMobileNavOpen(false);
	}

	function deleteChat(chat: Chat) {
		confirm.show({
			title: `Delete ${chat.title}?`,
			description:
				"This permanently removes the conversation from this browser.",
			actionLabel: "Delete",
			onAction: () => {
				app.deleteChat(chat.id);
				confirm.hide();
			},
		});
	}

	function deleteMessage(index: number) {
		confirm.show({
			title: "Delete this message?",
			description: "The message will be removed from the conversation.",
			actionLabel: "Delete",
			onAction: () => {
				app.deleteMessage(index);
				confirm.hide();
			},
		});
	}

	async function shareChat() {
		const chat = app.activeChat;
		if (!chat) return;
		const text = `# ${chat.title}\n\n${chat.messages
			.map(
				(message) =>
					`## ${message.role === "user" ? "You" : "GenieLM"}\n\n${message.content}`,
			)
			.join("\n\n")}`;
		try {
			if (
				navigator.share &&
				(!navigator.canShare || navigator.canShare({ text }))
			) {
				await navigator.share({ title: chat.title, text });
				showToast({ body: "Conversation shared", uniqueID: "share" });
			} else {
				const copied = await copy(text);
				showToast({
					body: copied
						? "Conversation copied as Markdown"
						: "Could not copy the conversation",
					uniqueID: "share",
				});
			}
		} catch (error) {
			if (!(error instanceof DOMException && error.name === "AbortError")) {
				showToast({
					body: "Could not share the conversation",
					uniqueID: "share",
				});
			}
		}
	}

	return (
		<AppShell
			contentPadding={0}
			mobileNav={{
				isOpen: isMobileNavOpen,
				onOpenChange: setMobileNavOpen,
				hasToggle: false,
			}}
			sideNav={
				<SideNav
					collapsible
					resizable={{ defaultWidth: 300, minWidth: 220, maxWidth: 420 }}
					header={
						<SideNavHeading
							heading="GenieLM"
							icon={
								<Avatar
									src="/favicon.svg"
									name="GenieLM"
									size={32}
									shape="rounded"
									tooltip={false}
								/>
							}
						/>
					}
					footer={
						<SideNavSection title="Settings" isHeaderHidden>
							<SideNavItem
								label="Local knowledge"
								icon={BookOpen}
								onClick={() => openDialog("knowledge")}
							/>
							<SideNavItem
								label="Provider settings"
								icon={Settings}
								endContent={
									<StatusDot
										variant={model ? "success" : "neutral"}
										label={providerStatus}
										tooltip={providerStatus}
									/>
								}
								onClick={() => openDialog("provider")}
							/>
						</SideNavSection>
					}
				>
					<SideNavSection title="Menu" isHeaderHidden>
						<SideNavItem label="New chat" icon={Plus} onClick={newChat} />
					</SideNavSection>
					<Divider />
					{history.size ? (
						Array.from(history, ([label, chats]) => (
							<SideNavSection key={label} title={label}>
								{chats.map((chat) => (
									<ConversationItem
										key={chat.id}
										chat={chat}
										isSelected={chat.id === app.activeChat?.id}
										onSelect={() => {
											selectChat(chat.id);
											setMobileNavOpen(false);
										}}
										onDelete={() => deleteChat(chat)}
									/>
								))}
							</SideNavSection>
						))
					) : (
						<SideNavSection title="Conversations">
							<Stack paddingInline={3} paddingBlock={1}>
								<Text as="p" color="secondary" type="supporting">
									{app.loaded
										? "No conversations yet."
										: "Loading conversations…"}
								</Text>
							</Stack>
						</SideNavSection>
					)}
				</SideNav>
			}
		>
			<Layout
				height="fill"
				header={
					<LayoutHeader hasDivider padding={3}>
						<HStack gap={2} vAlign="center">
							<MobileNavToggle label="Open chat history" />
							<StackItem size="fill">
								<Text
									as="p"
									weight="semibold"
									maxLines={1}
									wordBreak="break-word"
								>
									{app.activeChat?.title || "New chat"}
								</Text>
							</StackItem>
							{app.activeChat && (
								<Button
									label="Share conversation"
									tooltip="Share conversation"
									variant="ghost"
									size="sm"
									isIconOnly
									icon={<Icon icon={Share} size="sm" />}
									clickAction={shareChat}
								/>
							)}
							<Button
								label="Provider settings"
								tooltip="Provider settings"
								variant="ghost"
								size="sm"
								isIconOnly
								icon={<Icon icon={Settings} size="sm" />}
								isDisabled={!app.loaded}
								onClick={() => openDialog("provider")}
							/>
						</HStack>
					</LayoutHeader>
				}
				content={
					<LayoutContent padding={0} isScrollable={false}>
						<ChatPane
							chat={app.activeChat}
							draft={app.draft}
							model={model}
							loaded={app.loaded}
							isSending={app.isSending}
							isStreaming={
								app.streamingChatId !== null &&
								app.streamingChatId === app.activeChat?.id
							}
							onDraftChange={app.setDraft}
							onSubmit={(value) =>
								void app.send(value, () => openDialog("provider"))
							}
							onStop={app.stop}
							onOpenProvider={() => openDialog("provider")}
							onDeleteMessage={deleteMessage}
						/>
					</LayoutContent>
				}
			/>
			<ProviderDialog
				isOpen={dialog === "provider"}
				onOpenChange={(open) => setDialog(open ? "provider" : null)}
				provider={app.provider}
				onChange={app.setProvider}
				isReady={app.providerReady}
				isSignedIn={app.oauthSignedIn}
				onSignedInChange={app.setOAuthSignedIn}
				authMessage={app.authMessage}
				onAuthMessageChange={app.setAuthMessage}
			/>
			{dialog === "knowledge" && (
				<KnowledgeDialog onOpenChange={(open) => !open && setDialog(null)} />
			)}
			{confirm.element}
		</AppShell>
	);
}

function ConversationItem({
	chat,
	isSelected,
	onSelect,
	onDelete,
}: {
	chat: Chat;
	isSelected: boolean;
	onSelect: () => void;
	onDelete: () => void;
}) {
	const [isMenuOpen, setMenuOpen] = useState(false);
	const { getContainerProps, getContentRevealProps } = useContainerReveal();

	return (
		<Stack
			{...getContainerProps({ forceState: isMenuOpen ? "active" : undefined })}
		>
			<SideNavItem
				label={chat.title}
				icon={MessageSquare}
				href={`/?chat=${encodeURIComponent(chat.id)}`}
				onClick={(event) => {
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
						return;
					event.preventDefault();
					onSelect();
				}}
				isSelected={isSelected}
				actions={
					<Stack {...getContentRevealProps()}>
						<MoreMenu
							size="sm"
							label={`Options for ${chat.title}`}
							onOpenChange={setMenuOpen}
							items={[{ label: "Delete", icon: Trash2, onClick: onDelete }]}
						/>
					</Stack>
				}
			/>
		</Stack>
	);
}
