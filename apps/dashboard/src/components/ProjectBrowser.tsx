import {
	GET as listProjects,
	POST as loadProject,
	PUT as readFile,
} from "@api/projects";
import { useEffect, useState } from "react";
import type { GiteaRepo, ProjectBundle } from "../lib/gitea.ts";
import PcbViewer from "./PcbViewer.tsx";

export default function ProjectBrowser() {
	const [configured, setConfigured] = useState(true);
	const [repos, setRepos] = useState<GiteaRepo[]>([]);
	const [error, setError] = useState("");
	const [bundle, setBundle] = useState<ProjectBundle | null>(null);
	const [pcbJson, setPcbJson] = useState<string | null>(null);

	useEffect(() => {
		listProjects()
			.then((result) => {
				setConfigured(result.configured);
				setRepos(result.repos);
			})
			.catch((err: unknown) => {
				setError(
					err instanceof Error ? err.message : "failed to list projects",
				);
			});
	}, []);

	async function openRepo(repo: GiteaRepo) {
		setError("");
		setPcbJson(null);
		try {
			const next = await loadProject(repo.owner, repo.name);
			setBundle(next);
			if (next.pcbCircuitJsonUrl) {
				const file = await readFile(repo.owner, repo.name, "pcb/circuit.json");
				setPcbJson(file.text);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "failed to load project");
		}
	}

	if (!configured) {
		return (
			<p className="text-slate-400">
				Set <code className="text-slate-200">GITEA_URL</code> and secret{" "}
				<code className="text-slate-200">GITEA_TOKEN</code> on the Pages project
				to list Gitea repos. Agent-pushed files live in{" "}
				<code className="text-slate-200">pcb/</code>,{" "}
				<code className="text-slate-200">breadboard/</code>, and{" "}
				<code className="text-slate-200">technical/</code>.
			</p>
		);
	}

	return (
		<div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
			<aside className="flex flex-col gap-2">
				{repos.map((repo) => (
					<button
						className="rounded-xl border border-slate-800 px-4 py-3 text-left hover:border-blue-500/40"
						key={repo.full_name}
						onClick={() => void openRepo(repo)}
						type="button"
					>
						<span className="block font-medium">{repo.name}</span>
						<span className="font-mono text-slate-500 text-xs">
							{repo.full_name}
						</span>
					</button>
				))}
				{repos.length === 0 ? (
					<p className="text-slate-500 text-sm">No Gitea repos yet.</p>
				) : null}
			</aside>
			<section className="flex flex-col gap-8">
				{error ? <p className="text-red-400">{error}</p> : null}
				{bundle ? (
					<>
						<PcbViewer
							circuitJsonText={pcbJson}
							label="PCB"
							previewUrl={bundle.pcbPreviewUrl}
						/>
						<FileGroup title="PCB" files={bundle.pcb} />
						<FileGroup title="Breadboard" files={bundle.breadboard} />
						<FileGroup title="Technical" files={bundle.technical} />
					</>
				) : (
					<p className="text-slate-500">Select a project.</p>
				)}
			</section>
		</div>
	);
}

function FileGroup({
	title,
	files,
}: {
	title: string;
	files: { name: string; path: string; download_url: string | null }[];
}) {
	return (
		<div>
			<h2 className="mb-3 font-semibold text-xl">{title}</h2>
			{files.length === 0 ? (
				<p className="text-slate-500 text-sm">No files in this folder.</p>
			) : (
				<ul className="flex flex-col gap-2">
					{files.map((file) => (
						<li key={file.path}>
							{file.download_url ? (
								<a
									className="font-mono text-blue-400 text-sm hover:underline"
									href={file.download_url}
									rel="noreferrer"
									target="_blank"
								>
									{file.path}
								</a>
							) : (
								<span className="font-mono text-slate-400 text-sm">
									{file.path}
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
