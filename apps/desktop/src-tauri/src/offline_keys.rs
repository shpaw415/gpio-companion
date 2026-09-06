use crate::config::KEYRING_SERVICE;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;

const KEYRING_USER: &str = "offline-keys";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineKeyRecord {
	pub uuid: String,
	#[serde(rename = "privateKeyPem")]
	pub private_key_pem: String,
	pub grant: Value,
	pub exp: i64,
}

fn file_path() -> PathBuf {
	let base = std::env::var_os("XDG_CONFIG_HOME")
		.map(PathBuf::from)
		.or_else(|| {
			std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config"))
		})
		.unwrap_or_else(|| PathBuf::from("."));
	base.join("gpio-companion-desktop")
		.join("offline-keys.json")
}

fn keyring_entry() -> Result<keyring::Entry, String> {
	keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|err| err.to_string())
}

fn load_map() -> Map<String, Value> {
	if let Ok(entry) = keyring_entry() {
		if let Ok(raw) = entry.get_password() {
			if let Ok(Value::Object(map)) = serde_json::from_str::<Value>(&raw) {
				return map;
			}
		}
	}
	fs::read_to_string(file_path())
		.ok()
		.and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
		.and_then(|value| value.as_object().cloned())
		.unwrap_or_default()
}

fn save_map(map: &Map<String, Value>) -> Result<(), String> {
	let raw = serde_json::to_string(map).map_err(|err| err.to_string())?;
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

pub fn get(uuid: &str) -> Option<Value> {
	let trimmed = uuid.trim();
	if trimmed.is_empty() {
		return None;
	}
	load_map().get(trimmed).cloned()
}

pub fn put(record: Value) -> Result<(), String> {
	let uuid = record
		.get("uuid")
		.and_then(Value::as_str)
		.map(str::trim)
		.filter(|value| !value.is_empty())
		.ok_or_else(|| "uuid is required".to_string())?
		.to_string();
	let mut map = load_map();
	map.insert(uuid, record);
	save_map(&map)
}

pub fn clear() {
	if let Ok(entry) = keyring_entry() {
		let _ = entry.delete_credential();
	}
	let _ = fs::remove_file(file_path());
}
