use crate::config::{KEYRING_SERVICE, KEYRING_USER};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tokens {
	pub access: String,
	pub refresh: Option<String>,
	pub expires_at: Option<i64>,
}

fn file_path() -> PathBuf {
	let base = std::env::var_os("XDG_CONFIG_HOME")
		.map(PathBuf::from)
		.or_else(|| {
			std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config"))
		})
		.unwrap_or_else(|| PathBuf::from("."));
	base.join("gpio-companion-desktop").join("tokens.json")
}

fn keyring_entry() -> Result<keyring::Entry, String> {
	keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|err| err.to_string())
}

pub fn load() -> Option<Tokens> {
	if let Ok(entry) = keyring_entry() {
		if let Ok(raw) = entry.get_password() {
			if let Ok(tokens) = serde_json::from_str::<Tokens>(&raw) {
				if !tokens.access.is_empty() {
					return Some(tokens);
				}
			}
		}
	}
	let raw = fs::read_to_string(file_path()).ok()?;
	serde_json::from_str(&raw).ok()
}

pub fn save(tokens: &Tokens) -> Result<(), String> {
	let raw = serde_json::to_string(tokens).map_err(|err| err.to_string())?;
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

pub fn clear() {
	if let Ok(entry) = keyring_entry() {
		let _ = entry.delete_credential();
	}
	let _ = fs::remove_file(file_path());
}

pub fn access_token() -> Result<String, String> {
	load()
		.map(|tokens| tokens.access)
		.filter(|token| !token.is_empty())
		.ok_or_else(|| "sign in first".to_string())
}
