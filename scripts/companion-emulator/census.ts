import { readdirSync, readFileSync } from "node:fs";

export type ProcessInfo = {
	pid: number;
	ppid: number;
	state: string;
	rssKb: number;
	fds: number;
	comm: string;
	cmd: string;
	label?: string;
};

export type Census = {
	pid: number;
	descendants: ProcessInfo[];
	zombies: ProcessInfo[];
	registered: ProcessInfo[];
	rssKb: number;
	fds: number;
};

const SKIP_COMM = new Set(["pkill", "ps", "sleep"]);

export function census(pid: number, emuRoot?: string): Census {
	const byPid = listProcesses();
	const self = byPid.get(pid);
	const descendants = walkDescendants(pid, byPid).filter(
		(proc) => !SKIP_COMM.has(proc.comm),
	);
	const registered = emuRoot
		? registeredAlive(emuRoot, byPid)
		: descendants.filter((proc) => isHeldName(proc));
	return {
		pid,
		descendants,
		zombies: descendants.filter((proc) => proc.state === "Z"),
		registered,
		rssKb: self?.rssKb ?? 0,
		fds: self?.fds ?? 0,
	};
}

export function leftoverLabels(snapshot: Census): string[] {
	const labels = new Set<string>();
	for (const proc of snapshot.registered) {
		labels.add(proc.label ?? proc.comm);
	}
	for (const proc of snapshot.zombies) {
		labels.add(`zombie:${proc.comm}`);
	}
	return [...labels].sort();
}

function isHeldName(proc: ProcessInfo): boolean {
	return /gpioset|gpio-pwm|arduino-cli|ble-gatt|python3|\bsketch\b/.test(
		`${proc.comm} ${proc.cmd}`,
	);
}

function registeredAlive(
	emuRoot: string,
	byPid: Map<number, ProcessInfo>,
): ProcessInfo[] {
	const dir = `${emuRoot}/alive`;
	let names: string[] = [];
	try {
		names = readdirSync(dir);
	} catch {
		return [];
	}
	const live: ProcessInfo[] = [];
	for (const name of names) {
		const pid = Number(name);
		if (!Number.isInteger(pid)) {
			continue;
		}
		const proc = byPid.get(pid);
		if (!proc) {
			continue;
		}
		let label = "";
		try {
			label = readFileSync(`${dir}/${name}`, "utf8").trim();
		} catch {
			label = "";
		}
		live.push({ ...proc, label: label || proc.comm });
	}
	return live;
}

function walkDescendants(
	root: number,
	byPid: Map<number, ProcessInfo>,
): ProcessInfo[] {
	const children = new Map<number, ProcessInfo[]>();
	for (const proc of byPid.values()) {
		const list = children.get(proc.ppid) ?? [];
		list.push(proc);
		children.set(proc.ppid, list);
	}
	const out: ProcessInfo[] = [];
	const stack = [...(children.get(root) ?? [])];
	while (stack.length) {
		const proc = stack.pop();
		if (!proc) {
			continue;
		}
		out.push(proc);
		stack.push(...(children.get(proc.pid) ?? []));
	}
	return out;
}

function listProcesses(): Map<number, ProcessInfo> {
	const byPid = new Map<number, ProcessInfo>();
	let pids: string[] = [];
	try {
		pids = readdirSync("/proc");
	} catch {
		return byPid;
	}
	for (const name of pids) {
		if (!/^\d+$/.test(name)) {
			continue;
		}
		const pid = Number(name);
		const parsed = readProcess(pid);
		if (parsed) {
			byPid.set(pid, parsed);
		}
	}
	return byPid;
}

function readProcess(pid: number): ProcessInfo | null {
	try {
		const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
		const open = stat.indexOf("(");
		const close = stat.lastIndexOf(")");
		if (open < 0 || close < 0) {
			return null;
		}
		const comm = stat.slice(open + 1, close);
		const rest = stat.slice(close + 2).split(" ");
		const state = rest[0] ?? "";
		const ppid = Number(rest[1] ?? "0");
		let rssKb = 0;
		try {
			const status = readFileSync(`/proc/${pid}/status`, "utf8");
			const match = /^VmRSS:\s+(\d+)\s+kB/m.exec(status);
			rssKb = Number(match?.[1] ?? "0");
		} catch {
			rssKb = 0;
		}
		let fds = 0;
		try {
			fds = readdirSync(`/proc/${pid}/fd`).length;
		} catch {
			fds = 0;
		}
		let cmd = comm;
		try {
			cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8")
				.replace(/\0/g, " ")
				.trim();
		} catch {
			cmd = comm;
		}
		return { pid, ppid, state, rssKb, fds, comm, cmd };
	} catch {
		return null;
	}
}
