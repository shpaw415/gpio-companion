import WifiBleForm from "@components/WifiBleForm";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { SectionHeader } from "../../components/Section.tsx";

export default function WifiPage() {
	return (
		<Stack spacing={3}>
			<SectionHeader title="WiFi over Bluetooth" />
			<Typography color="secondary">
				Put a paired board on your Wi‑Fi from this phone or computer. Chrome or
				Edge can talk to the board over Bluetooth. On iOS, sign and copy, then
				paste into LightBlue or nRF Connect.
			</Typography>
			<WifiBleForm />
		</Stack>
	);
}
