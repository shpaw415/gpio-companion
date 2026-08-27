export default function HomePage() {
	return (
		<div className="container mx-auto px-4 py-16">
			<h1 className="mb-4 font-bold text-4xl tracking-tight">Hardware</h1>
			<p className="mb-10 max-w-2xl text-lg text-slate-400">
				Manage GPIO boards linked to gpio-companion. Pairing and T3 Code access
				are handled here. OpenCode and Gitea credentials are set on the Keys
				page, not during first-boot on the device.
			</p>
			<div className="grid max-w-3xl gap-6">
				<div className="rounded-2xl border border-slate-800 bg-slate-950 p-8">
					<p className="mb-2 font-mono text-slate-500 text-sm">
						no devices yet
					</p>
					<p className="text-slate-400">
						After first-setup on a Pi, the cloudflared replica publishes T3 Code
						through the custom endpoint. Link that hostname here when the
						pairing flow is locked.
					</p>
				</div>
				<a
					href="/projects"
					className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-8 transition-colors hover:border-blue-500/40"
				>
					<h2 className="mb-2 font-semibold text-xl">Projects</h2>
					<p className="text-slate-400">
						PCB viewer, breadboard files, and technical sheets from each Gitea
						repo.
					</p>
				</a>
				<a
					href="/keys"
					className="rounded-2xl border border-slate-800 bg-slate-950 p-8 transition-colors hover:border-blue-500/40"
				>
					<h2 className="mb-2 font-semibold text-xl">OpenCode & Gitea keys</h2>
					<p className="text-slate-400">
						Push API credentials to a linked device. These are never baked into
						the Armbian snapshot.
					</p>
				</a>
			</div>
		</div>
	);
}
