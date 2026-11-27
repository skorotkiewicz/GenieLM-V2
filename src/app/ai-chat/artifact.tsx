import { Button } from "@astryxdesign/core/Button";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
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
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Heading, Text } from "@astryxdesign/core/Text";
import { observeResize } from "@astryxdesign/core/utils";
import { CodeXml, FileText } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { ChatArtifact } from "#/lib/markdown";
import { ArtifactCode } from "./artifact-code";
import { CopyButton } from "./copy-button";

function artifactType(artifact: ChatArtifact) {
	if (artifact.kind === "document") return "Markdown document";
	if (artifact.language === "html") return "HTML";
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

const previewPolicy = [
	"default-src 'none'",
	"style-src 'unsafe-inline'",
	"img-src data:",
	"font-src data:",
	"media-src data:",
	"base-uri 'none'",
	"form-action 'none'",
].join("; ");

function HtmlArtifact({ artifact }: { artifact: ChatArtifact }) {
	const [view, setView] = useState("source");
	const [enabledSource, setEnabledSource] = useState<string>();
	const id = useId();
	const isPreview = view === "preview";
	const runsJavaScript = enabledSource === artifact.content;
	const policy = runsJavaScript
		? `${previewPolicy}; script-src 'unsafe-inline'`
		: previewPolicy;
	return (
		<VStack height="100%" gap={2}>
			<HStack gap={2} vAlign="center">
				<StackItem size="fill">
					<TabList
						value={view}
						onChange={setView}
						role="tablist"
						aria-label="HTML artifact view"
						hasDivider
						size="sm"
					>
						<Tab
							id={`${id}-source-tab`}
							label="Source"
							value="source"
							panelId={`${id}-source`}
						/>
						<Tab
							id={`${id}-preview-tab`}
							label="Preview"
							value="preview"
							panelId={`${id}-preview`}
						/>
					</TabList>
				</StackItem>
				{isPreview && (
					<Button
						label={runsJavaScript ? "Stop JavaScript" : "Run JavaScript"}
						size="sm"
						onClick={() =>
							setEnabledSource(runsJavaScript ? undefined : artifact.content)
						}
					/>
				)}
			</HStack>
			<section
				id={`${id}-preview`}
				role="tabpanel"
				aria-labelledby={`${id}-preview-tab`}
				hidden={!isPreview}
				className="min-h-0 grow"
			>
				{isPreview && (
					<iframe
						key={runsJavaScript ? "interactive" : "static"}
						title={`Preview of ${artifact.title}`}
						className="block size-full border-0 bg-white scheme-light"
						sandbox={runsJavaScript ? "allow-scripts" : ""}
						referrerPolicy="no-referrer"
						srcDoc={`<!doctype html>\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n<meta name="referrer" content="no-referrer">\n${artifact.content}`}
					/>
				)}
			</section>
			<section
				id={`${id}-source`}
				role="tabpanel"
				aria-labelledby={`${id}-source-tab`}
				hidden={isPreview}
				className="min-h-0 grow overflow-auto"
			>
				{!isPreview && <ArtifactCode artifact={artifact} />}
			</section>
		</VStack>
	);
}

export function ArtifactLayout({
	children,
	artifact,
	artifactKey,
	documentContent,
	onClose,
}: {
	children: ReactNode;
	artifact: ChatArtifact | undefined;
	artifactKey: string | undefined;
	documentContent?: ReactNode;
	onClose: () => void;
}) {
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

	const copyAction = artifact && (
		<CopyButton
			key={artifactKey}
			label="Copy artifact"
			content={artifact.content}
		/>
	);
	const isHtml = artifact?.language === "html";
	const body = artifact && (
		<LayoutContent padding={4} isScrollable={!isHtml}>
			{artifact.kind === "document" ? (
				documentContent
			) : isHtml ? (
				<HtmlArtifact key={artifactKey} artifact={artifact} />
			) : (
				<ArtifactCode artifact={artifact} />
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
												{copyAction}
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
								endContent={copyAction}
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
