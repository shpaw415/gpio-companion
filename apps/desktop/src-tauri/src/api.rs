use crate::config::DASHBOARD_URL;
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
	let mut builder = client
		.request(method, url)
		.header("accept", "application/json")
		.header("authorization", format!("Bearer {token}"));
	if let Some(body) = body {
		builder = builder
			.header("content-type", "application/json")
			.json(body);
	}
	let response = builder.send().await.map_err(|err| err.to_string())?;
	let payload = response
		.json::<ActionResult<T>>()
		.await
		.map_err(|err| err.to_string())?;
	if !payload.ok {
		return Err(payload
			.error
			.unwrap_or_else(|| "request failed".to_string()));
	}
	payload
		.data
		.ok_or_else(|| "request failed".to_string())
}

pub async fn request_value(
	method: Method,
	path: &str,
	body: Option<&Value>,
) -> Result<Value, String> {
	request(method, path, body).await
}
