import { GET as getHello } from "@api/hello";
import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function ServerActionDemo() {
	const [status, setStatus] = useState<Status>("idle");
	const [result, setResult] = useState<string | null>(null);

	async function handleCall() {
		setStatus("loading");
		setResult(null);
		try {
			const data = await getHello();
			setResult(String(data));
			setStatus("success");
		} catch (err) {
			setResult(err instanceof Error ? err.message : "Unknown error");
			setStatus("error");
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<button
				type="button"
				onClick={handleCall}
				disabled={status === "loading"}
				className="self-start inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full font-semibold text-sm transition-all shadow-lg shadow-blue-500/25"
			>
				{status === "loading" ? (
					<>
						<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
						Calling…
					</>
				) : (
					<>⚡ Call GET /api/hello</>
				)}
			</button>

			{(status === "success" || status === "error") && result !== null && (
				<div
					className={`rounded-xl border px-5 py-4 font-mono text-sm ${
						status === "success"
							? "bg-slate-950 border-blue-500/30 text-blue-300"
							: "bg-slate-950 border-red-500/30 text-red-400"
					}`}
				>
					<span className="text-slate-500 select-none mr-2">→</span>
					{result}
				</div>
			)}
		</div>
	);
}
