export default function Layout({ children }: { children: React.JSX.Element }) {
	return (
		<div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
			<nav className="fixed top-0 right-0 left-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
				<div className="container mx-auto flex h-16 items-center justify-between px-4">
					<a href="/" className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600 font-bold text-white shadow-lg shadow-blue-500/20">
							GC
						</div>
						<div className="flex flex-col">
							<span className="bg-linear-to-r from-white to-slate-400 bg-clip-text font-bold text-lg tracking-tight text-transparent leading-none">
								gpio-companion
							</span>
							<span className="mt-1 font-mono text-[10px] text-slate-500 uppercase tracking-wider leading-none">
								dashboard
							</span>
						</div>
					</a>
					<div className="flex items-center gap-6 font-medium text-slate-400 text-sm">
						<a href="/" className="transition-colors hover:text-white">
							Hardware
						</a>
						<a href="/projects" className="transition-colors hover:text-white">
							Projects
						</a>
						<a href="/keys" className="transition-colors hover:text-white">
							Keys
						</a>
					</div>
				</div>
			</nav>
			<main className="pt-16">{children}</main>
		</div>
	);
}
