import { Button } from "@astryxdesign/core/Button";
import { useAnnounce, useClipboard } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { useState } from "react";

export function CopyButton({
	label,
	content,
}: {
	label: string;
	content: string;
}) {
	const { copy, isCopied } = useClipboard({ announce: "Copied" });
	const announce = useAnnounce();
	const [hasError, setHasError] = useState(false);
	const feedback = hasError ? "Copy failed" : isCopied ? "Copied" : undefined;

	async function copyContent() {
		const copied = await copy(content);
		setHasError(!copied);
		if (!copied) announce("Copy failed", "assertive");
	}

	return (
		<Button
			label={feedback ?? label}
			tooltip={feedback ? undefined : label}
			isIconOnly={!feedback}
			variant="ghost"
			size="sm"
			icon={feedback ? undefined : <Icon icon="copy" size="sm" />}
			onClick={() => void copyContent()}
		/>
	);
}
