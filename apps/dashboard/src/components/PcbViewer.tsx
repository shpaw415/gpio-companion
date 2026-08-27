import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import { useMemo } from "react";

type Props = {
	circuitJsonText?: string | null;
	previewUrl?: string | null;
	label: string;
};

export default function PcbViewer({
	circuitJsonText,
	previewUrl,
	label,
}: Props) {
	const embeddedSvg = useMemo(
		() => extractPreviewSvg(circuitJsonText),
		[circuitJsonText],
	);

	if (previewUrl) {
		return (
			<Paper className="overflow-hidden" elevation={1}>
				<img
					alt={`${label} preview`}
					className="w-full bg-white"
					src={previewUrl}
				/>
				<Typography color="secondary" className="px-4 py-2">
					{label}
				</Typography>
			</Paper>
		);
	}

	if (embeddedSvg) {
		return (
			<Paper className="overflow-hidden" elevation={1}>
				<img
					alt={`${label} preview`}
					className="w-full bg-white"
					src={`data:image/svg+xml;utf8,${encodeURIComponent(embeddedSvg)}`}
				/>
				<Typography color="secondary" className="px-4 py-2">
					{label} PCB
				</Typography>
			</Paper>
		);
	}

	if (circuitJsonText) {
		return (
			<Paper className="p-4" elevation={1}>
				<Typography variant="subtitle1" className="mb-2">
					{label} PCB
				</Typography>
				<pre className="max-h-[32rem] overflow-auto text-xs">
					{circuitJsonText.slice(0, 8000)}
				</pre>
			</Paper>
		);
	}

	return (
		<Paper className="p-6" elevation={1}>
			<Typography color="secondary">
				No {label} circuit.json or preview.svg in Gitea yet.
			</Typography>
		</Paper>
	);
}

function extractPreviewSvg(jsonText?: string | null): string | null {
	if (!jsonText) {
		return null;
	}
	try {
		const data = JSON.parse(jsonText) as { previewSvg?: unknown };
		return typeof data.previewSvg === "string" ? data.previewSvg : null;
	} catch {
		return null;
	}
}
