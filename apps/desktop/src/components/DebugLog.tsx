import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { debugLogs } from "../api";

export default function DebugLog({ error }: { error: string }) {
	const [lines, setLines] = useState<string[] | null>(null);
	const [copied, setCopied] = useState(false);

	async function load() {
		const next = await debugLogs();
		setLines(next);
		setCopied(false);
	}

	async function copy() {
		const text = [error, ...(lines ?? [])].join("\n");
		await navigator.clipboard.writeText(text);
		setCopied(true);
	}

	return (
		<Stack spacing={1}>
			<Button variant="text" color="secondary" onClick={() => void load()}>
				{lines ? "Refresh debug log" : "Show debug log"}
			</Button>
			{lines ? (
				<>
					<Button variant="text" onClick={() => void copy()}>
						{copied ? "Copied" : "Copy debug log"}
					</Button>
					<Typography
						Element="pre"
						color="secondary"
						sx={{
							m: 0,
							maxHeight: 240,
							overflow: "auto",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
							fontSize: 12,
						}}
					>
						{[error, ...lines].join("\n")}
					</Typography>
				</>
			) : null}
		</Stack>
	);
}
