use dbus::arg::{PropMap, Variant};
use dbus::blocking::stdintf::org_freedesktop_dbus::ObjectManager;
use dbus::blocking::Connection;
use std::collections::HashMap;
use std::time::Duration;

const BLUEZ: &str = "org.bluez";
const ADAPTER: &str = "org.bluez.Adapter1";
const DEVICE: &str = "org.bluez.Device1";
const GATT: &str = "00001801-0000-1000-8000-00805f9b34fb";
const SERVICE: &str = crate::frames::BLE_SERVICE_UUID;

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

pub fn connect_le(addr: &str) -> Result<(), String> {
	let conn = system()?;
	let adapter = adapter_path(&conn)?;
	let path = device_path(&adapter, addr);
	crate::log::line(&format!("bluetooth le connect {path}"));
	let proxy = conn.with_proxy(BLUEZ, path, Duration::from_secs(20));
	for uuid in [SERVICE, GATT] {
		let result: Result<(), dbus::Error> =
			proxy.method_call(DEVICE, "ConnectProfile", (uuid,));
		match result {
			Ok(()) => {
				crate::log::line(&format!("bluetooth ConnectProfile {uuid} ok"));
				return Ok(());
			}
			Err(err) => {
				crate::log::line(&format!("bluetooth ConnectProfile {uuid}: {err}"));
			}
		}
	}
	let connected: Result<(), dbus::Error> = proxy.method_call(DEVICE, "Connect", ());
	connected.map_err(|err| format!("bluetooth Connect: {err}"))
}
