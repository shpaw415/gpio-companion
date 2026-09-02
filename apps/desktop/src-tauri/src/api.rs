use crate::auth;
use crate::config::DASHBOARD_URL;
use crate::log;
use crate::tokens;
use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;
use std::sync::OnceLock;
use tokio::sync::Mutex;

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
	auth::refresh_access().await?;
	Ok(true)
}

pub async fn request<T: DeserializeOwned>(
	method: Method,
	path: &str,
	body: Option<&impl Serialize>,
) -> Result<T, String> {
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
	let client = reqwest::Client::new();
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
