import { PUT as saveDeviceSecrets } from "@api/device";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { type FormEvent, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function KeysForm({
	giteaRegisterUrl = "",
	onComplete,
}: {
	giteaRegisterUrl?: string;
	onComplete?: () => void;
}) {
	const [opencodeApiKey, setOpencodeApiKey] = useState("");
	const [giteaUrl, setGiteaUrl] = useState(giteaRegisterUrl);
	const [giteaUsername, setGiteaUsername] = useState("");
	const [giteaToken, setGiteaToken] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [message, setMessage] = useState("");

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setStatus("loading");
		setMessage("");
		try {
			await saveDeviceSecrets({
				opencodeApiKey,
				giteaUrl,
				giteaUsername,
				giteaToken,
			});
			setStatus("success");
			setMessage("saved on the Pi API");
			setOpencodeApiKey("");
			setGiteaToken("");
			onComplete?.();
		} catch (error) {
			setStatus("error");
			setMessage(error instanceof Error ? error.message : "save failed");
		}
	}

	return (
		<Paper className="max-w-xl p-6" elevation={1}>
			<form onSubmit={onSubmit}>
				<Stack spacing={2}>
					<TextField
						label="OpenCode API key"
						type="password"
						autoComplete="off"
						value={opencodeApiKey}
						onChange={(event) => setOpencodeApiKey(event.target.value)}
						className="w-full"
					/>
					<Typography variant="body2" color="secondary">
						Gitea: register on Gitea, create a token, then save it to the Pi.
					</Typography>
					<TextField
						label="Gitea URL"
						placeholder="https://git.example.com"
						value={giteaUrl}
						onChange={(event) => setGiteaUrl(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="Gitea username"
						value={giteaUsername}
						onChange={(event) => setGiteaUsername(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="Gitea token"
						type="password"
						autoComplete="off"
						value={giteaToken}
						onChange={(event) => setGiteaToken(event.target.value)}
						className="w-full"
					/>
					<Button
						type="submit"
						variant="contained"
						disabled={status === "loading"}
					>
						{status === "loading" ? "Saving…" : "Save to Pi API"}
					</Button>
					{message ? (
						<Alert severity={status === "error" ? "error" : "success"}>
							{message}
						</Alert>
					) : null}
				</Stack>
			</form>
		</Paper>
	);
}
