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
			<figure className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
				<img
					alt={`${label} preview`}
					className="w-full bg-white"
					src={previewUrl}
				/>
				<figcaption className="px-4 py-2 text-slate-500 text-sm">
					{label}
				</figcaption>
			</figure>
		);
	}

	if (embeddedSvg) {
		return (
			<figure className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
				<img
					alt={`${label} preview`}
					className="w-full bg-white"
					src={`data:image/svg+xml;utf8,${encodeURIComponent(embeddedSvg)}`}
				/>
				<figcaption className="px-4 py-2 text-slate-500 text-sm">
					{label} PCB
				</figcaption>
			</figure>
		);
	}

	if (circuitJsonText) {
		return (
			<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
				<p className="mb-3 font-medium text-slate-200">{label} PCB</p>
				<pre className="max-h-[32rem] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-slate-300 text-xs">
					{circuitJsonText.slice(0, 8000)}
				</pre>
			</div>
		);
	}

	return (
		<p className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-500">
			No {label} circuit.json or preview.svg in Gitea yet.
		</p>
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
