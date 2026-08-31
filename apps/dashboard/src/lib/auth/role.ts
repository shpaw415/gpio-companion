export type UserRole = "user" | "admin";

export function parseUserRole(...values: unknown[]): UserRole {
	for (const value of values) {
		if (value === "admin") {
			return "admin";
		}
		if (value === "user") {
			return "user";
		}
	}
	return "user";
}

export function isAdmin(role: UserRole | null | undefined): boolean {
	return role === "admin";
}
