use crate::config::{AUTH_CLIENT_ID, ISSUER_URL};
use crate::tokens::{self, Tokens};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use url::Url;

pub struct AuthFlow {
	pending: Mutex<Option<oneshot::Sender<String>>>,
}

/// Why a token refresh failed. Only a [`RefreshError::Rejected`] (the issuer
/// itself said no) may ever sign the user out; a [`RefreshError::Transient`]
/// failure (offline, flaky network, bad proxy response) keeps the stored
/// tokens and self-heals on the next attempt.
#[derive(Debug)]
pub enum RefreshError {
	Rejected(String),
	Transient(String),
}

impl std::fmt::Display for RefreshError {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		match self {
			RefreshError::Rejected(message) | RefreshError::Transient(message) => {
				write!(f, "{message}")
			}
		}
	}
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
		if is_github_app_oauth_callback(url) {
			return;
		}
		if let Ok(mut pending) = self.pending.lock() {
			if let Some(tx) = pending.take() {
				let _ = tx.send(url.to_string());
			}
		}
	}

	/// Register the callback waiter. Fails when a login is already waiting so
	/// a second attempt cannot silently cancel the first flow.
	pub fn wait(&self) -> Result<oneshot::Receiver<String>, String> {
		let (tx, rx) = oneshot::channel();
		if let Ok(mut pending) = self.pending.lock() {
			if pending.is_some() {
				return Err("login already in progress".to_string());
			}
			*pending = Some(tx);
		}
		Ok(rx)
	}

	/// Drop a waiter that will never complete (login timed out) so the next
	/// login is not rejected as a duplicate.
	pub fn cancel(&self) {
		if let Ok(mut pending) = self.pending.lock() {
			*pending = None;
		}
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

pub fn is_github_app_oauth_callback(url: &str) -> bool {
	let Ok(parsed) = Url::parse(url) else {
		return false;
	};
	if parsed.scheme() == "gpio-companion-desktop" {
		return false;
	}
	let iss = parsed.query_pairs().any(|(key, value)| {
		key == "iss" && value.contains("github.com/login/oauth")
	});
	if iss {
		return true;
	}
	let path = parsed.path();
	let github_path = path.ends_with("/profile/github") || path.ends_with("/devices/keys");
	if !github_path {
		return false;
	}
	parsed
		.query_pairs()
		.any(|(key, _)| key == "code" || key == "installation_id")
}

pub fn authorize_url(verifier: &str, state: &str, redirect_uri: &str) -> String {
	let challenge = sha256_base64url(verifier);
	format!(
		"{ISSUER_URL}/authorize?client_id={AUTH_CLIENT_ID}&redirect_uri={}&response_type=code&code_challenge={challenge}&code_challenge_method=S256&state={state}&provider=github",
		urlencoding(redirect_uri)
	)
}

fn urlencoding(value: &str) -> String {
	url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

pub async fn exchange_code(
	callback: &str,
	verifier: &str,
	expected_state: &str,
	redirect_uri: &str,
) -> Result<(), String> {
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
		urlencoding(redirect_uri),
		urlencoding(verifier)
	);
	crate::log::line("auth token exchange");
	let payload = token_request(body).await.map_err(|err| {
		format!(
			"{err}; add redirect {redirect_uri} on OpenAuthster public client {AUTH_CLIENT_ID}"
		)
	})?;
	crate::log::line("auth token exchange ok");
	save_tokens(payload, None)
}

const LOOPBACK_OK: &[u8] = b"HTTP/1.1 200 OK\r\ncontent-type: text/html; charset=utf-8\r\nconnection: close\r\n\r\n<!doctype html><html><body><p>Signed in. You can close this tab and return to gpio-companion.</p></body></html>";
const LOOPBACK_NO_CONTENT: &[u8] = b"HTTP/1.1 204 No Content\r\nconnection: close\r\n\r\n";

pub fn loopback_redirect_uri(port: u16) -> String {
	format!("http://127.0.0.1:{port}/callback")
}

pub fn http_callback_from_request(request: &str, port: u16) -> Option<String> {
	let line = request.lines().next()?.trim();
	let mut parts = line.split_whitespace();
	let method = parts.next()?;
	if !method.eq_ignore_ascii_case("GET") && !method.eq_ignore_ascii_case("HEAD") {
		return None;
	}
	let target = parts.next()?;
	let (path, query) = target.split_once('?').unwrap_or((target, ""));
	if path != "/callback" && path != "/auth/callback" {
		return None;
	}
	if !query
		.split('&')
		.any(|pair| pair.starts_with("code=") && pair.len() > 5)
	{
		return None;
	}
	Some(format!("http://127.0.0.1:{port}{target}"))
}

pub async fn accept_loopback(listener: TcpListener) -> Result<String, String> {
	let port = listener
		.local_addr()
		.map_err(|err| format!("auth loopback addr: {err}"))?
		.port();
	loop {
		let (mut stream, _) = listener
			.accept()
			.await
			.map_err(|err| format!("auth loopback accept: {err}"))?;
		let mut buf = vec![0u8; 8192];
		let n = match stream.read(&mut buf).await {
			Ok(0) => continue,
			Ok(n) => n,
			Err(_) => continue,
		};
		let request = String::from_utf8_lossy(&buf[..n]);
		if let Some(callback) = http_callback_from_request(&request, port) {
			let _ = stream.write_all(LOOPBACK_OK).await;
			return Ok(callback);
		}
		let _ = stream.write_all(LOOPBACK_NO_CONTENT).await;
	}
}

pub async fn refresh_access() -> Result<(), RefreshError> {
	let Some(current) = tokens::load() else {
		return Err(RefreshError::Rejected("sign in first".to_string()));
	};
	let Some(refresh) = current.refresh.filter(|value| !value.is_empty()) else {
		crate::log::line("auth refresh skipped (no refresh token)");
		return Ok(());
	};
	let body = format!(
		"grant_type=refresh_token&client_id={AUTH_CLIENT_ID}&refresh_token={}",
		urlencoding(&refresh)
	);
	crate::log::line("auth refresh");
	let payload = token_request(body).await?;
	crate::log::line("auth refresh ok");
	save_tokens(payload, Some(refresh)).map_err(RefreshError::Transient)
}

async fn token_request(body: String) -> Result<TokenResponse, RefreshError> {
	let client = crate::api::http_client();
	let response = client
		.post(format!("{ISSUER_URL}/token"))
		.header("content-type", "application/x-www-form-urlencoded")
		.body(body)
		.send()
		.await
		.map_err(|err| {
			let message = format!("token request network: {err}");
			crate::log::line(&message);
			RefreshError::Transient(message)
		})?;
	let status = response.status();
	let text = response.text().await.map_err(|err| {
		let message = format!("token request body: {err}");
		crate::log::line(&message);
		RefreshError::Transient(message)
	})?;
	if !status.is_success() {
		let message = format!(
			"token request failed ({status}); body={}",
			crate::log::truncate(&text, 400)
		);
		crate::log::line(&message);
		return Err(classify_token_failure(status.as_u16(), message));
	}
	serde_json::from_str::<TokenResponse>(&text).map_err(|err| {
		let message = format!(
			"token request not json ({err}); body={}",
			crate::log::truncate(&text, 400)
		);
		crate::log::line(&message);
		RefreshError::Transient(message)
	})
}

/// A 5xx means the issuer is unhealthy, not that the grant is bad — keep the
/// stored tokens and let the 401 path self-heal later.
fn classify_token_failure(status: u16, message: String) -> RefreshError {
	if (500..600).contains(&status) {
		RefreshError::Transient(message)
	} else {
		RefreshError::Rejected(message)
	}
}

fn save_tokens(payload: TokenResponse, previous_refresh: Option<String>) -> Result<(), String> {
	let expires_at = payload.expires_in.map(|seconds| {
		let now = SystemTime::now()
			.duration_since(UNIX_EPOCH)
			.map(|d| d.as_secs() as i64)
			.unwrap_or(0);
		now + seconds
	});
	tokens::save(&Tokens {
		access: payload.access_token,
		refresh: payload.refresh_token.filter(|value| !value.is_empty()).or(previous_refresh),
		expires_at,
	})
}

pub fn new_pkce() -> (String, String) {
	(random_url_safe(32), random_url_safe(16))
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn classifies_token_failures_by_status() {
		assert!(matches!(
			classify_token_failure(400, "invalid_grant".to_string()),
			RefreshError::Rejected(_)
		));
		assert!(matches!(
			classify_token_failure(401, "unauthorized".to_string()),
			RefreshError::Rejected(_)
		));
		assert!(matches!(
			classify_token_failure(500, "boom".to_string()),
			RefreshError::Transient(_)
		));
		assert!(matches!(
			classify_token_failure(503, "unavailable".to_string()),
			RefreshError::Transient(_)
		));
	}

	#[test]
	fn refresh_errors_display_the_message() {
		assert_eq!(
			RefreshError::Rejected("no".to_string()).to_string(),
			"no"
		);
		assert_eq!(
			RefreshError::Transient("offline".to_string()).to_string(),
			"offline"
		);
	}

	#[test]
	fn github_app_oauth_iss_is_not_a_login_callback() {
		assert!(is_github_app_oauth_callback(
			"https://gpio-companion.com/profile/github?code=abc&iss=https%3A%2F%2Fgithub.com%2Flogin%2Foauth&state=st"
		));
		assert!(!is_github_app_oauth_callback(
			"gpio-companion-desktop://auth/callback?code=x&state=st"
		));
		assert!(!is_github_app_oauth_callback(
			"gpio-companion-desktop://auth/callback?code=x&iss=https%3A%2F%2Fgithub.com%2Flogin%2Foauth&state=st"
		));
	}

	#[test]
	fn loopback_http_callback_extracts_code() {
		assert_eq!(
			http_callback_from_request(
				"GET /callback?code=abc&state=st HTTP/1.1\r\nHost: 127.0.0.1:4242\r\n\r\n",
				4242
			)
			.as_deref(),
			Some("http://127.0.0.1:4242/callback?code=abc&state=st")
		);
		assert_eq!(
			http_callback_from_request("GET /favicon.ico HTTP/1.1\r\n\r\n", 4242),
			None
		);
		assert_eq!(
			http_callback_from_request("GET /callback HTTP/1.1\r\n\r\n", 4242),
			None
		);
	}

	#[test]
	fn authorize_url_uses_loopback_redirect() {
		let url = authorize_url("verifier", "state", "http://127.0.0.1:4242/callback");
		assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A4242%2Fcallback"));
		assert!(url.contains("provider=github"));
	}

	#[test]
	fn second_login_wait_is_rejected() {
		let flow = AuthFlow::default();
		assert!(flow.wait().is_ok());
		assert!(flow.wait().is_err());
		flow.cancel();
		assert!(flow.wait().is_ok());
	}

	#[test]
	fn cancel_then_complete_does_not_revive_the_first_waiter() {
		let flow = AuthFlow::default();
		let mut rx = flow.wait().expect("first wait");
		flow.cancel();
		flow.complete("gpio-companion-desktop://auth/callback?code=x");
		assert!(rx.try_recv().is_err());
	}
}
