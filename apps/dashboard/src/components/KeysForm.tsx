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
}: {
	giteaRegisterUrl?: string;
}) {
	const [deviceUrl, setDeviceUrl] = useState("");
	const [opencodeApiKey, setOpencodeApiKey] = useState("");
	const [giteaUrl, setGiteaUrl] = useState(giteaRegisterUrl);
	const [giteaUsername, setGiteaUsername] = useState("");
	const [giteaToken, setGiteaToken] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [message, setMessage] = useState("");

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		const origin = deviceUrl.replace(/\/+$/, "");
		if (!origin) {
			setStatus("error");
			setMessage("device URL is required");
			return;
		}
		setStatus("loading");
		setMessage("");
		try {
			if (opencodeApiKey) {
				const secrets = await fetch(`${origin}/v1/config/secrets`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ opencodeApiKey }),
				});
				if (!secrets.ok) {
					throw new Error(`device secrets ${secrets.status}`);
				}
			}
			if (giteaUrl || giteaUsername || giteaToken) {
				const gitea = await fetch(`${origin}/v1/config/gitea`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ giteaUrl, giteaUsername, giteaToken }),
				});
				if (!gitea.ok) {
					throw new Error(`device gitea ${gitea.status}`);
				}
			}
			setStatus("success");
			setMessage("saved on the Pi API");
			setOpencodeApiKey("");
			setGiteaToken("");
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
						label="Device URL"
						placeholder="https://pi.example.com:4150"
						value={deviceUrl}
						onChange={(event) => setDeviceUrl(event.target.value)}
						className="w-full"
					/>
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
