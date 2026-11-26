import { Button } from "@astryxdesign/core/Button";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Icon } from "@astryxdesign/core/Icon";
import {
	Layout,
	LayoutContent,
	LayoutHeader,
	LayoutPanel,
} from "@astryxdesign/core/Layout";
import { ResizeHandle, useResizable } from "@astryxdesign/core/Resizable";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useToast } from "@astryxdesign/core/Toast";
import { observeResize } from "@astryxdesign/core/utils";
import { CodeXml, FileText, Share } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ChatArtifact } from "#/lib/markdown";

function artifactType(artifact: ChatArtifact) {
	if (artifact.kind === "document") return "Markdown document";
	if (artifact.language === "mermaid") return "Mermaid source";
	return artifact.language || "Plain text";
}

export function ArtifactCard({
	artifact,
	onOpen,
}: {
	artifact: ChatArtifact;
	onOpen: () => void;
}) {
	return (
		<ClickableCard
			label={`Open ${artifact.title}`}
			onClick={onOpen}
			variant="muted"
			padding={3}
			width="100%"
			maxWidth={360}
		>
			<HStack gap={3} vAlign="center" width="100%">
				<Icon
					icon={artifact.kind === "document" ? FileText : CodeXml}
					color="secondary"
				/>
				<StackItem size="fill">
					<VStack gap={0}>
						<Text
							type="label"
							weight="semibold"
							maxLines={1}
							wordBreak="break-word"
						>
							{artifact.title}
						</Text>
						<Text type="supporting" color="secondary" maxLines={1}>
							{artifactType(artifact)}
						</Text>
					</VStack>
				</StackItem>
				<Icon icon="chevronRight" size="sm" color="secondary" />
			</HStack>
		</ClickableCard>
	);
}

export function ArtifactLayout({
	children,
	artifact,
	documentContent,
	onClose,
	onCopy,
}: {
	children: ReactNode;
	artifact: ChatArtifact | undefined;
	documentContent?: ReactNode;
	onClose: () => void;
	onCopy: (content: string) => Promise<void>;
}) {
	const showToast = useToast();
	const container = useRef<HTMLDivElement>(null);
	const [hasRoomForPanel, setHasRoomForPanel] = useState(false);
	const panel = useResizable({
		containerRef: container,
		defaultSize: 480,
		minSize: 320,
		maxSize: "55%",
		autoSaveId: "genielm-artifact-panel",
	});

	useEffect(() => {
		const element = container.current;
		if (!element) return;

		// Measure the chat area so the sidebar can keep its own width.
		return observeResize(element, (entry) => {
			setHasRoomForPanel(
				(entry.contentBoxSize?.[0]?.inlineSize ?? element.clientWidth) >= 768,
			);
		});
	}, []);

	async function shareArtifact(item: ChatArtifact) {
		try {
			const data = { title: item.title, text: item.content };
			if (
				navigator.share &&
				(!navigator.canShare || navigator.canShare(data))
			) {
				await navigator.share(data);
			} else {
				await onCopy(item.content);
			}
		} catch (error) {
			if (!(error instanceof DOMException && error.name === "AbortError")) {
				showToast({
					body: "Could not share the artifact.",
					uniqueID: "share-artifact",
				});
			}
		}
	}

	const actions = artifact && (
		<HStack gap={1} vAlign="center">
			<Button
				label="Copy artifact"
				tooltip="Copy artifact"
				variant="ghost"
				size="sm"
				isIconOnly
				icon={<Icon icon="copy" size="sm" />}
				clickAction={() => onCopy(artifact.content)}
			/>
			<Button
				label="Share artifact"
				tooltip="Share artifact"
				variant="ghost"
				size="sm"
				isIconOnly
				icon={<Icon icon={Share} size="sm" />}
				clickAction={() => shareArtifact(artifact)}
			/>
		</HStack>
	);
	const body = artifact && (
		<LayoutContent padding={4}>
			{artifact.kind === "document" ? (
				documentContent
			) : (
				<CodeBlock
					code={artifact.content}
					language={artifact.language || "plaintext"}
					width="100%"
					container="section"
					hasLineNumbers
					hasLanguageLabel={false}
					hasCopyButton={false}
				/>
			)}
		</LayoutContent>
	);

	return (
		<>
			<Layout
				ref={container}
				height="fill"
				padding={0}
				content={
					<LayoutContent padding={0} isScrollable={false}>
						{children}
					</LayoutContent>
				}
				end={
					artifact && hasRoomForPanel ? (
						<>
							<ResizeHandle
								isReversed
								hasDivider
								resizable={panel.props}
								label="Resize artifact panel"
							/>
							<LayoutPanel
								width={panel.size}
								padding={0}
								isScrollable={false}
								role="complementary"
								label="Artifact"
							>
								<Layout
									header={
										<LayoutHeader padding={3} hasDivider>
											<HStack gap={2} vAlign="center">
												<StackItem size="fill">
													<VStack gap={0.5}>
														<Heading
															level={2}
															maxLines={1}
															wordBreak="break-word"
														>
															{artifact.title}
														</Heading>
														<Text type="supporting" color="secondary">
															{artifactType(artifact)}
														</Text>
													</VStack>
												</StackItem>
												{actions}
												<Button
													label="Close artifact"
													tooltip="Close artifact"
													variant="ghost"
													size="sm"
													isIconOnly
													icon={<Icon icon="close" size="sm" />}
													onClick={onClose}
												/>
											</HStack>
										</LayoutHeader>
									}
									content={body}
								/>
							</LayoutPanel>
						</>
					) : undefined
				}
			/>
			{artifact && !hasRoomForPanel && (
				<Dialog
					isOpen
					variant="fullscreen"
					onOpenChange={(open) => !open && onClose()}
				>
					<Layout
						header={
							<DialogHeader
								title={artifact.title}
								subtitle={artifactType(artifact)}
								endContent={actions}
								onOpenChange={(open) => !open && onClose()}
							/>
						}
						content={body}
					/>
				</Dialog>
			)}
		</>
	);
}
