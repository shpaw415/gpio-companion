mod api;
mod auth;
mod ble;
#[cfg(target_os = "linux")]
mod bluez;
mod config;
mod frames;
mod log;
mod tokens;

use api::request_value;
use auth::AuthFlow;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Serialize, Deserialize)]
struct DeviceList {
	paired: bool,
	devices: Vec<Device>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Device {
	uuid: String,
	#[serde(rename = "deviceUrl")]
	device_url: String,
	login: String,
	label: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Session {
	id: Option<String>,
	email: Option<String>,
	name: Option<String>,
	role: Option<String>,
}

fn emit_status(app: &AppHandle, message: &str) {
	let _ = app.emit("ble-status", message);
}

#[tauri::command]
async fn auth_token() -> Option<String> {
	if tokens::load().is_none() {
		return None;
	}
	if let Err(err) = auth::refresh_access().await {
		log::line(&format!("auth refresh: {err}"));
		tokens::clear();
		return None;
	}
	tokens::load()
		.map(|tokens| tokens.access)
		.filter(|token| !token.is_empty())
}

#[tauri::command]
fn debug_logs() -> Vec<String> {
	log::snapshot()
}

#[tauri::command]
async fn auth_session() -> Result<Session, String> {
	log::line("auth session");
	api::request(Method::GET, "/api/mobile/session", None::<&Value>).await
}

#[tauri::command]
async fn auth_login(app: AppHandle, flow: State<'_, AuthFlow>) -> Result<(), String> {
	log::line("auth login start");
	let (verifier, state) = auth::new_pkce();
	let url = auth::authorize_url(&verifier, &state);
	let rx = flow.wait();
	app.opener()
		.open_url(&url, None::<&str>)
		.map_err(|err| err.to_string())?;
	let callback = tokio::time::timeout(Duration::from_secs(180), rx)
		.await
		.map_err(|_| {
			log::line("login timed out");
			"login timed out".to_string()
		})?
		.map_err(|_| {
			log::line("login cancelled");
			"login cancelled".to_string()
		})?;
	auth::exchange_code(&callback, &verifier, &state).await?;
	log::line("auth login ok");
	Ok(())
}

#[tauri::command]
fn auth_logout() {
	tokens::clear();
}

#[tauri::command]
async fn devices_list() -> Result<DeviceList, String> {
	log::line("devices list");
	api::request(Method::GET, "/api/mobile/devices", None::<&Value>).await
}

#[tauri::command]
async fn devices_unpair(uuid: String) -> Result<Value, String> {
	let path = format!(
		"/api/mobile/devices?uuid={}",
		url::form_urlencoded::byte_serialize(uuid.as_bytes()).collect::<String>()
	);
	api::request(Method::DELETE, &path, None::<&Value>).await
}

#[tauri::command]
async fn ble_scan(app: AppHandle) -> Result<Vec<ble::NearbyBoard>, String> {
	emit_status(&app, "Scanning…");
	let boards = ble::scan_nearby(8_000).await?;
	emit_status(&app, "Identifying gpio-companion…");
	let status_app = app.clone();
	let boards = ble::identify_boards(boards, move |message| {
		emit_status(&status_app, message)
	})
	.await?;
	let matched = boards.iter().filter(|board| board.matched).count();
	emit_status(
		&app,
		&if boards.is_empty() {
			"No nearby Bluetooth devices".to_string()
		} else if matched == 0 {
			"No gpio-companion identified. Hold the Pi close and scan again, or pick the strongest nearby signal.".to_string()
		} else {
			format!("Found {matched} gpio-companion board(s). Select a device.")
		},
	);
	Ok(boards)
}

#[tauri::command]
async fn ble_pair(app: AppHandle, id: String) -> Result<Value, String> {
	emit_status(&app, "Connecting…");
	let (peripheral, info) = ble::connected_board_info(&id).await?;
	emit_status(&app, "Reading board…");
	let envelope = request_value(Method::PUT, "/api/mobile/pair", None).await?;
	emit_status(&app, "Asking board for pairing key…");
	let raw = ble::send_envelope(&peripheral, &envelope).await;
	ble::disconnect(&peripheral).await;
	let raw = raw?;
	let creds: Value =
		serde_json::from_str(&raw).map_err(|_| "device did not return pairing credentials".to_string())?;
	let uuid = creds
		.get("uuid")
		.and_then(Value::as_str)
		.ok_or_else(|| "device did not return pairing credentials".to_string())?;
	let key = creds
		.get("key")
		.and_then(Value::as_str)
		.ok_or_else(|| "device did not return pairing credentials".to_string())?;
	let device_url = creds
		.get("deviceUrl")
		.and_then(Value::as_str)
		.map(str::to_string)
		.filter(|value| !value.is_empty())
		.or(info.device_url);
	emit_status(&app, "Claiming…");
	let claimed = request_value(
		Method::POST,
		"/api/mobile/pair",
		Some(&json!({
			"uuid": uuid,
			"key": key,
			"deviceUrl": device_url,
		})),
	)
	.await?;
	emit_status(&app, "Paired");
	Ok(claimed)
}

#[tauri::command]
async fn ble_wifi(
	app: AppHandle,
	uuid: String,
	ssid: String,
	psk: String,
	id: String,
) -> Result<String, String> {
	emit_status(&app, "Signing WiFi…");
	let envelope = request_value(
		Method::POST,
		"/api/mobile/wifi",
		Some(&json!({ "uuid": uuid, "ssid": ssid, "psk": psk })),
	)
	.await?;
	emit_status(&app, "Connecting…");
	let (peripheral, _info) = ble::connected_board_info(&id).await?;
	emit_status(&app, "Writing…");
	let raw = ble::send_envelope(&peripheral, &envelope).await;
	ble::disconnect(&peripheral).await;
	raw
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	let mut builder = tauri::Builder::default();

	#[cfg(desktop)]
	{
		builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
	}

	builder
		.plugin(tauri_plugin_opener::init())
		.plugin(tauri_plugin_deep_link::init())
		.manage(AuthFlow::default())
		.setup(|app| {
			#[cfg(any(windows, target_os = "linux"))]
			{
				app.deep_link().register_all()?;
			}
			let handle = app.handle().clone();
			app.deep_link().on_open_url(move |event| {
				for url in event.urls() {
					handle.state::<AuthFlow>().complete(url.as_str());
				}
			});
			if let Ok(Some(urls)) = app.deep_link().get_current() {
				for url in urls {
					app.state::<AuthFlow>().complete(url.as_str());
				}
			}
			Ok(())
		})
		.invoke_handler(tauri::generate_handler![
			auth_token,
			auth_login,
			auth_logout,
			auth_session,
			debug_logs,
			devices_list,
			devices_unpair,
			ble_scan,
			ble_pair,
			ble_wifi
		])
		.run(tauri::generate_context!())
		.expect("error while running gpio-companion desktop");
}
