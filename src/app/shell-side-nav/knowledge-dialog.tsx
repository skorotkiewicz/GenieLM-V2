import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { ScrollableArea } from "@astryxdesign/core/ScrollableArea";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { FileText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type KnowledgeDocument = {
	id: number;
	name: string;
	createdAt: number;
	chunks: number;
};

export function KnowledgeDialog({
	onOpenChange,
}: {
	onOpenChange: (open: boolean) => void;
}) {
	const confirm = useImperativeAlertDialog();
	const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(true);
	const [status, setStatus] = useState("");

	useEffect(() => {
		const controller = new AbortController();
		async function initialize() {
			try {
				setDocuments(await loadDocuments(controller.signal));
			} catch {
				if (!controller.signal.aborted)
					setStatus("Could not load the local knowledge store.");
			} finally {
				if (!controller.signal.aborted) setBusy(false);
			}
		}
		void initialize();
		return () => controller.abort();
	}, []);

	async function uploadDocument(selected: File | File[] | null) {
		if (!(selected instanceof File)) return;

		setFile(selected);
		setBusy(true);
		setStatus(`Indexing ${selected.name}…`);
		try {
			const body = new FormData();
			body.set("file", selected);
			const response = await fetch("/api/knowledge", { method: "POST", body });
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Could not index the document.");
			}
			setDocuments(await loadDocuments());
			setStatus(`Indexed ${selected.name}.`);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Could not index the document.",
			);
		} finally {
			setBusy(false);
			setFile(null);
		}
	}

	async function deleteDocument(id: number) {
		confirm.hide();
		setBusy(true);
		try {
			const response = await fetch(`/api/knowledge?id=${id}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error();
			setDocuments((items) => items.filter((document) => document.id !== id));
			setStatus("");
		} catch {
			setStatus("Could not delete the document.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog isOpen onOpenChange={onOpenChange} width={560} maxHeight="90dvh">
			<DialogHeader
				title="Local knowledge"
				subtitle="Private Markdown and text documents the model can search."
				onOpenChange={onOpenChange}
			/>
			<VStack gap={4} padding={4}>
				<FileInput
					label="Add document"
					value={file}
					onChange={(value) => void uploadDocument(value)}
					mode="dropzone"
					accept=".md,.txt,text/markdown,text/plain"
					maxSize={250_000}
					isDisabled={busy}
					description="Up to 250 KB. Uploading a file with the same name replaces it."
				/>
				{status && (
					<Text as="p" color="secondary" role="status">
						{status}
					</Text>
				)}
				{documents.length ? (
					<ScrollableArea
						axis="block"
						label="Local knowledge documents"
						className="knowledge-document-list"
					>
						<List edge="flush" hasDividers>
							{documents.map((document) => (
								<ListItem
									key={document.id}
									label={document.name}
									description={`${document.chunks} ${document.chunks === 1 ? "chunk" : "chunks"}`}
									startContent={<Icon icon={FileText} color="secondary" />}
									endContent={
										<Button
											label={`Delete ${document.name}`}
											tooltip="Delete document"
											variant="ghost"
											size="sm"
											isIconOnly
											isDisabled={busy}
											icon={<Icon icon={Trash2} size="sm" />}
											onClick={() =>
												confirm.show({
													title: `Delete ${document.name}?`,
													description:
														"This removes the document and its index from local knowledge.",
													actionLabel: "Delete",
													onAction: () => void deleteDocument(document.id),
												})
											}
										/>
									}
								/>
							))}
						</List>
					</ScrollableArea>
				) : busy && !status ? (
					<Spinner label="Loading documents" />
				) : (
					!status && (
						<Text as="p" color="secondary">
							No documents indexed yet.
						</Text>
					)
				)}
			</VStack>
			{confirm.element}
		</Dialog>
	);
}

async function loadDocuments(
	signal?: AbortSignal,
): Promise<KnowledgeDocument[]> {
	const response = await fetch("/api/knowledge", { signal });
	const data = await response.json();
	if (!response.ok || !Array.isArray(data.documents)) {
		throw new Error("Could not load the local knowledge store.");
	}
	return data.documents;
}
