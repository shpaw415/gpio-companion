use crate::frames::{
	self, BLE_CHUNK_SIZE, BLE_CMD_UUID, BLE_INFO_UUID, BLE_STATUS_UUID,
};
use btleplug::api::{
	Central, Characteristic, Manager as _, Peripheral as _, ScanFilter, WriteType,
};
use btleplug::platform::{Manager, Peripheral};
use futures::StreamExt;
use serde::Deserialize;
use serde_json::Value;
use std::time::Duration;
use tokio::time::{sleep, timeout};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct BleInfo {
	#[allow(dead_code)]
	pub uuid: String,
	#[serde(rename = "deviceUrl")]
	pub device_url: Option<String>,
}

fn parse_uuid(value: &str) -> Result<Uuid, String> {
	Uuid::parse_str(value).map_err(|err| err.to_string())
}

async fn adapter() -> Result<btleplug::platform::Adapter, String> {
	let manager = Manager::new().await.map_err(|err| {
		let message = format!("bluetooth manager: {err}");
		crate::log::line(&message);
		message
	})?;
	manager
		.adapters()
		.await
		.map_err(|err| {
			let message = format!("bluetooth adapters: {err}");
			crate::log::line(&message);
			message
		})?
		.into_iter()
		.next()
		.ok_or_else(|| {
			crate::log::line("no bluetooth adapter");
			"no bluetooth adapter".to_string()
		})
}

pub async fn scan_board(timeout_ms: u64) -> Result<Peripheral, String> {
	let adapter = adapter().await?;
	adapter
		.start_scan(ScanFilter::default())
		.await
		.map_err(|err| {
			let message = format!("bluetooth scan: {err}");
			crate::log::line(&message);
			message
		})?;
	let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);
	loop {
		if tokio::time::Instant::now() > deadline {
			let _ = adapter.stop_scan().await;
			return Err("no gpio-companion board found".to_string());
		}
		let peripherals = adapter
			.peripherals()
			.await
			.map_err(|err| err.to_string())?;
		for peripheral in peripherals {
			if let Ok(Some(props)) = peripheral.properties().await {
				let name = props.local_name.as_deref();
				let services: Vec<String> =
					props.services.iter().map(|id| id.to_string()).collect();
				let refs: Vec<&str> = services.iter().map(String::as_str).collect();
				if frames::matches_board(name, &refs) {
					crate::log::line(&format!(
						"bluetooth found name={} addr={} type={:?} rssi={:?}",
						name.unwrap_or("-"),
						props.address,
						props.address_type,
						props.rssi
					));
					let _ = adapter.stop_scan().await;
					sleep(Duration::from_millis(400)).await;
					return Ok(peripheral);
				}
			}
		}
		sleep(Duration::from_millis(300)).await;
	}
}

fn find_char(peripheral: &Peripheral, uuid: &str) -> Result<Characteristic, String> {
	let id = parse_uuid(uuid)?;
	peripheral
		.characteristics()
		.into_iter()
		.find(|characteristic| characteristic.uuid == id)
		.ok_or_else(|| format!("missing characteristic {uuid}"))
}

async fn ensure_connected(peripheral: &Peripheral) -> Result<(), String> {
	if peripheral.is_connected().await.unwrap_or(false) {
		crate::log::line("bluetooth already connected");
		return Ok(());
	}
	let mut last = "connect failed".to_string();
	for attempt in 1..=5 {
		match peripheral.connect().await {
			Ok(()) => {
				crate::log::line(&format!("bluetooth connected attempt={attempt}"));
				return Ok(());
			}
			Err(err) => {
				last = err.to_string();
				crate::log::line(&format!("bluetooth connect attempt={attempt}: {last}"));
				let _ = peripheral.disconnect().await;
				sleep(Duration::from_millis(250 * attempt as u64)).await;
			}
		}
	}
	Err(format!("bluetooth connect: {last}"))
}

pub async fn read_info(peripheral: &Peripheral) -> Result<BleInfo, String> {
	ensure_connected(peripheral).await?;
	peripheral.discover_services().await.map_err(|err| {
		let message = format!("bluetooth discover: {err}");
		crate::log::line(&message);
		message
	})?;
	let info_char = find_char(peripheral, BLE_INFO_UUID)?;
	let data = peripheral.read(&info_char).await.map_err(|err| {
		let message = format!("bluetooth info read: {err}");
		crate::log::line(&message);
		message
	})?;
	serde_json::from_slice(&data).map_err(|err| {
		let message = format!(
			"invalid bluetooth info ({err}); body={}",
			String::from_utf8_lossy(&data)
		);
		crate::log::line(&message);
		message
	})
}

pub async fn send_envelope(peripheral: &Peripheral, envelope: &Value) -> Result<String, String> {
	let status_char = find_char(peripheral, BLE_STATUS_UUID)?;
	peripheral
		.subscribe(&status_char)
		.await
		.map_err(|err| err.to_string())?;
	let mut notifications = peripheral
		.notifications()
		.await
		.map_err(|err| err.to_string())?;
	let cmd_char = find_char(peripheral, BLE_CMD_UUID)?;
	let payload = serde_json::to_string(envelope).map_err(|err| err.to_string())?;
	for frame in frames::split_ble_frames(&payload, BLE_CHUNK_SIZE) {
		peripheral
			.write(&cmd_char, &frame, WriteType::WithoutResponse)
			.await
			.map_err(|err| err.to_string())?;
	}
	let notified = timeout(Duration::from_secs(30), async {
		while let Some(notification) = notifications.next().await {
			if notification.uuid == status_char.uuid {
				return Some(String::from_utf8_lossy(&notification.value).into_owned());
			}
		}
		None
	})
	.await
	.map_err(|_| "bluetooth timed out".to_string())?;
	notified.ok_or_else(|| "bluetooth timed out".to_string())
}

pub async fn disconnect(peripheral: &Peripheral) {
	let _ = peripheral.disconnect().await;
}
