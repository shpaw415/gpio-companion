import { describe, expect, test } from "bun:test";
import { isAdmin, parseUserRole } from "./role.ts";

describe("parseUserRole", () => {
	test("defaults to user", () => {
		expect(parseUserRole()).toBe("user");
		expect(parseUserRole(null, undefined, "")).toBe("user");
	});

	test("prefers the first valid role", () => {
		expect(parseUserRole("admin", "user")).toBe("admin");
		expect(parseUserRole("user", "admin")).toBe("user");
	});

	test("ignores unknown values", () => {
		expect(parseUserRole("root", "admin")).toBe("admin");
		expect(parseUserRole("moderator")).toBe("user");
	});
});

describe("isAdmin", () => {
	test("is fail-closed", () => {
		expect(isAdmin("admin")).toBe(true);
		expect(isAdmin("user")).toBe(false);
		expect(isAdmin(undefined)).toBe(false);
		expect(isAdmin(null)).toBe(false);
	});
});
