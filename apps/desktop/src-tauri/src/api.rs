use crate::config::DASHBOARD_URL;
use crate::log;
use crate::tokens;
use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, serde::Deserialize)]
struct ActionResult<T> {
	ok: bool,
	data: Option<T>,
	error: Option<String>,
}

pub async fn request<T: DeserializeOwned>(
	method: Method,
	path: &str,
	body: Option<&impl Serialize>,
) -> Result<T, String> {
	let token = tokens::access_token()?;
	request_with_token(token, method, path, body).await
}

pub async fn request_with_token<T: DeserializeOwned>(
	token: String,
	method: Method,
	path: &str,
	body: Option<&impl Serialize>,
) -> Result<T, String> {
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
		message
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
		message
	})?;
	log::line(&format!(
		"http {method} {path} -> {status} ct={content_type} bytes={}",
		text.len()
	));
	match serde_json::from_str::<ActionResult<T>>(&text) {
		Ok(payload) if payload.ok => payload.data.ok_or_else(|| {
			let message = format!("http {method} {path} {status}: empty data");
			log::line(&message);
			message
		}),
		Ok(payload) => {
			let error = payload
				.error
				.unwrap_or_else(|| "request failed".to_string());
			let message = format!("http {method} {path} {status}: {error}");
			log::line(&message);
			Err(message)
		}
		Err(err) => {
			let message = format!(
				"http {method} {path} {status}: not json ({err}); body={}",
				log::truncate(&text, 500)
			);
			log::line(&message);
			Err(message)
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
