import ProjectBrowser from "@components/ProjectBrowser";

export default function ProjectsPage() {
	return (
		<div className="container mx-auto px-4 py-16">
			<h1 className="mb-4 font-bold text-4xl tracking-tight">Projects</h1>
			<p className="mb-10 max-w-2xl text-lg text-slate-400">
				PCB, breadboard, and technical files the on-device agent pushed to
				Gitea. Open a repo to view files and the PCB preview.
			</p>
			<ProjectBrowser />
		</div>
	);
}
