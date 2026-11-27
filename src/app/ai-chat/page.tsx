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
	ChatToolCalls,
} from "@astryxdesign/core/Chat";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { useClipboard } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useToast } from "@astryxdesign/core/Toast";
import { useTheme } from "@astryxdesign/core/theme";
import { ChevronDown, Square, Trash2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Chat, Message } from "#/lib/chat-storage";
import type { ChatToolCall } from "#/lib/chat-stream";
import {
	getChatArtifact,
	renderChatMarkdown,
	renderMarkdown,
} from "#/lib/markdown";
import type { RenderedMermaid } from "#/lib/mermaid-preview";
import { ArtifactCard, ArtifactLayout } from "./artifact";
import { MermaidViewer } from "./mermaid-viewer";

const toolLabels = new Map([
	["webSearch", "Web search"],
	["webFetch", "Read webpage"],
	["getWeather", "Check weather"],
	["runCode", "Run code"],
	["searchPersonalKnowledge", "Search local knowledge"],
	["remember", "Save memory"],
	["forgetMemory", "Forget memory"],
]);

function isToolInProgress(call: ChatToolCall) {
	return call.status === "pending" || call.status === "running";
}

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
	const [artifactSelection, setArtifactSelection] = useState<{
		messageId: string;
		artifactId: number;
	}>();
	const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
	const chatLayout = useRef<HTMLDivElement>(null);
	const scrollOnOpen = useCallback((node: HTMLDivElement | null) => {
		chatLayout.current = node;
		if (node) node.scrollTop = node.scrollHeight;
	}, []);
	const activeId = chat?.id;
	const messages = chat?.messages ?? [];
	const artifactSource = messages.find(
		(message) => message.id === artifactSelection?.messageId,
	)?.content;
	const artifact = useMemo(
		() =>
			artifactSelection && artifactSource
				? getChatArtifact(artifactSource, artifactSelection.artifactId)
				: undefined,
		[artifactSelection, artifactSource],
	);

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
		setArtifactSelection(undefined);
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

	const transcript = (
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
						const isThinking =
							isGenerating &&
							!message.content &&
							!message.toolCalls?.some(isToolInProgress);
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
									(message.reasoning || isThinking) && (
										<Collapsible
											defaultIsOpen={false}
											trigger={
												<HStack gap={2} vAlign="center">
													<Text as="p" type="label" color="secondary">
														Thinking
													</Text>
													{isThinking && (
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
								{message.role === "assistant" && message.toolCalls && (
									<ChatToolCalls
										calls={message.toolCalls.map((call) => {
											const interrupted =
												!isGenerating && isToolInProgress(call);
											return {
												key: call.id,
												name: toolLabels.get(call.name) ?? call.name,
												status: interrupted ? "error" : call.status,
												errorMessage: interrupted
													? "Tool call interrupted."
													: undefined,
											};
										})}
									/>
								)}
								{message.content && (
									<ChatMessageBubble
										variant={message.role === "assistant" ? "ghost" : "filled"}
										data-genielm-answer={
											message.role === "assistant" ? "" : undefined
										}
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
												isStreaming={isGenerating}
												onCopy={copyText}
												onOpenArtifact={(artifactId) =>
													setArtifactSelection({
														messageId: message.id,
														artifactId,
													})
												}
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

	return (
		<ArtifactLayout
			artifact={artifact}
			artifactKey={
				artifactSelection &&
				`${artifactSelection.messageId}:${artifactSelection.artifactId}`
			}
			documentContent={
				artifact?.kind === "document" && (
					<MarkdownAnswer content={artifact.content} onCopy={copyText} />
				)
			}
			onClose={() => setArtifactSelection(undefined)}
			onCopy={copyText}
		>
			{transcript}
		</ArtifactLayout>
	);
}

function MarkdownAnswer({
	content,
	isStreaming = false,
	onCopy,
	onOpenArtifact,
}: {
	content: string;
	isStreaming?: boolean;
	onCopy: (value: string) => void;
	onOpenArtifact?: (artifactId: number) => void;
}) {
	const answer = useRef<HTMLElement>(null);
	const [previews, setPreviews] = useState<
		{
			html: string;
			id: number;
			target: Element;
			title: string;
			image: RenderedMermaid;
		}[]
	>([]);
	const { mode } = useTheme();
	const canOpenArtifacts = !!onOpenArtifact;
	const { html, artifacts, diagrams } = useMemo(
		() =>
			canOpenArtifacts
				? renderChatMarkdown(content)
				: { html: renderMarkdown(content), artifacts: [], diagrams: [] },
		[content, canOpenArtifacts],
	);

	useEffect(() => {
		const article = answer.current;
		if (!article || isStreaming || !diagrams.length) return;
		const controller = new AbortController();
		void import("#/lib/mermaid-preview").then(
			({ renderMermaidPreview }) => {
				for (const diagram of diagrams) {
					const target = article.querySelector(
						`[data-genielm-mermaid="${diagram.id}"]`,
					);
					if (!target) continue;
					void renderMermaidPreview(
						diagram.content,
						mode,
						controller.signal,
					).then((image) => {
						if (!image || controller.signal.aborted || !target.isConnected)
							return;
						setPreviews((current) => [
							...current.filter(
								(preview) => preview.html === html && preview.id !== diagram.id,
							),
							{ html, id: diagram.id, target, title: diagram.title, image },
						]);
					});
				}
			},
			() => {
				// The fallback source remains available if the renderer cannot load.
			},
		);
		return () => controller.abort();
	}, [diagrams, html, isStreaming, mode]);

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

	const article = (
		<article
			ref={answer}
			className="genielm-markdown"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: The shared Markdown renderer escapes raw HTML and validates URLs.
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
	if (!onOpenArtifact) return article;
	return (
		<VStack gap={2}>
			{article}
			{previews.map((preview) =>
				preview.html === html
					? createPortal(
							<MermaidViewer image={preview.image} title={preview.title} />,
							preview.target,
							String(preview.id),
						)
					: null,
			)}
			{artifacts.map((artifact) => (
				<ArtifactCard
					key={artifact.id}
					artifact={artifact}
					onOpen={() => onOpenArtifact(artifact.id)}
				/>
			))}
		</VStack>
	);
}
