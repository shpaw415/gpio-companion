import Select from "@shpaw415/mui-lite/Select";
import { useT } from "../hooks/useLocale.tsx";

export type DeviceOption = {
	uuid: string;
	deviceUrl?: string;
	label?: string;
};

export default function DeviceSelect({
	devices,
	value,
	onChange,
	disabled,
	label,
}: {
	devices: DeviceOption[];
	value: string;
	onChange: (uuid: string) => void;
	disabled?: boolean;
	label?: string;
}) {
	const t = useT();
	return (
		<Select
			name="uuid"
			label={label ?? t("devices.pairedDevice")}
			value={value}
			onSelect={(next) => onChange(next)}
			className="w-full"
			disabled={disabled || devices.length === 0}
		>
			{devices.map((device) => (
				<option key={device.uuid} value={device.uuid}>
					{device.label?.trim()
						? `${device.label.trim()} — ${device.uuid}`
						: device.deviceUrl
							? `${device.uuid} — ${device.deviceUrl}`
							: device.uuid}
				</option>
			))}
		</Select>
	);
}
