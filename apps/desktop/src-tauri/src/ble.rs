use crate::frames::{
	self, BLE_CHUNK_SIZE, BLE_CMD_UUID, BLE_INFO_UUID, BLE_STATUS_UUID,
};
use btleplug::api::{
	Central, Characteristic, Manager as _, Peripheral as _, ScanFilter, WriteType,
};
use btleplug::platform::{Adapter, Manager, Peripheral};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::{sleep, timeout};
use uuid::Uuid;

static BLE: Mutex<()> = Mutex::const_new(());

#[derive(Debug, Deserialize)]
pub struct BleInfo {
	pub uuid: String,
	pub hardware: Option<String>,
	pub name: Option<String>,
	#[serde(rename = "deviceUrl")]
	pub device_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NearbyBoard {
	pub id: String,
	pub name: String,
	pub rssi: Option<i16>,
	pub matched: bool,
	#[serde(rename = "pairingUuid")]
	pub pairing_uuid: Option<String>,
	pub hardware: Option<String>,
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

async fn start_scan(adapter: &btleplug::platform::Adapter) -> Result<(), String> {
	#[cfg(target_os = "linux")]
	{
		match tokio::task::spawn_blocking(crate::bluez::start_le_discovery).await {
			Ok(Ok(())) => return Ok(()),
			Ok(Err(err)) => crate::log::line(&err),
			Err(err) => crate::log::line(&format!("bluetooth le discovery join: {err}")),
		}
	}
	adapter
		.start_scan(ScanFilter::default())
		.await
		.map_err(|err| {
			let message = format!("bluetooth scan: {err}");
			crate::log::line(&message);
			message
		})
}

async fn stop_scan(adapter: &btleplug::platform::Adapter) {
	#[cfg(target_os = "linux")]
	{
		let _ = tokio::task::spawn_blocking(crate::bluez::stop_le_discovery).await;
	}
	let _ = adapter.stop_scan().await;
}

fn upsert_nearby(map: &mut HashMap<String, NearbyBoard>, board: NearbyBoard) {
	if board.id.is_empty() {
		return;
	}
	let key = board.id.replace(['-', '_'], ":").to_ascii_uppercase();
	match map.get_mut(&key) {
		Some(existing) => {
			if (existing.name.is_empty()
				|| frames::anonymous_ble_name(&existing.name, &existing.id))
				&& !board.name.is_empty()
			{
				existing.name = board.name;
			}
			if existing.rssi.is_none() {
				existing.rssi = board.rssi;
			}
			existing.matched |= board.matched;
			if existing.pairing_uuid.is_none() {
				existing.pairing_uuid = board.pairing_uuid;
			}
			if existing.hardware.is_none() {
				existing.hardware = board.hardware;
			}
		}
		None => {
			map.insert(key, board);
		}
	}
}

fn from_props(
	id: String,
	name: Option<&str>,
	rssi: Option<i16>,
	service_ids: &[&str],
) -> NearbyBoard {
	let raw_name = name.unwrap_or("").trim();
	let matched = frames::matches_board(
		(!raw_name.is_empty()).then_some(raw_name),
		service_ids,
	);
	NearbyBoard {
		name: frames::clean_ble_name(raw_name, &id),
		id,
		rssi,
		matched,
		pairing_uuid: None,
		hardware: None,
	}
}

async fn collect_btleplug(adapter: &Adapter, map: &mut HashMap<String, NearbyBoard>) {
	let Ok(peripherals) = adapter.peripherals().await else {
		return;
	};
	for peripheral in peripherals {
		let id = peripheral.address().to_string();
		if let Ok(Some(props)) = peripheral.properties().await {
			let services: Vec<String> =
				props.services.iter().map(|uuid| uuid.to_string()).collect();
			let refs: Vec<&str> = services.iter().map(String::as_str).collect();
			upsert_nearby(
				map,
				from_props(
					props.address.to_string(),
					props.local_name.as_deref(),
					props.rssi,
					&refs,
				),
			);
		} else {
			upsert_nearby(map, from_props(id, None, None, &[]));
		}
	}
}

#[cfg(target_os = "linux")]
async fn collect_bluez(map: &mut HashMap<String, NearbyBoard>) {
	match tokio::task::spawn_blocking(crate::bluez::list_le_devices).await {
		Ok(Ok(devices)) => {
			for device in devices {
				let refs: Vec<&str> = device.uuids.iter().map(String::as_str).collect();
				upsert_nearby(
					map,
					from_props(
						device.address,
						(!device.name.is_empty()).then_some(device.name.as_str()),
						device.rssi,
						&refs,
					),
				);
			}
		}
		Ok(Err(err)) => crate::log::line(&err),
		Err(err) => crate::log::line(&format!("bluetooth le list join: {err}")),
	}
}

fn sort_boards(mut boards: Vec<NearbyBoard>) -> Vec<NearbyBoard> {
	boards.sort_by(|left, right| {
		right
			.matched
			.cmp(&left.matched)
			.then(right.rssi.unwrap_or(i16::MIN).cmp(&left.rssi.unwrap_or(i16::MIN)))
			.then(left.name.to_ascii_lowercase().cmp(&right.name.to_ascii_lowercase()))
			.then(left.id.cmp(&right.id))
	});
	boards
}

fn sorted_nearby(map: HashMap<String, NearbyBoard>) -> Vec<NearbyBoard> {
	sort_boards(map.into_values().collect())
}

fn for_picker(boards: Vec<NearbyBoard>) -> Vec<NearbyBoard> {
	let matched: Vec<NearbyBoard> = boards
		.iter()
		.filter(|board| board.matched)
		.cloned()
		.collect();
	if !matched.is_empty() {
		return matched;
	}
	boards
		.into_iter()
		.filter(|board| frames::probe_candidate(&board.name, &board.id, false))
		.collect()
}

pub async fn scan_nearby(timeout_ms: u64) -> Result<Vec<NearbyBoard>, String> {
	let _lock = BLE.lock().await;
	let adapter = adapter().await?;
	start_scan(&adapter).await?;
	let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);
	let mut map = HashMap::new();
	loop {
		collect_btleplug(&adapter, &mut map).await;
		#[cfg(target_os = "linux")]
		collect_bluez(&mut map).await;
		if tokio::time::Instant::now() > deadline {
			break;
		}
		sleep(Duration::from_millis(300)).await;
	}
	stop_scan(&adapter).await;
	let boards = sorted_nearby(map);
	crate::log::line(&format!(
		"bluetooth nearby={} matched={}",
		boards.len(),
		boards.iter().filter(|board| board.matched).count()
	));
	for board in &boards {
		crate::log::line(&format!(
			"bluetooth nearby name={} id={} matched={} rssi={:?}",
			if board.name.is_empty() { "-" } else { &board.name },
			board.id,
			board.matched,
			board.rssi
		));
	}
	Ok(boards)
}

async fn peripheral_by_id(adapter: &Adapter, id: &str) -> Result<Option<Peripheral>, String> {
	for peripheral in adapter.peripherals().await.map_err(|err| err.to_string())? {
		if frames::same_ble_id(&peripheral.address().to_string(), id) {
			return Ok(Some(peripheral));
		}
		if let Ok(Some(props)) = peripheral.properties().await {
			if frames::same_ble_id(&props.address.to_string(), id) {
				return Ok(Some(peripheral));
			}
		}
	}
	Ok(None)
}

pub async fn find_board(id: &str) -> Result<Peripheral, String> {
	let adapter = adapter().await?;
	if let Some(peripheral) = peripheral_by_id(&adapter, id).await? {
		return Ok(peripheral);
	}
	start_scan(&adapter).await?;
	let deadline = tokio::time::Instant::now() + Duration::from_millis(8_000);
	loop {
		if let Some(peripheral) = peripheral_by_id(&adapter, id).await? {
			stop_scan(&adapter).await;
			sleep(Duration::from_millis(400)).await;
			return Ok(peripheral);
		}
		if tokio::time::Instant::now() > deadline {
			stop_scan(&adapter).await;
			return Err(format!("bluetooth device not found: {id}"));
		}
		sleep(Duration::from_millis(300)).await;
	}
}

async fn probe_info(peripheral: &Peripheral) -> Option<BleInfo> {
	let result = timeout(Duration::from_secs(10), read_info(peripheral)).await;
	disconnect(peripheral).await;
	match result {
		Ok(Ok(info)) => Some(info),
		Ok(Err(err)) => {
			crate::log::line(&format!("bluetooth probe: {err}"));
			None
		}
		Err(_) => {
			crate::log::line("bluetooth probe timed out");
			None
		}
	}
}

pub async fn identify_boards<F>(
	mut boards: Vec<NearbyBoard>,
	mut on_status: F,
) -> Result<Vec<NearbyBoard>, String>
where
	F: FnMut(&str),
{
	if boards.iter().any(|board| board.matched) {
		on_status("Found gpio-companion");
		return Ok(for_picker(sort_boards(boards)));
	}
	let _lock = BLE.lock().await;
	let adapter = adapter().await?;
	let mut candidates: Vec<NearbyBoard> = boards
		.iter()
		.filter(|board| frames::probe_candidate(&board.name, &board.id, board.matched))
		.cloned()
		.collect();
	candidates.sort_by(|left, right| {
		right
			.rssi
			.unwrap_or(i16::MIN)
			.cmp(&left.rssi.unwrap_or(i16::MIN))
	});
	let mut found = 0;
	for board in candidates.into_iter().take(3) {
		if found >= 1 {
			break;
		}
		on_status(&format!("Checking {}…", board.id));
		crate::log::line(&format!("bluetooth probe {}", board.id));
		let Some(peripheral) = peripheral_by_id(&adapter, &board.id).await? else {
			continue;
		};
		let Some(info) = probe_info(&peripheral).await else {
			#[cfg(target_os = "linux")]
			{
				let addr = board.id.clone();
				let _ = tokio::task::spawn_blocking(move || crate::bluez::disconnect_le(&addr)).await;
			}
			continue;
		};
		found += 1;
		if let Some(target) = boards
			.iter_mut()
			.find(|item| frames::same_ble_id(&item.id, &board.id))
		{
			target.matched = true;
			let info_name = info.name.as_deref().unwrap_or("").trim();
			target.name = if info_name.is_empty() {
				"gpio-companion".to_string()
			} else {
				frames::clean_ble_name(info_name, &target.id)
			};
			if target.name.is_empty() {
				target.name = "gpio-companion".to_string();
			}
			target.pairing_uuid = Some(info.uuid).filter(|value| !value.is_empty());
			target.hardware = info
				.hardware
				.map(|value| value.trim().to_string())
				.filter(|value| !value.is_empty());
		}
	}
	sleep(Duration::from_millis(300)).await;
	Ok(for_picker(sort_boards(boards)))
}

pub async fn scan_board(timeout_ms: u64) -> Result<Peripheral, String> {
	let boards = scan_nearby(timeout_ms).await?;
	let boards = identify_boards(boards, |_| {}).await?;
	let id = boards
		.iter()
		.find(|board| board.matched)
		.map(|board| board.id.as_str())
		.ok_or_else(|| "no gpio-companion board found".to_string())?;
	find_board(id).await
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
	#[cfg(target_os = "linux")]
	{
		if let Ok(Some(props)) = peripheral.properties().await {
			let addr = props.address.to_string();
			match tokio::task::spawn_blocking(move || crate::bluez::connect_le(&addr)).await {
				Ok(Ok(())) => {
					for _ in 0..20 {
						if peripheral.is_connected().await.unwrap_or(false) {
							crate::log::line("bluetooth connected via Connect");
							return Ok(());
						}
						sleep(Duration::from_millis(150)).await;
					}
				}
				Ok(Err(err)) => crate::log::line(&err),
				Err(err) => crate::log::line(&format!("bluetooth le connect join: {err}")),
			}
		}
	}
	let mut last = "connect failed".to_string();
	for attempt in 1..=2 {
		match peripheral.connect().await {
			Ok(()) => {
				crate::log::line(&format!("bluetooth connected attempt={attempt}"));
				return Ok(());
			}
			Err(err) => {
				last = err.to_string();
				crate::log::line(&format!("bluetooth connect attempt={attempt}: {last}"));
				let _ = peripheral.disconnect().await;
				sleep(Duration::from_millis(400 * attempt as u64)).await;
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
