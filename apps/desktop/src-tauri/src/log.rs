use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX: usize = 200;

static LOGS: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());

pub fn line(message: &str) {
	let ts = SystemTime::now()
		.duration_since(UNIX_EPOCH)
		.map(|d| d.as_secs())
		.unwrap_or(0);
	eprintln!("gpio-companion-desktop: {message}");
	if let Ok(mut logs) = LOGS.lock() {
		if logs.len() >= MAX {
			logs.pop_front();
		}
		logs.push_back(format!("{ts} {message}"));
	}
}

pub fn snapshot() -> Vec<String> {
	LOGS.lock()
		.map(|logs| logs.iter().cloned().collect())
		.unwrap_or_default()
}

pub fn truncate(value: &str, max: usize) -> String {
	if value.chars().count() <= max {
		return value.to_string();
	}
	format!("{}…", value.chars().take(max).collect::<String>())
}
