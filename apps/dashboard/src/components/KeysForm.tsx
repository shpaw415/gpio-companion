import { PUT as saveDeviceSecrets } from "@api/device";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { type FormEvent, useState } from "react";
import { unwrapAction } from "../lib/action.ts";
import { GITHUB_TOKEN_SETTINGS } from "../lib/github.ts";

type Status = "idle" | "loading" | "success" | "error";

export default function KeysForm({ onComplete }: { onComplete?: () => void }) {
	const [githubUsername, setGithubUsername] = useState("");
	const [githubToken, setGithubToken] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [message, setMessage] = useState("");

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setStatus("loading");
		setMessage("");
		try {
			unwrapAction(
				await saveDeviceSecrets({
					githubUsername,
					githubToken,
				}),
			);
			setStatus("success");
			setMessage("saved on the Pi API");
			setGithubToken("");
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
					<Typography variant="body2" color="secondary">
						OpenCode uses gpio-companion credits, not a pasted API key. GitHub:
						create a classic PAT with <code>repo</code> scope, then save
						username and token to the Pi.
					</Typography>
					<Button href={GITHUB_TOKEN_SETTINGS} variant="outlined">
						Open GitHub token settings
					</Button>
					<TextField
						label="GitHub username"
						value={githubUsername}
						onChange={(event) => setGithubUsername(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="GitHub token"
						type="password"
						autoComplete="off"
						value={githubToken}
						onChange={(event) => setGithubToken(event.target.value)}
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
