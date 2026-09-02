use dbus::arg::{PropMap, RefArg, Variant};
use dbus::blocking::stdintf::org_freedesktop_dbus::{ObjectManager, Properties};
use dbus::blocking::Connection;
use std::collections::HashMap;
use std::time::Duration;

const BLUEZ: &str = "org.bluez";
const ADAPTER: &str = "org.bluez.Adapter1";
const DEVICE: &str = "org.bluez.Device1";

fn system() -> Result<Connection, String> {
	Connection::new_system().map_err(|err| format!("bluetooth dbus: {err}"))
}

fn prop_bool(props: &PropMap, key: &str) -> Option<bool> {
	let variant = props.get(key)?;
	dbus::arg::cast::<bool>(&variant.0)
		.copied()
		.or_else(|| variant.0.as_i64().map(|value| value != 0))
		.or_else(|| variant.0.as_u64().map(|value| value != 0))
}

fn adapter_path(conn: &Connection) -> Result<String, String> {
	let proxy = conn.with_proxy(BLUEZ, "/", Duration::from_secs(5));
	let objects = proxy
		.get_managed_objects()
		.map_err(|err| format!("bluetooth objects: {err}"))?;
	let mut fallback = None;
	for (path, interfaces) in objects {
		let Some(props) = interfaces.get(ADAPTER) else {
			continue;
		};
		if prop_bool(props, "Powered").unwrap_or(false) {
			return Ok(path.to_string());
		}
		if fallback.is_none() {
			fallback = Some(path.to_string());
		}
	}
	fallback.ok_or_else(|| "no bluetooth adapter".to_string())
}

/// Resolve the real BlueZ object path for a device address instead of guessing
/// `/org/bluez/hciX/dev_...`. The guessed path is stale when BlueZ re-created
/// the device object or it lives on another adapter, and calling Connect there
/// fails with `org.freedesktop.DBus.Error.UnknownObject` ("Method Connect ...
/// doesn't exist").
fn resolve_device_path(conn: &Connection, addr: &str) -> Result<String, String> {
	let proxy = conn.with_proxy(BLUEZ, "/", Duration::from_secs(5));
	let objects = proxy
		.get_managed_objects()
		.map_err(|err| format!("bluetooth objects: {err}"))?;
	let needle = addr.to_ascii_uppercase();
	objects
		.into_iter()
		.find_map(|(path, interfaces)| {
			let Some(props) = interfaces.get(DEVICE) else {
				return None;
			};
			match prop_str(props, "Address") {
				Some(address) if address.to_ascii_uppercase() == needle => Some(path.to_string()),
				_ => None,
			}
		})
		.ok_or_else(|| format!("bluetooth device {addr} not in BlueZ cache"))
}

fn device_connected(conn: &Connection, path: &str) -> Result<bool, String> {
	let proxy = conn.with_proxy(BLUEZ, path, Duration::from_secs(5));
	Ok(proxy
		.get::<bool>(DEVICE, "Connected")
		.map_err(|err| format!("bluetooth device props: {err}"))?)
}

fn connect_error(err: &dbus::Error) -> String {
	let name = err.name();
	let message = err.message().unwrap_or_default();
	if name == Some("org.freedesktop.DBus.Error.UnknownObject")
		|| message.contains("doesn't exist")
		|| message.contains("UnknownObject")
	{
		"bluetooth device disappeared: move closer or re-scan and connect again".to_string()
	} else {
		format!("bluetooth Connect: {message}")
	}
}

/// BlueZ ties StartDiscovery to the D-Bus client connection. Dropping it
/// immediately stops LE scan, so the session must stay open for the whole scan.
pub struct LeDiscovery {
	conn: Option<Connection>,
	adapter: String,
	owned: bool,
}

impl LeDiscovery {
	pub fn start() -> Result<Self, String> {
		let conn = system()?;
		let adapter = adapter_path(&conn)?;
		crate::log::line(&format!("bluetooth le discovery start {adapter}"));
		let proxy = conn.with_proxy(BLUEZ, &adapter, Duration::from_secs(8));
		let mut filter: PropMap = HashMap::new();
		filter.insert("Transport".into(), Variant(Box::new("le".to_string())));
		filter.insert("DuplicateData".into(), Variant(Box::new(true)));
		let _: () = proxy
			.method_call(ADAPTER, "SetDiscoveryFilter", (filter,))
			.map_err(|err| format!("bluetooth le filter: {err}"))?;
		let started: Result<(), dbus::Error> = proxy.method_call(ADAPTER, "StartDiscovery", ());
		match started {
			Ok(()) => Ok(Self {
				conn: Some(conn),
				adapter,
				owned: true,
			}),
			Err(err) if err.name() == Some("org.bluez.Error.InProgress") => Ok(Self {
				conn: Some(conn),
				adapter,
				owned: false,
			}),
			Err(err) => Err(format!("bluetooth le scan: {err}")),
		}
	}

	fn halt(&mut self) {
		let Some(conn) = self.conn.take() else {
			return;
		};
		if !self.owned {
			return;
		}
		self.owned = false;
		crate::log::line(&format!("bluetooth le discovery stop {}", self.adapter));
		let proxy = conn.with_proxy(BLUEZ, &self.adapter, Duration::from_secs(5));
		let _: Result<(), _> = proxy.method_call(ADAPTER, "StopDiscovery", ());
	}

	pub fn stop(mut self) {
		self.halt();
	}
}

impl Drop for LeDiscovery {
	fn drop(&mut self) {
		self.halt();
	}
}

pub struct ListedDevice {
	pub address: String,
	pub name: String,
	pub rssi: Option<i16>,
	pub uuids: Vec<String>,
}

fn prop_str(props: &PropMap, key: &str) -> Option<String> {
	props.get(key)?.0.as_str().map(str::to_string)
}

fn prop_i16(props: &PropMap, key: &str) -> Option<i16> {
	props
		.get(key)?
		.0
		.as_i64()
		.and_then(|value| i16::try_from(value).ok())
}

fn prop_strings(props: &PropMap, key: &str) -> Vec<String> {
	let Some(variant) = props.get(key) else {
		return Vec::new();
	};
	let Some(iter) = variant.0.as_iter() else {
		return Vec::new();
	};
	iter.filter_map(|item| item.as_str().map(str::to_string))
		.collect()
}

pub fn list_le_devices() -> Result<Vec<ListedDevice>, String> {
	let conn = system()?;
	let proxy = conn.with_proxy(BLUEZ, "/", Duration::from_secs(5));
	let objects = proxy
		.get_managed_objects()
		.map_err(|err| format!("bluetooth objects: {err}"))?;
	let mut devices = Vec::new();
	for (_path, interfaces) in objects {
		let Some(props) = interfaces.get(DEVICE) else {
			continue;
		};
		let Some(address) = prop_str(props, "Address").filter(|value| !value.is_empty()) else {
			continue;
		};
		let name = prop_str(props, "Alias")
			.filter(|value| !value.is_empty())
			.or_else(|| prop_str(props, "Name").filter(|value| !value.is_empty()))
			.unwrap_or_default();
		devices.push(ListedDevice {
			address,
			name,
			rssi: prop_i16(props, "RSSI"),
			uuids: prop_strings(props, "UUIDs"),
		});
	}
	Ok(devices)
}

pub fn disconnect_le(addr: &str) {
	if let Ok(conn) = system() {
		if let Ok(path) = resolve_device_path(&conn, addr) {
			let proxy = conn.with_proxy(BLUEZ, path, Duration::from_secs(3));
			let _: Result<(), _> = proxy.method_call(DEVICE, "Disconnect", ());
		}
	}
}

pub fn connect_le(addr: &str) -> Result<(), String> {
	connect_le_timeout(addr, Duration::from_secs(8))
}

pub fn connect_le_timeout(addr: &str, timeout: Duration) -> Result<(), String> {
	let conn = system()?;
	let path = resolve_device_path(&conn, addr)?;
	crate::log::line(&format!("bluetooth le connect {path}"));
	let proxy = conn.with_proxy(BLUEZ, &path, timeout);
	// Only disconnect when the link is actually up. BlueZ's Disconnect can
	// cancel an in-flight Connect and, for non-trusted LE devices, disables
	// incoming connections until Connect is called again — so an unconditional
	// pre-disconnect is not safe.
	if device_connected(&conn, &path).unwrap_or(false) {
		let _: Result<(), _> = proxy.method_call(DEVICE, "Disconnect", ());
		std::thread::sleep(Duration::from_millis(150));
	}
	match proxy.method_call(DEVICE, "Connect", ()) {
		Ok(()) => Ok(()),
		Err(err) if err.name() == Some("org.bluez.Error.AlreadyConnected") => Ok(()),
		Err(err) if err.name() == Some("org.bluez.Error.InProgress") => Ok(()),
		Err(err) => Err(connect_error(&err)),
	}
}
