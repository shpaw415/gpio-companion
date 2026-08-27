import { type FormEvent, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function KeysForm() {
	const [deviceUrl, setDeviceUrl] = useState("");
	const [opencodeApiKey, setOpencodeApiKey] = useState("");
	const [giteaToken, setGiteaToken] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [message, setMessage] = useState("");

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		const origin = deviceUrl.replace(/\/+$/, "");
		if (!origin) {
			setStatus("error");
			setMessage("device URL is required");
			return;
		}
		setStatus("loading");
		setMessage("");
		try {
			const response = await fetch(`${origin}/v1/config/secrets`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ opencodeApiKey, giteaToken }),
			});
			if (!response.ok) {
				throw new Error(`device responded ${response.status}`);
			}
			setStatus("success");
			setMessage("saved on device");
			setOpencodeApiKey("");
			setGiteaToken("");
		} catch (error) {
			setStatus("error");
			setMessage(error instanceof Error ? error.message : "save failed");
		}
	}

	return (
		<form className="flex max-w-xl flex-col gap-5" onSubmit={onSubmit}>
			<label className="flex flex-col gap-2">
				<span className="text-slate-300 text-sm">Device URL</span>
				<input
					className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
					placeholder="https://pi.example.com:4150"
					value={deviceUrl}
					onChange={(event) => setDeviceUrl(event.target.value)}
				/>
			</label>
			<label className="flex flex-col gap-2">
				<span className="text-slate-300 text-sm">OpenCode API key</span>
				<input
					className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
					type="password"
					autoComplete="off"
					value={opencodeApiKey}
					onChange={(event) => setOpencodeApiKey(event.target.value)}
				/>
			</label>
			<label className="flex flex-col gap-2">
				<span className="text-slate-300 text-sm">Gitea token</span>
				<input
					className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
					type="password"
					autoComplete="off"
					value={giteaToken}
					onChange={(event) => setGiteaToken(event.target.value)}
				/>
			</label>
			<button
				className="self-start rounded-full bg-blue-600 px-6 py-3 font-semibold disabled:opacity-50"
				disabled={status === "loading"}
				type="submit"
			>
				{status === "loading" ? "Saving…" : "Save to device"}
			</button>
			{message ? (
				<p className={status === "error" ? "text-red-400" : "text-emerald-400"}>
					{message}
				</p>
			) : null}
		</form>
	);
}
