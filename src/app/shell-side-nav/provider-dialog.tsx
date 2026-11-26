import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import {
	SegmentedControl,
	SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { logout, startLogin } from "@openai-oauth/web";
import type { Dispatch, SetStateAction } from "react";
import type { ProviderSettings } from "#/lib/chat-storage";

type ProviderDialogProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	provider: ProviderSettings;
	onChange: Dispatch<SetStateAction<ProviderSettings>>;
	isReady: boolean;
	isSignedIn: boolean;
	onSignedInChange: (signedIn: boolean) => void;
	authMessage: string;
	onAuthMessageChange: (message: string) => void;
};

export function ProviderDialog({
	isOpen,
	onOpenChange,
	provider,
	onChange,
	isReady,
	isSignedIn,
	onSignedInChange,
	authMessage,
	onAuthMessageChange,
}: ProviderDialogProps) {
	function update(
		field: "compatibleModel" | "oauthModel" | "baseURL" | "apiKey",
		value: string,
	) {
		onChange((settings) => ({ ...settings, [field]: value }));
	}

	async function signIn() {
		onAuthMessageChange("");
		try {
			const result = await startLogin();
			if (result.status === "needs-extension") {
				window.open(result.installUrl, "_blank", "noopener,noreferrer");
				onAuthMessageChange(
					"Install the browser extension, then select Sign in with ChatGPT again.",
				);
			}
		} catch (error) {
			onAuthMessageChange(
				error instanceof Error ? error.message : "ChatGPT sign-in failed.",
			);
		}
	}

	async function signOut() {
		try {
			await logout();
			onSignedInChange(false);
			onAuthMessageChange("");
		} catch {
			onAuthMessageChange("Could not sign out of ChatGPT.");
		}
	}

	const close = () => onOpenChange(false);
	return (
		<Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={460}>
			<DialogHeader title="Provider settings" onOpenChange={onOpenChange} />
			<VStack gap={4} padding={4}>
				<SegmentedControl
					label="Model provider"
					layout="fill"
					value={provider.type}
					onChange={(value) =>
						onChange((settings) => ({
							...settings,
							type: value === "oauth" ? "oauth" : "compatible",
						}))
					}
				>
					<SegmentedControlItem label="Compatible API" value="compatible" />
					<SegmentedControlItem label="ChatGPT" value="oauth" />
				</SegmentedControl>
				{provider.type === "compatible" ? (
					<>
						<TextInput
							label="Base URL"
							type="url"
							isRequired
							value={provider.baseURL}
							onChange={(value) => update("baseURL", value)}
							placeholder="http://localhost:8888/v1"
						/>
						<TextInput
							label="Model"
							isRequired
							value={provider.compatibleModel}
							onChange={(value) => update("compatibleModel", value)}
							placeholder="Model name"
						/>
						<TextInput
							label="API key"
							type="password"
							isOptional
							value={provider.apiKey}
							onChange={(value) => update("apiKey", value)}
							autoComplete="off"
							description="Stored for this tab only."
						/>
						<HStack hAlign="end">
							<Button
								label="Use this API"
								variant="primary"
								isDisabled={!isReady}
								onClick={close}
							/>
						</HStack>
					</>
				) : (
					<>
						<HStack gap={2} vAlign="center" role="status">
							<StatusDot
								variant={isSignedIn ? "success" : "neutral"}
								label={isSignedIn ? "Connected" : "Disconnected"}
							/>
							<Text as="p" color="secondary">
								{isSignedIn
									? "Connected to ChatGPT"
									: "Sign in to connect ChatGPT."}
							</Text>
						</HStack>
						<TextInput
							label="Model"
							isRequired
							value={provider.oauthModel}
							onChange={(value) => update("oauthModel", value)}
							placeholder="gpt-5.4-mini"
						/>
						{authMessage && (
							<Text as="p" color="secondary" role="status">
								{authMessage}
							</Text>
						)}
						<HStack gap={2} hAlign="end" wrap="wrap">
							{isSignedIn ? (
								<>
									<Button label="Sign out" clickAction={signOut} />
									<Button
										label="Use ChatGPT"
										variant="primary"
										isDisabled={!isReady}
										onClick={close}
									/>
								</>
							) : (
								<Button
									label="Sign in with ChatGPT"
									variant="primary"
									clickAction={signIn}
								/>
							)}
						</HStack>
					</>
				)}
			</VStack>
		</Dialog>
	);
}
