use crate::config::{AUTH_CLIENT_ID, AUTH_REDIRECT_URI, ISSUER_URL};
use crate::tokens::{self, Tokens};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::oneshot;
use url::Url;

pub struct AuthFlow {
	pending: Mutex<Option<oneshot::Sender<String>>>,
}

impl Default for AuthFlow {
	fn default() -> Self {
		Self {
			pending: Mutex::new(None),
		}
	}
}

impl AuthFlow {
	pub fn complete(&self, url: &str) {
		if let Ok(mut pending) = self.pending.lock() {
			if let Some(tx) = pending.take() {
				let _ = tx.send(url.to_string());
			}
		}
	}

	pub fn wait(&self) -> oneshot::Receiver<String> {
		let (tx, rx) = oneshot::channel();
		if let Ok(mut pending) = self.pending.lock() {
			*pending = Some(tx);
		}
		rx
	}
}

#[derive(Deserialize)]
struct TokenResponse {
	access_token: String,
	refresh_token: Option<String>,
	expires_in: Option<i64>,
}

fn random_url_safe(n: usize) -> String {
	let mut bytes = vec![0u8; n];
	rand::rng().fill_bytes(&mut bytes);
	URL_SAFE_NO_PAD.encode(bytes)
}

fn sha256_base64url(input: &str) -> String {
	let hash = Sha256::digest(input.as_bytes());
	URL_SAFE_NO_PAD.encode(hash)
}

pub fn authorize_url(verifier: &str, state: &str) -> String {
	let challenge = sha256_base64url(verifier);
	format!(
		"{ISSUER_URL}/authorize?client_id={AUTH_CLIENT_ID}&redirect_uri={}&response_type=code&code_challenge={challenge}&code_challenge_method=S256&state={state}&provider=github",
		urlencoding(AUTH_REDIRECT_URI)
	)
}

fn urlencoding(value: &str) -> String {
	url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

pub async fn exchange_code(callback: &str, verifier: &str, expected_state: &str) -> Result<(), String> {
	let parsed = Url::parse(callback).map_err(|err| err.to_string())?;
	let mut code = None;
	let mut state = None;
	for (key, value) in parsed.query_pairs() {
		match key.as_ref() {
			"code" => code = Some(value.into_owned()),
			"state" => state = Some(value.into_owned()),
			_ => {}
		}
	}
	let code = code.ok_or_else(|| "missing code".to_string())?;
	if state.as_deref() != Some(expected_state) {
		return Err("state mismatch".to_string());
	}
	let body = format!(
		"grant_type=authorization_code&client_id={AUTH_CLIENT_ID}&code={}&redirect_uri={}&code_verifier={}",
		urlencoding(&code),
		urlencoding(AUTH_REDIRECT_URI),
		urlencoding(verifier)
	);
	let client = reqwest::Client::new();
	crate::log::line("auth token exchange");
	let response = client
		.post(format!("{ISSUER_URL}/token"))
		.header("content-type", "application/x-www-form-urlencoded")
		.body(body)
		.send()
		.await
		.map_err(|err| {
			let message = format!("token exchange network: {err}");
			crate::log::line(&message);
			message
		})?;
	let status = response.status();
	let text = response.text().await.map_err(|err| {
		let message = format!("token exchange body: {err}");
		crate::log::line(&message);
		message
	})?;
	if !status.is_success() {
		let message = format!(
			"token exchange failed ({status}); body={}; add redirect {} on OpenAuthster public client {}",
			crate::log::truncate(&text, 400),
			AUTH_REDIRECT_URI,
			AUTH_CLIENT_ID
		);
		crate::log::line(&message);
		return Err(message);
	}
	let payload = serde_json::from_str::<TokenResponse>(&text).map_err(|err| {
		let message = format!(
			"token exchange not json ({err}); body={}",
			crate::log::truncate(&text, 400)
		);
		crate::log::line(&message);
		message
	})?;
	crate::log::line("auth token exchange ok");
	let expires_at = payload.expires_in.map(|seconds| {
		let now = SystemTime::now()
			.duration_since(UNIX_EPOCH)
			.map(|d| d.as_secs() as i64)
			.unwrap_or(0);
		now + seconds
	});
	tokens::save(&Tokens {
		access: payload.access_token,
		refresh: payload.refresh_token,
		expires_at,
	})
}

pub fn new_pkce() -> (String, String) {
	(random_url_safe(32), random_url_safe(16))
}
