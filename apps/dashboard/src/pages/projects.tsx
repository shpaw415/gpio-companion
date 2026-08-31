import ProjectBrowser from "@components/ProjectBrowser";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function ProjectsPage() {
	return (
		<Stack spacing={3}>
			<Typography variant="h4" Element="h1">
				Projects
			</Typography>
			<Typography color="secondary">
				PCB, breadboard, and technical files the on-device agent pushed to
				GitHub. Open a repo to view files and the PCB preview.
			</Typography>
			<ProjectBrowser />
		</Stack>
	);
}
