import KeysForm from "@components/KeysForm";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { SectionHeader } from "../../components/Section.tsx";

export default function KeysPage() {
	return (
		<Stack spacing={3}>
			<SectionHeader title="Keys" />
			<Typography color="secondary">
				Connect the gpio-companion GitHub App. Boards pull a live installation
				token when they push — you do not create a PAT.
			</Typography>
			<KeysForm />
		</Stack>
	);
}