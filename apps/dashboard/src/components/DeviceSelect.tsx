import Select from "@shpaw415/mui-lite/Select";

export type DeviceOption = {
	uuid: string;
	deviceUrl?: string;
};

export default function DeviceSelect({
	devices,
	value,
	onChange,
	disabled,
	label = "Paired device",
}: {
	devices: DeviceOption[];
	value: string;
	onChange: (uuid: string) => void;
	disabled?: boolean;
	label?: string;
}) {
	return (
		<Select
			name="uuid"
			label={label}
			value={value}
			onSelect={(next) => onChange(next)}
			className="w-full"
			disabled={disabled || devices.length === 0}
		>
			{devices.map((device) => (
				<option key={device.uuid} value={device.uuid}>
					{device.deviceUrl
						? `${device.uuid} — ${device.deviceUrl}`
						: device.uuid}
				</option>
			))}
		</Select>
	);
}
