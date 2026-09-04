export const CACHE_TTL_MS = 60 * 60 * 1000;

export type CacheHit<T> = { hit: true; value: T } | { hit: false };

type Entry = { value: unknown; at: number };

export class QueryCache {
	private readonly entries = new Map<string, Entry>();
	private readonly inflight = new Map<string, Promise<unknown>>();
	private readonly listeners = new Set<() => void>();
	private readonly ttlMs: number;
	private readonly now: () => number;

	constructor(options?: { ttlMs?: number; now?: () => number }) {
		this.ttlMs = options?.ttlMs ?? CACHE_TTL_MS;
		this.now = options?.now ?? Date.now;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	peek<T>(key: string): CacheHit<T> {
		const entry = this.entries.get(key);
		if (!entry) {
			return { hit: false };
		}
		if (this.now() - entry.at >= this.ttlMs) {
			this.entries.delete(key);
			return { hit: false };
		}
		return { hit: true, value: entry.value as T };
	}

	set<T>(key: string, value: T): void {
		this.entries.set(key, { value, at: this.now() });
		this.notify();
	}

	invalidate(key: string): void {
		if (!this.entries.delete(key)) {
			return;
		}
		this.notify();
	}

	clear(): void {
		this.entries.clear();
		this.inflight.clear();
		this.notify();
	}

	get<T>(
		key: string,
		fetcher: () => Promise<T>,
		force = false,
	): Promise<T> {
		if (!force) {
			const cached = this.peek<T>(key);
			if (cached.hit) {
				return Promise.resolve(cached.value);
			}
		}
		const pending = this.inflight.get(key) as Promise<T> | undefined;
		if (pending) {
			return pending;
		}
		const promise = fetcher()
			.then((value) => {
				this.set(key, value);
				return value;
			})
			.finally(() => {
				if (this.inflight.get(key) === promise) {
					this.inflight.delete(key);
				}
			});
		this.inflight.set(key, promise);
		return promise;
	}

	private notify() {
		for (const listener of [...this.listeners]) {
			listener();
		}
	}
}
