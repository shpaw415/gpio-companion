use crate::config::KEYRING_SERVICE;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

pub const MAX_SAVED: usize = 20;
const KEYRING_USER: &str = "wifi-networks";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KnownNetwork {
	pub ssid: String,
	pub psk: String,
	pub source: String,
	pub current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SavedNetwork {
	pub ssid: String,
	pub psk: String,
}

pub fn known_networks() -> Vec<KnownNetwork> {
	merge_networks(&load_saved(), &os_networks(), os_current_ssid().as_deref())
}

pub fn network_psk(ssid: &str) -> String {
	let ssid = ssid.trim();
	if ssid.is_empty() {
		return String::new();
	}
	if let Some(psk) = load_saved()
		.into_iter()
		.find(|network| network.ssid == ssid)
		.map(|network| network.psk)
		.filter(|psk| !psk.is_empty())
	{
		return psk;
	}
	os_psk(ssid)
}

pub fn remember_network(ssid: &str, psk: &str) -> Result<(), String> {
	let ssid = ssid.trim();
	if ssid.is_empty() {
		return Ok(());
	}
	save_saved(&upsert_saved(load_saved(), ssid, psk))
}

pub fn merge_networks(
	saved: &[SavedNetwork],
	os: &[SavedNetwork],
	current: Option<&str>,
) -> Vec<KnownNetwork> {
	let current = current.map(str::trim).filter(|ssid| !ssid.is_empty());
	let mut seen = HashSet::new();
	let mut out = Vec::new();

	let mut push = |ssid: &str, psk: String, source: &str| {
		if ssid.is_empty() || !seen.insert(ssid.to_string()) {
			return;
		}
		out.push(KnownNetwork {
			ssid: ssid.to_string(),
			psk,
			source: source.to_string(),
			current: current == Some(ssid),
		});
	};

	if let Some(ssid) = current {
		let saved_psk = saved
			.iter()
			.find(|network| network.ssid == ssid)
			.map(|network| network.psk.as_str())
			.unwrap_or("");
		let os_psk = os
			.iter()
			.find(|network| network.ssid == ssid)
			.map(|network| network.psk.as_str())
			.unwrap_or("");
		let psk = if os_psk.is_empty() {
			saved_psk
		} else {
			os_psk
		};
		let source = if os.iter().any(|network| network.ssid == ssid) {
			"os"
		} else {
			"saved"
		};
		push(ssid, psk.to_string(), source);
	}

	for network in saved {
		let os_psk = os
			.iter()
			.find(|item| item.ssid == network.ssid)
			.map(|item| item.psk.as_str())
			.unwrap_or("");
		let psk = if os_psk.is_empty() {
			network.psk.as_str()
		} else {
			os_psk
		};
		let source = if os.iter().any(|item| item.ssid == network.ssid) {
			"os"
		} else {
			"saved"
		};
		push(&network.ssid, psk.to_string(), source);
	}

	for network in os {
		push(&network.ssid, network.psk.clone(), "os");
	}

	out
}

pub fn upsert_saved(list: Vec<SavedNetwork>, ssid: &str, psk: &str) -> Vec<SavedNetwork> {
	let ssid = ssid.trim();
	if ssid.is_empty() {
		return list;
	}
	let mut next: Vec<SavedNetwork> = list
		.into_iter()
		.filter(|network| network.ssid != ssid)
		.collect();
	next.insert(
		0,
		SavedNetwork {
			ssid: ssid.to_string(),
			psk: psk.to_string(),
		},
	);
	next.truncate(MAX_SAVED);
	next
}

pub fn parse_saved(raw: &str) -> Vec<SavedNetwork> {
	serde_json::from_str(raw).unwrap_or_default()
}

pub fn parse_nmcli_connections(raw: &str) -> Vec<String> {
	raw.lines()
		.filter_map(|line| {
			let (name, kind) = line.rsplit_once(':')?;
			if is_wifi_type(kind) && !name.is_empty() {
				Some(unescape_nmcli(name))
			} else {
				None
			}
		})
		.collect()
}

pub fn parse_nmcli_ssid_psk(raw: &str) -> Option<SavedNetwork> {
	let mut lines = raw.lines();
	let ssid = unescape_nmcli(lines.next()?.trim());
	if ssid.is_empty() {
		return None;
	}
	let psk = lines.next().unwrap_or("").trim().to_string();
	Some(SavedNetwork { ssid, psk })
}

pub fn parse_nmcli_current(raw: &str) -> Option<String> {
	for line in raw.lines() {
		let (flag, ssid) = line.split_once(':')?;
		let flag = flag.trim();
		if flag == "*" || flag.eq_ignore_ascii_case("yes") {
			let ssid = unescape_nmcli(ssid.trim());
			if !ssid.is_empty() {
				return Some(ssid);
			}
		}
	}
	None
}

pub fn parse_netsh_profiles(raw: &str) -> Vec<String> {
	raw.lines()
		.filter_map(|line| {
			let (key, value) = line.split_once(':')?;
			let key = key.trim();
			if key == "All User Profile" || key == "Current User Profile" {
				let ssid = unquote(value.trim());
				if ssid.is_empty() {
					None
				} else {
					Some(ssid)
				}
			} else {
				None
			}
		})
		.collect()
}

pub fn parse_netsh_profile(raw: &str) -> Option<SavedNetwork> {
	let mut ssid = String::new();
	let mut psk = String::new();
	for line in raw.lines() {
		let Some((key, value)) = line.split_once(':') else {
			continue;
		};
		match key.trim() {
			"SSID name" => ssid = unquote(value.trim()),
			"Key Content" => psk = value.trim().to_string(),
			_ => {}
		}
	}
	if ssid.is_empty() {
		None
	} else {
		Some(SavedNetwork { ssid, psk })
	}
}

pub fn parse_netsh_current(raw: &str) -> Option<String> {
	for line in raw.lines() {
		let Some((key, value)) = line.split_once(':') else {
			continue;
		};
		if key.trim() == "SSID" {
			let ssid = unquote(value.trim());
			if !ssid.is_empty() {
				return Some(ssid);
			}
		}
	}
	None
}

pub fn parse_macos_wifi_device(raw: &str) -> Option<String> {
	let mut pending = false;
	for line in raw.lines() {
		let line = line.trim();
		if let Some(port) = line.strip_prefix("Hardware Port:") {
			let port = port.trim();
			pending = port.eq_ignore_ascii_case("wi-fi") || port.eq_ignore_ascii_case("airport");
			continue;
		}
		if pending {
			if let Some(device) = line.strip_prefix("Device:") {
				let device = device.trim();
				if !device.is_empty() {
					return Some(device.to_string());
				}
			}
		}
	}
	None
}

pub fn parse_macos_preferred(raw: &str) -> Vec<String> {
	raw.lines()
		.skip(1)
		.map(str::trim)
		.filter(|ssid| !ssid.is_empty())
		.map(ToString::to_string)
		.collect()
}

pub fn parse_macos_current(raw: &str) -> Option<String> {
	for line in raw.lines() {
		if let Some(ssid) = line.strip_prefix("Current Wi-Fi Network:") {
			let ssid = ssid.trim();
			if !ssid.is_empty() {
				return Some(ssid.to_string());
			}
		}
	}
	None
}

fn os_networks() -> Vec<SavedNetwork> {
	#[cfg(target_os = "linux")]
	{
		return linux_networks();
	}
	#[cfg(target_os = "windows")]
	{
		return windows_networks();
	}
	#[cfg(target_os = "macos")]
	{
		return macos_networks();
	}
	#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
	{
		Vec::new()
	}
}

fn os_current_ssid() -> Option<String> {
	#[cfg(target_os = "linux")]
	{
		return run("nmcli", &["-t", "-f", "IN-USE,SSID", "device", "wifi"])
			.and_then(|raw| parse_nmcli_current(&raw));
	}
	#[cfg(target_os = "windows")]
	{
		return run("netsh", &["wlan", "show", "interfaces"])
			.and_then(|raw| parse_netsh_current(&raw));
	}
	#[cfg(target_os = "macos")]
	{
		let device = macos_wifi_device()?;
		return run("networksetup", &["-getairportnetwork", &device])
			.and_then(|raw| parse_macos_current(&raw));
	}
	#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
	{
		None
	}
}

fn os_psk(ssid: &str) -> String {
	#[cfg(target_os = "linux")]
	{
		return linux_psk(ssid);
	}
	#[cfg(target_os = "windows")]
	{
		return windows_psk(ssid);
	}
	#[cfg(target_os = "macos")]
	{
		return macos_psk(ssid);
	}
	#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
	{
		String::new()
	}
}

#[cfg(target_os = "linux")]
fn linux_networks() -> Vec<SavedNetwork> {
	let Some(raw) = run("nmcli", &["-t", "-f", "NAME,TYPE", "connection", "show"]) else {
		return Vec::new();
	};
	parse_nmcli_connections(&raw)
		.into_iter()
		.filter_map(|name| {
			run(
				"nmcli",
				&[
					"-t",
					"-s",
					"-g",
					"802-11-wireless.ssid,802-11-wireless-security.psk",
					"connection",
					"show",
					&name,
				],
			)
			.and_then(|body| parse_nmcli_ssid_psk(&body))
		})
		.collect()
}

#[cfg(target_os = "linux")]
fn linux_psk(ssid: &str) -> String {
	linux_networks()
		.into_iter()
		.find(|network| network.ssid == ssid)
		.map(|network| network.psk)
		.unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn windows_networks() -> Vec<SavedNetwork> {
	let Some(raw) = run("netsh", &["wlan", "show", "profiles"]) else {
		return Vec::new();
	};
	parse_netsh_profiles(&raw)
		.into_iter()
		.filter_map(|ssid| {
			let name = format!("name={ssid}");
			run("netsh", &["wlan", "show", "profile", &name, "key=clear"])
				.and_then(|body| parse_netsh_profile(&body))
		})
		.collect()
}

#[cfg(target_os = "windows")]
fn windows_psk(ssid: &str) -> String {
	let name = format!("name={ssid}");
	run("netsh", &["wlan", "show", "profile", &name, "key=clear"])
		.and_then(|raw| parse_netsh_profile(&raw))
		.map(|network| network.psk)
		.unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn macos_networks() -> Vec<SavedNetwork> {
	let Some(device) = macos_wifi_device() else {
		return Vec::new();
	};
	let Some(raw) = run(
		"networksetup",
		&["-listpreferredwirelessnetworks", &device],
	) else {
		return Vec::new();
	};
	parse_macos_preferred(&raw)
		.into_iter()
		.map(|ssid| SavedNetwork {
			ssid,
			psk: String::new(),
		})
		.collect()
}

#[cfg(target_os = "macos")]
fn macos_psk(ssid: &str) -> String {
	run(
		"security",
		&[
			"find-generic-password",
			"-D",
			"AirPort network password",
			"-wa",
			ssid,
		],
	)
	.map(|raw| raw.trim().to_string())
	.unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn macos_wifi_device() -> Option<String> {
	run("networksetup", &["-listallhardwareports"])
		.and_then(|raw| parse_macos_wifi_device(&raw))
}

fn load_saved() -> Vec<SavedNetwork> {
	if let Ok(entry) = keyring_entry() {
		if let Ok(raw) = entry.get_password() {
			let list = parse_saved(&raw);
			if !list.is_empty() {
				return list;
			}
		}
	}
	fs::read_to_string(file_path())
		.ok()
		.map(|raw| parse_saved(&raw))
		.unwrap_or_default()
}

fn save_saved(list: &[SavedNetwork]) -> Result<(), String> {
	let raw = serde_json::to_string(list).map_err(|err| err.to_string())?;
	if let Ok(entry) = keyring_entry() {
		if entry.set_password(&raw).is_ok() {
			return Ok(());
		}
	}
	let path = file_path();
	if let Some(parent) = path.parent() {
		fs::create_dir_all(parent).map_err(|err| err.to_string())?;
	}
	fs::write(&path, raw).map_err(|err| err.to_string())?;
	#[cfg(unix)]
	{
		use std::os::unix::fs::PermissionsExt;
		let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
	}
	Ok(())
}

fn keyring_entry() -> Result<keyring::Entry, String> {
	keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|err| err.to_string())
}

fn file_path() -> PathBuf {
	let base = std::env::var_os("XDG_CONFIG_HOME")
		.map(PathBuf::from)
		.or_else(|| {
			std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config"))
		})
		.unwrap_or_else(|| PathBuf::from("."));
	base.join("gpio-companion-desktop")
		.join("wifi-networks.json")
}

fn run(program: &str, args: &[&str]) -> Option<String> {
	let output = Command::new(program).args(args).output().ok()?;
	if !output.status.success() {
		return None;
	}
	Some(decode(&output.stdout))
}

fn decode(bytes: &[u8]) -> String {
	if let Ok(text) = std::str::from_utf8(bytes) {
		return text.to_string();
	}
	if bytes.len() >= 2 && bytes.len() % 2 == 0 {
		let start = if bytes.starts_with(&[0xFF, 0xFE]) {
			2
		} else {
			0
		};
		let units: Vec<u16> = bytes[start..]
			.chunks_exact(2)
			.map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
			.collect();
		return String::from_utf16_lossy(&units);
	}
	String::from_utf8_lossy(bytes).into_owned()
}

fn is_wifi_type(kind: &str) -> bool {
	kind == "802-11-wireless" || kind == "wifi" || kind == "wireless"
}

fn unescape_nmcli(value: &str) -> String {
	value.replace("\\:", ":").replace("\\\\", "\\")
}

fn unquote(value: &str) -> String {
	value
		.trim()
		.trim_matches('"')
		.trim()
		.to_string()
}

#[cfg(test)]
mod tests {
	use super::*;

	fn saved(ssid: &str, psk: &str) -> SavedNetwork {
		SavedNetwork {
			ssid: ssid.to_string(),
			psk: psk.to_string(),
		}
	}

	#[test]
	fn upsert_moves_to_front_and_caps() {
		let mut list = Vec::new();
		for index in 0..21 {
			list = upsert_saved(list, &format!("net{index}"), "password1");
		}
		assert_eq!(list.len(), MAX_SAVED);
		assert_eq!(list[0].ssid, "net20");
		list = upsert_saved(list, "net3", "updated");
		assert_eq!(list[0].ssid, "net3");
		assert_eq!(list[0].psk, "updated");
		assert_eq!(list.iter().filter(|network| network.ssid == "net3").count(), 1);
	}

	#[test]
	fn merge_prefers_os_psk_else_saved_and_marks_current() {
		let merged = merge_networks(
			&[saved("Home", "remembered"), saved("Cafe", "cafe-psk")],
			&[saved("Home", "os-psk"), saved("Office", "")],
			Some("Home"),
		);
		assert_eq!(merged[0].ssid, "Home");
		assert_eq!(merged[0].psk, "os-psk");
		assert_eq!(merged[0].source, "os");
		assert!(merged[0].current);
		assert_eq!(merged[1].ssid, "Cafe");
		assert_eq!(merged[1].source, "saved");
		assert_eq!(merged[2].ssid, "Office");
		assert_eq!(merged[2].source, "os");
		assert_eq!(merged.len(), 3);
	}

	#[test]
	fn merge_uses_saved_psk_when_os_blank() {
		let merged = merge_networks(
			&[saved("Home", "remembered")],
			&[saved("Home", "")],
			None,
		);
		assert_eq!(merged.len(), 1);
		assert_eq!(merged[0].psk, "remembered");
		assert_eq!(merged[0].source, "os");
	}

	#[test]
	fn parses_nmcli_connections_and_current() {
		assert_eq!(
			parse_nmcli_connections(
				"HomeWiFi:802-11-wireless\nWired:802-3-ethernet\nGuest:wifi\n"
			),
			vec!["HomeWiFi".to_string(), "Guest".to_string()]
		);
		assert_eq!(
			parse_nmcli_current(" :Other\n*:Home:WiFi\n"),
			Some("Home:WiFi".to_string())
		);
		assert_eq!(
			parse_nmcli_ssid_psk("HomeWiFi\nsecret\n"),
			Some(saved("HomeWiFi", "secret"))
		);
	}

	#[test]
	fn parses_netsh_profiles_current_and_key() {
		let profiles = "\n    All User Profile     : HomeWiFi\n    Current User Profile : Phone\n";
		assert_eq!(
			parse_netsh_profiles(profiles),
			vec!["HomeWiFi".to_string(), "Phone".to_string()]
		);
		assert_eq!(
			parse_netsh_current("    BSSID                   : aa:bb\n    SSID                   : HomeWiFi\n"),
			Some("HomeWiFi".to_string())
		);
		assert_eq!(
			parse_netsh_profile(
				"    SSID name            : \"HomeWiFi\"\n    Key Content            : hunter2\n"
			),
			Some(saved("HomeWiFi", "hunter2"))
		);
	}

	#[test]
	fn parses_macos_device_preferred_and_current() {
		assert_eq!(
			parse_macos_wifi_device(
				"Hardware Port: Ethernet\nDevice: en1\n\nHardware Port: Wi-Fi\nDevice: en0\n"
			),
			Some("en0".to_string())
		);
		assert_eq!(
			parse_macos_preferred("Preferred networks on en0:\n\tHomeWiFi\n\tPhone\n"),
			vec!["HomeWiFi".to_string(), "Phone".to_string()]
		);
		assert_eq!(
			parse_macos_current("Current Wi-Fi Network: HomeWiFi\n"),
			Some("HomeWiFi".to_string())
		);
		assert_eq!(
			parse_macos_current("You are not associated with an AirPort network.\n"),
			None
		);
	}
}
