import Chip from "@shpaw415/mui-lite/Chip";
import Stack from "@shpaw415/mui-lite/Stack";
import { useEffect, useRef } from "react";
import type { ConsoleTunnelStatus } from "../hooks/useConsoleTunnel.ts";
import CopyBlock from "./CopyBlock.tsx";

export default function LiveConsole({
	label,
	value,
	status,
}: {
	label: string;
	value: string;
	status: ConsoleTunnelStatus;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = ref.current?.querySelector("pre");
		if (node && value.length >= 0) {
			node.scrollTop = node.scrollHeight;
		}
	}, [value]);
	return (
		<div ref={ref}>
			<Stack spacing={1}>
				<Stack direction="row" spacing={1} alignItems="center">
					<LiveChip
						status={status}
						ready={Boolean(value) || status === "live"}
					/>
				</Stack>
				{value ? <CopyBlock label={label} value={value} /> : null}
			</Stack>
		</div>
	);
}

function LiveChip({
	status,
	ready,
}: {
	status: ConsoleTunnelStatus;
	ready: boolean;
}) {
	if (status === "reconnecting") {
		return (
			<Chip
				label="Reconnecting"
				size="small"
				color="warning"
				variant="outlined"
			/>
		);
	}
	if (status === "connecting" || !ready) {
		return (
			<Chip
				label={status === "connecting" ? "Connecting" : "Waiting"}
				size="small"
				color="secondary"
				variant="outlined"
			/>
		);
	}
	return <Chip label="Live" size="small" color="success" variant="outlined" />;
}
