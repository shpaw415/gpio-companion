import { PATCH as patchPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import { useEffect, useState } from "react";
import { unwrapAction } from "../lib/action.ts";

export default function DeviceLabelField({
	uuid,
	label,
	onSaved,
}: {
	uuid: string;
	label: string;
	onSaved?: (label: string) => void;
}) {
	const [value, setValue] = useState(label);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		setValue(label);
	}, [label]);

	async function save() {
		setBusy(true);
		setError("");
		try {
			const result = unwrapAction(await patchPairing({ uuid, label: value }));
			setValue(result.device.label);
			onSaved?.(result.device.label);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "save failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Stack spacing={1}>
			<Stack direction="row" spacing={1} className="flex-wrap items-end">
				<TextField
					label="Label"
					placeholder="Optional name"
					value={value}
					onChange={(event) => setValue(event.target.value)}
					className="min-w-48 flex-1"
				/>
				<Button
					type="button"
					variant="outlined"
					disabled={busy}
					onClick={() => void save()}
				>
					Save
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
		</Stack>
	);
}
