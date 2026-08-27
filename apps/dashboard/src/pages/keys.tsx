import KeysForm from "@components/KeysForm";

export default function KeysPage() {
	return (
		<div className="container mx-auto px-4 py-16">
			<h1 className="mb-4 font-bold text-4xl tracking-tight">Keys</h1>
			<p className="mb-10 max-w-2xl text-lg text-slate-400">
				OpenCode API key and Gitea token are assigned here and pushed to the
				linked hardware. They are not collected at first-boot.
			</p>
			<KeysForm />
		</div>
	);
}
