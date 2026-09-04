import { describe, expect, test } from "bun:test";
import {
	parseSavedNetworks,
	serializeSavedNetworks,
	upsertSavedNetwork,
	WIFI_NETWORKS_MAX,
} from "./wifi-networks.ts";

describe("parseSavedNetworks", () => {
	test("reads valid entries and skips junk", () => {
		expect(parseSavedNetworks(null)).toEqual([]);
		expect(parseSavedNetworks("{")).toEqual([]);
		expect(
			parseSavedNetworks(
				JSON.stringify([
					{ ssid: "Home", psk: "password1" },
					{ ssid: "  ", psk: "x" },
					{ ssid: "Cafe" },
					"nope",
				]),
			),
		).toEqual([
			{ ssid: "Home", psk: "password1" },
			{ ssid: "Cafe", psk: "" },
		]);
	});
});

describe("upsertSavedNetwork", () => {
	test("moves to front, updates psk, and caps", () => {
		let list: ReturnType<typeof upsertSavedNetwork> = [];
		for (let index = 0; index < 21; index += 1) {
			list = upsertSavedNetwork(list, `net${index}`, "password1");
		}
		expect(list.length).toBe(WIFI_NETWORKS_MAX);
		expect(list[0]?.ssid).toBe("net20");
		list = upsertSavedNetwork(list, "net3", "updated");
		expect(list[0]).toEqual({ ssid: "net3", psk: "updated" });
		expect(list.filter((network) => network.ssid === "net3")).toHaveLength(1);
	});
});

describe("serializeSavedNetworks", () => {
	test("round-trips", () => {
		const list = [{ ssid: "Home", psk: "password1" }];
		expect(parseSavedNetworks(serializeSavedNetworks(list))).toEqual(list);
	});
});
