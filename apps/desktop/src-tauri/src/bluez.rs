use dbus::arg::{PropMap, RefArg, Variant};
use dbus::blocking::stdintf::org_freedesktop_dbus::ObjectManager;
use dbus::blocking::Connection;
use std::collections::HashMap;
use std::time::Duration;

const BLUEZ: &str = "org.bluez";
const ADAPTER: &str = "org.bluez.Adapter1";
const DEVICE: &str = "org.bluez.Device1";

fn system() -> Result<Connection, String> {
	Connection::new_system().map_err(|err| format!("bluetooth dbus: {err}"))
}

fn adapter_path(conn: &Connection) -> Result<String, String> {
	let proxy = conn.with_proxy(BLUEZ, "/", Duration::from_secs(5));
	let objects = proxy
		.get_managed_objects()
		.map_err(|err| format!("bluetooth objects: {err}"))?;
	objects
		.into_iter()
		.find_map(|(path, interfaces)| {
			interfaces.contains_key(ADAPTER).then(|| path.to_string())
		})
		.ok_or_else(|| "no bluetooth adapter".to_string())
}

fn device_path(adapter: &str, addr: &str) -> String {
	format!(
		"{}/dev_{}",
		adapter,
		addr.replace(':', "_").to_ascii_uppercase()
	)
}

pub fn start_le_discovery() -> Result<(), String> {
	let conn = system()?;
	let adapter = adapter_path(&conn)?;
	crate::log::line(&format!("bluetooth le discovery start {adapter}"));
	let proxy = conn.with_proxy(BLUEZ, adapter, Duration::from_secs(8));
	let mut filter: PropMap = HashMap::new();
	filter.insert("Transport".into(), Variant(Box::new("le".to_string())));
	filter.insert("DuplicateData".into(), Variant(Box::new(true)));
	let _: () = proxy
		.method_call(ADAPTER, "SetDiscoveryFilter", (filter,))
		.map_err(|err| format!("bluetooth le filter: {err}"))?;
	let started: Result<(), dbus::Error> = proxy.method_call(ADAPTER, "StartDiscovery", ());
	match started {
		Ok(()) => Ok(()),
		Err(err) if err.name() == Some("org.bluez.Error.InProgress") => Ok(()),
		Err(err) => Err(format!("bluetooth le scan: {err}")),
	}
}

pub fn stop_le_discovery() {
	if let Ok(conn) = system() {
		if let Ok(adapter) = adapter_path(&conn) {
			let proxy = conn.with_proxy(BLUEZ, adapter, Duration::from_secs(5));
			let _: Result<(), _> = proxy.method_call(ADAPTER, "StopDiscovery", ());
		}
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
		if let Ok(adapter) = adapter_path(&conn) {
			let path = device_path(&adapter, addr);
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
	let adapter = adapter_path(&conn)?;
	let path = device_path(&adapter, addr);
	crate::log::line(&format!("bluetooth le connect {path}"));
	let proxy = conn.with_proxy(BLUEZ, path, timeout);
	let _: Result<(), _> = proxy.method_call(DEVICE, "Disconnect", ());
	std::thread::sleep(Duration::from_millis(150));
	match proxy.method_call(DEVICE, "Connect", ()) {
		Ok(()) => Ok(()),
		Err(err) if err.name() == Some("org.bluez.Error.AlreadyConnected") => Ok(()),
		Err(err) if err.name() == Some("org.bluez.Error.InProgress") => Ok(()),
		Err(err) => Err(format!("bluetooth Connect: {err}")),
	}
}
