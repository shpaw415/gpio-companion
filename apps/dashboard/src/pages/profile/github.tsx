import KeysForm from "@components/KeysForm";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { SectionHeader } from "../../components/Section.tsx";

export default function ProfileGithubPage() {
	return (
		<Stack spacing={3}>
			<SectionHeader title="GitHub" />
			<Typography color="secondary">
				Connect the gpio-companion GitHub App so your boards can push project
				files. You do not create a personal access token.
			</Typography>
			<KeysForm />
		</Stack>
	);
}
