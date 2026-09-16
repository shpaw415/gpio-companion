import { PATCH as patchPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import { translateError } from "gpio-companion/i18n";
import { useEffect, useState } from "react";
import { useT } from "../hooks/useLocale.tsx";
import { unwrapAction } from "../lib/action.ts";

export default function DeviceLabelField({
	uuid,
	label,
	onSaved,
	persist,
}: {
	uuid: string;
	label: string;
	onSaved?: (label: string) => void;
	persist?: (input: {
		uuid: string;
		label: string;
	}) => Promise<{ device: { label: string } }>;
}) {
	const t = useT();
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
			const result = persist
				? await persist({ uuid, label: value })
				: unwrapAction(await patchPairing({ uuid, label: value }));
			setValue(result.device.label);
			onSaved?.(result.device.label);
		} catch (caught) {
			setError(
				translateError(
					t,
					caught instanceof Error ? caught.message : "save failed",
				),
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Stack spacing={1}>
			<Stack direction="row" spacing={1} className="flex-wrap items-end">
				<TextField
					label={t("devices.label")}
					placeholder={t("devices.optionalName")}
					value={value}
					onChange={(event) => setValue(event.target.value)}
					className="min-w-0 w-full flex-1"
				/>
				<Button
					type="button"
					variant="outlined"
					disabled={busy}
					onClick={() => void save()}
				>
					{t("devices.save")}
				</Button>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
		</Stack>
	);
}
