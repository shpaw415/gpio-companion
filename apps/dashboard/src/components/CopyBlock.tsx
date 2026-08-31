import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";

export default function CopyBlock({
	value,
	label,
}: {
	value: string;
	label?: string;
}) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		await navigator.clipboard.writeText(value).catch(() => undefined);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	}

	return (
		<Paper className="p-3" elevation={0} variant="outlined">
			<Stack spacing={1}>
				{label ? (
					<Typography variant="caption" color="secondary">
						{label}
					</Typography>
				) : null}
				<pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
					{value}
				</pre>
				<Button
					type="button"
					variant="outlined"
					size="small"
					onClick={() => void copy()}
				>
					{copied ? "Copied" : "Copy to clipboard"}
				</Button>
			</Stack>
		</Paper>
	);
}
