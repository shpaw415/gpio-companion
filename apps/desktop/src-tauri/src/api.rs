use crate::auth;
use crate::config::DASHBOARD_URL;
use crate::log;
use crate::tokens;
use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;

/// Refresh this many seconds before the access token expires (mobile parity).
const REFRESH_WINDOW_SECS: i64 = 30;

/// Shared client so every request does not pay for a fresh connection pool,
/// and no request can hang forever on a stalled dashboard.
pub fn http_client() -> &'static reqwest::Client {
	static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
	CLIENT.get_or_init(|| {
		reqwest::Client::builder()
			.connect_timeout(Duration::from_secs(10))
			.timeout(Duration::from_secs(15))
			.build()
			.expect("http client")
	})
}

fn unix_now() -> i64 {
	SystemTime::now()
		.duration_since(UNIX_EPOCH)
		.map(|d| d.as_secs() as i64)
		.unwrap_or(0)
}

/// True when the access token is expired or expires within the refresh
/// window, so the next request should refresh proactively instead of eating
/// a 401.
fn should_refresh(expires_at: Option<i64>, now: i64) -> bool {
	match expires_at {
		Some(expiry) => now + REFRESH_WINDOW_SECS >= expiry,
		None => false,
	}
}

#[derive(Debug, serde::Deserialize)]
struct ActionResult<T> {
	ok: bool,
	data: Option<T>,
	error: Option<String>,
}

struct RequestFailure {
	status: u16,
	message: String,
}

fn refresh_lock() -> &'static Mutex<()> {
	static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
	LOCK.get_or_init(|| Mutex::new(()))
}

fn has_refresh_token() -> bool {
	tokens::load()
		.and_then(|tokens| tokens.refresh)
		.filter(|value| !value.is_empty())
		.is_some()
}

async fn try_refresh_for_retry() -> Result<bool, String> {
	let before = tokens::access_token().ok();
	if !has_refresh_token() {
		log::line("http 401, refresh skipped (no refresh token)");
		return Ok(false);
	}
	let _guard = refresh_lock().lock().await;
	let after = tokens::access_token().ok();
	if before.is_some() && after != before {
		log::line("http 401, refresh already completed");
		return Ok(true);
	}
	if !has_refresh_token() {
		log::line("http 401, refresh skipped (no refresh token)");
		return Ok(false);
	}
	log::line("http 401, refreshing");
	auth::refresh_access()
		.await
		.map_err(|err| err.to_string())?;
	Ok(true)
}

/// Best-effort proactive refresh: single-flight, and failures are logged and
/// ignored — the stale token still goes out and the 401 retry self-heals.
async fn refresh_if_expiring() {
	let Some(current) = tokens::load() else {
		return;
	};
	if !should_refresh(current.expires_at, unix_now()) {
		return;
	}
	if current.refresh.as_deref().unwrap_or("").is_empty() {
		return;
	}
	let _guard = refresh_lock().lock().await;
	if let Some(current) = tokens::load() {
		if !should_refresh(current.expires_at, unix_now()) {
			return;
		}
	}
	log::line("auth refresh (token expiring)");
	if let Err(err) = auth::refresh_access().await {
		log::line(&format!("auth refresh (token expiring): {err}"));
	}
}

pub async fn request<T: DeserializeOwned>(
	method: Method,
	path: &str,
	body: Option<&impl Serialize>,
) -> Result<T, String> {
	refresh_if_expiring().await;
	let token = tokens::access_token()?;
	match request_with_token(token, method.clone(), path, body).await {
		Ok(data) => Ok(data),
		Err(fail) if fail.status == 401 => match try_refresh_for_retry().await {
			Ok(true) => {
				let token = tokens::access_token()?;
				log::line(&format!("http {method} {path} retry after refresh"));
				request_with_token(token, method, path, body)
					.await
					.map_err(|retry| retry.message)
			}
			Ok(false) => Err(fail.message),
			Err(refresh_err) => {
				let message = format!("{}; refresh: {refresh_err}", fail.message);
				log::line(&message);
				Err(message)
			}
		},
		Err(fail) => Err(fail.message),
	}
}

async fn request_with_token<T: DeserializeOwned>(
	token: String,
	method: Method,
	path: &str,
	body: Option<&impl Serialize>,
) -> Result<T, RequestFailure> {
	let client = http_client();
	let url = format!("{DASHBOARD_URL}{path}");
	log::line(&format!(
		"http {method} {path} tokenBytes={}",
		token.len()
	));
	let mut builder = client
		.request(method.clone(), &url)
		.header("accept", "application/json")
		.header("authorization", format!("Bearer {token}"));
	if let Some(body) = body {
		builder = builder
			.header("content-type", "application/json")
			.json(body);
	}
	let response = builder.send().await.map_err(|err| {
		let message = format!("http {method} {path} network: {err}");
		log::line(&message);
		RequestFailure {
			status: 0,
			message,
		}
	})?;
	let status = response.status();
	let content_type = response
		.headers()
		.get(reqwest::header::CONTENT_TYPE)
		.and_then(|value| value.to_str().ok())
		.unwrap_or("")
		.to_string();
	let text = response.text().await.map_err(|err| {
		let message = format!("http {method} {path} body: {err}");
		log::line(&message);
		RequestFailure {
			status: 0,
			message,
		}
	})?;
	log::line(&format!(
		"http {method} {path} -> {status} ct={content_type} bytes={}",
		text.len()
	));
	let status_code = status.as_u16();
	match serde_json::from_str::<ActionResult<T>>(&text) {
		Ok(payload) if payload.ok => payload.data.ok_or_else(|| {
			let message = format!("http {method} {path} {status}: empty data");
			log::line(&message);
			RequestFailure {
				status: status_code,
				message,
			}
		}),
		Ok(payload) => {
			let error = payload
				.error
				.unwrap_or_else(|| "request failed".to_string());
			let message = format!("http {method} {path} {status}: {error}");
			log::line(&message);
			Err(RequestFailure {
				status: status_code,
				message,
			})
		}
		Err(err) => {
			let message = format!(
				"http {method} {path} {status}: not json ({err}); body={}",
				log::truncate(&text, 500)
			);
			log::line(&message);
			Err(RequestFailure {
				status: status_code,
				message,
			})
		}
	}
}

pub async fn request_value(
	method: Method,
	path: &str,
	body: Option<&Value>,
) -> Result<Value, String> {
	request(method, path, body).await
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn refreshes_only_inside_the_expiry_window() {
		assert!(!should_refresh(None, 1_000));
		assert!(!should_refresh(Some(2_000), 1_000));
		assert!(!should_refresh(Some(1_031), 1_000));
		assert!(should_refresh(Some(1_030), 1_000));
		assert!(should_refresh(Some(1_029), 1_000));
		assert!(should_refresh(Some(999), 1_000));
	}
}
