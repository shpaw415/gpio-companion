import WifiBleForm from "@components/WifiBleForm";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function WifiPage() {
	return (
		<Stack spacing={3}>
			<Typography variant="h4" Element="h1">
				WiFi over Bluetooth
			</Typography>
			<Typography color="secondary">
				The dashboard signs the WiFi command with the gpio-companion private key
				and a timestamp. The Pi verifies it before connecting. Chrome or Edge
				can talk to the Pi directly. On iOS, sign and copy, then paste into
				LightBlue or nRF Connect.
			</Typography>
			<WifiBleForm />
		</Stack>
	);
}