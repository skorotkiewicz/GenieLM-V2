// Copyright (c) Meta Platforms, Inc. and affiliates.

import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import {
	ChatComposer,
	ChatComposerInput,
	ChatLayout,
	ChatMessage,
	ChatMessageBubble,
	ChatMessageList,
	ChatMessageMetadata,
	ChatSendButton,
} from "@astryxdesign/core/Chat";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { useClipboard } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useToast } from "@astryxdesign/core/Toast";
import { ChevronDown, Square, Trash2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chat, Message } from "#/lib/chat-storage";
import { renderMarkdown } from "#/lib/markdown";

type ChatPaneProps = {
	chat: Chat | undefined;
	draft: string;
	model: string;
	loaded: boolean;
	isSending: boolean;
	isStreaming: boolean;
	onDraftChange: (value: string) => void;
	onSubmit: (value: string) => void;
	onStop: () => void;
	onOpenProvider: () => void;
	onDeleteMessage: (index: number) => void;
};

export function ChatPane({
	chat,
	draft,
	model,
	loaded,
	isSending,
	isStreaming,
	onDraftChange,
	onSubmit,
	onStop,
	onOpenProvider,
	onDeleteMessage,
}: ChatPaneProps) {
	const showToast = useToast();
	const { copy } = useClipboard({ announce: "Copied" });
	const [canSpeak, setCanSpeak] = useState(false);
	const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
	const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
	const chatLayout = useRef<HTMLDivElement>(null);
	const scrollOnOpen = useCallback((node: HTMLDivElement | null) => {
		chatLayout.current = node;
		if (node) node.scrollTop = node.scrollHeight;
	}, []);
	const activeId = chat?.id;
	const messages = chat?.messages ?? [];

	useEffect(() => {
		setCanSpeak("speechSynthesis" in window);
		return () => window.speechSynthesis?.cancel();
	}, []);

	useEffect(() => {
		if (activeId && chatLayout.current)
			chatLayout.current.scrollTop = chatLayout.current.scrollHeight;
		currentUtterance.current = null;
		window.speechSynthesis?.cancel();
		setSpeakingIndex(null);
	}, [activeId]);

	const copyText = useCallback(
		async (content: string) => {
			const copied = await copy(content);
			showToast({
				body: copied ? "Copied" : "Could not copy text",
				uniqueID: "copy",
			});
		},
		[copy, showToast],
	);

	function stopSpeaking() {
		currentUtterance.current = null;
		window.speechSynthesis.cancel();
		setSpeakingIndex(null);
	}

	function speak(message: Message, index: number) {
		if (!canSpeak) return;
		stopSpeaking();
		if (speakingIndex === index) return;

		let spoken = message.content;
		if (message.role === "assistant") {
			const parsed = new DOMParser().parseFromString(
				renderMarkdown(spoken),
				"text/html",
			);
			for (const button of parsed.querySelectorAll(".copy-code"))
				button.remove();
			spoken = parsed.body.textContent?.trim() || spoken;
		}
		const utterance = new SpeechSynthesisUtterance(spoken);
		utterance.onend = utterance.onerror = () => {
			if (currentUtterance.current === utterance) {
				currentUtterance.current = null;
				setSpeakingIndex(null);
			}
		};
		currentUtterance.current = utterance;
		setSpeakingIndex(index);
		window.speechSynthesis.speak(utterance);
	}

	return (
		<ChatLayout
			ref={scrollOnOpen}
			className="h-full min-w-0"
			density="spacious"
			emptyState={
				<VStack gap={4} hAlign="center" vAlign="center" width="100%">
					<Avatar
						src="/favicon.svg"
						name="GenieLM"
						alt=""
						size={60}
						shape="rounded"
						tooltip={false}
					/>
					<Heading
						level={1}
						type="display-3"
						justify="center"
						textWrap="balance"
					>
						How can I help you today?
					</Heading>
				</VStack>
			}
			composer={
				<ChatComposer
					value={draft}
					onChange={onDraftChange}
					onSubmit={onSubmit}
					onStop={onStop}
					isStopShown={isSending}
					isDisabled={!loaded}
					placeholder="Message GenieLM"
					input={
						<ChatComposerInput
							label="Message GenieLM"
							hasHistory={false}
							onKeyDown={(event) => {
								if (
									event.key !== "Enter" ||
									event.shiftKey ||
									event.nativeEvent.isComposing ||
									event.keyCode === 229
								)
									return;
								event.preventDefault();
								if (!isSending) onSubmit(draft);
							}}
						/>
					}
					sendButton={<ChatSendButton onSend={() => onSubmit(draft)} />}
					footerActions={
						<Button
							label={model || "Choose a model"}
							size="sm"
							variant="ghost"
							endContent={<Icon icon={ChevronDown} size="xsm" />}
							onClick={onOpenProvider}
						>
							<Text maxLines={1} wordBreak="break-word">
								{model || "Choose a model"}
							</Text>
						</Button>
					}
				/>
			}
		>
			{messages.length > 0 && (
				<ChatMessageList
					key={chat?.id}
					align="top"
					density="spacious"
					isStreaming={isStreaming}
				>
					{messages.map((message, index) => {
						const isGenerating = isStreaming && index === messages.length - 1;
						return (
							<ChatMessage
								key={message.id}
								sender={message.role}
								avatar={
									message.role === "assistant" ? (
										<Avatar
											src="/favicon.svg"
											name="GenieLM"
											size="md"
											shape="rounded"
											tooltip={false}
										/>
									) : undefined
								}
							>
								{message.role === "assistant" &&
									(message.reasoning || (isGenerating && !message.content)) && (
										<Collapsible
											defaultIsOpen={false}
											trigger={
												<HStack gap={2} vAlign="center">
													<Text as="p" type="label" color="secondary">
														Thinking
													</Text>
													{isGenerating && !message.content && (
														<Spinner
															size="sm"
															aria-label="Generating response"
														/>
													)}
												</HStack>
											}
										>
											<VStack paddingBlock={2}>
												<Text
													as="p"
													color="secondary"
													className="whitespace-pre-wrap wrap-anywhere"
												>
													{message.reasoning || "Waiting for the model…"}
												</Text>
											</VStack>
										</Collapsible>
									)}
								{message.content && (
									<ChatMessageBubble
										variant={message.role === "assistant" ? "ghost" : "filled"}
										metadata={
											<ChatMessageMetadata
												footer={
													<HStack gap={0.5}>
														<Button
															label="Copy message"
															tooltip="Copy message"
															isIconOnly
															size="sm"
															variant="ghost"
															icon={<Icon icon="copy" size="sm" />}
															onClick={() => void copyText(message.content)}
														/>
														<Button
															label={
																speakingIndex === index
																	? "Stop speaking"
																	: "Speak message"
															}
															tooltip={
																speakingIndex === index
																	? "Stop speaking"
																	: "Speak message"
															}
															isIconOnly
															size="sm"
															variant="ghost"
															isDisabled={!canSpeak}
															icon={
																<Icon
																	icon={
																		speakingIndex === index ? Square : Volume2
																	}
																	size="sm"
																/>
															}
															onClick={() => speak(message, index)}
														/>
														<Button
															label="Delete message"
															tooltip="Delete message"
															isIconOnly
															size="sm"
															variant="ghost"
															isDisabled={isStreaming}
															icon={<Icon icon={Trash2} size="sm" />}
															onClick={() => {
																if (canSpeak) stopSpeaking();
																onDeleteMessage(index);
															}}
														/>
													</HStack>
												}
											/>
										}
									>
										{message.role === "assistant" ? (
											<MarkdownAnswer
												content={message.content}
												onCopy={copyText}
											/>
										) : (
											<Text
												as="p"
												className="whitespace-pre-wrap wrap-anywhere"
											>
												{message.content}
											</Text>
										)}
									</ChatMessageBubble>
								)}
							</ChatMessage>
						);
					})}
				</ChatMessageList>
			)}
		</ChatLayout>
	);
}

function MarkdownAnswer({
	content,
	onCopy,
}: {
	content: string;
	onCopy: (value: string) => void;
}) {
	const answer = useRef<HTMLElement>(null);
	const html = useMemo(() => renderMarkdown(content), [content]);

	useEffect(() => {
		const element = answer.current;
		function copyCode(event: MouseEvent) {
			if (!(event.target instanceof Element)) return;
			const button = event.target.closest<HTMLButtonElement>(".copy-code");
			const code = button?.closest("pre")?.querySelector("code")?.textContent;
			if (code != null) onCopy(code);
		}
		element?.addEventListener("click", copyCode);
		return () => element?.removeEventListener("click", copyCode);
	}, [onCopy]);

	return (
		<article
			ref={answer}
			className="genielm-markdown"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The shared Markdown renderer escapes raw HTML and validates URLs.
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
