import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import { useT } from "../locale";

export default function LiveConsole({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	const t = useT();
	const ref = useRef<HTMLDivElement>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		const node = ref.current?.querySelector("pre");
		if (node && value.length >= 0) {
			node.scrollTop = node.scrollHeight;
		}
	}, [value]);

	if (!value) {
		return null;
	}

	async function copy() {
		await navigator.clipboard.writeText(value).catch(() => undefined);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	}

	return (
		<div ref={ref}>
			<Paper sx={{ p: 1.5 }} elevation={0} variant="outlined">
				<Stack spacing={1}>
					<Typography variant="caption" color="secondary">
						{label}
					</Typography>
					<Typography
						Element="pre"
						sx={{
							m: 0,
							maxHeight: 192,
							overflow: "auto",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
							fontSize: 12,
						}}
					>
						{value}
					</Typography>
					<Button
						type="button"
						variant="outlined"
						size="small"
						onClick={() => void copy()}
					>
						{copied ? t("common.copied") : t("common.copy")}
					</Button>
				</Stack>
			</Paper>
		</div>
	);
}
