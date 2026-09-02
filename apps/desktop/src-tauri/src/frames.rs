pub const BLE_SERVICE_UUID: &str = "a1c15e00-6f10-4c9a-9c31-47b0c15e0001";
pub const BLE_INFO_UUID: &str = "a1c15e00-6f10-4c9a-9c31-47b0c15e0002";
pub const BLE_CMD_UUID: &str = "a1c15e00-6f10-4c9a-9c31-47b0c15e0003";
pub const BLE_STATUS_UUID: &str = "a1c15e00-6f10-4c9a-9c31-47b0c15e0004";
pub const BLE_DEVICE_NAME: &str = "gpio-companion";
pub const BLE_CHUNK_SIZE: usize = 160;

pub fn split_ble_frames(payload: &str, mtu: usize) -> Vec<Vec<u8>> {
	let mtu = mtu.max(1);
	let body = payload.as_bytes();
	let mut all = Vec::with_capacity(4 + body.len());
	all.extend_from_slice(&(body.len() as u32).to_be_bytes());
	all.extend_from_slice(body);
	all.chunks(mtu).map(|chunk| chunk.to_vec()).collect()
}

pub fn matches_board(name: Option<&str>, service_ids: &[&str]) -> bool {
	if service_ids
		.iter()
		.any(|id| id.eq_ignore_ascii_case(BLE_SERVICE_UUID))
	{
		return true;
	}
	name.is_some_and(|value| {
		let lower = value.to_ascii_lowercase();
		lower.starts_with(BLE_DEVICE_NAME) || lower == "gpio"
	})
}

pub fn same_ble_id(left: &str, right: &str) -> bool {
	fn norm(value: &str) -> String {
		value.replace(['-', '_'], ":").to_ascii_uppercase()
	}
	left == right || norm(left) == norm(right)
}

pub fn looks_like_mac(value: &str) -> bool {
	let hex: String = value
		.chars()
		.filter(|ch| ch.is_ascii_hexdigit())
		.collect();
	if hex.len() != 12 {
		return false;
	}
	value
		.chars()
		.filter(|ch| !ch.is_ascii_hexdigit())
		.all(|ch| matches!(ch, ':' | '-' | '_'))
}

pub fn anonymous_ble_name(name: &str, id: &str) -> bool {
	let name = name.trim();
	name.is_empty() || same_ble_id(name, id) || looks_like_mac(name)
}

pub fn clean_ble_name(name: &str, id: &str) -> String {
	if anonymous_ble_name(name, id) {
		String::new()
	} else {
		name.trim().to_string()
	}
}

pub fn probe_candidate(name: &str, id: &str, matched: bool) -> bool {
	if matched {
		return false;
	}
	if anonymous_ble_name(name, id) {
		return true;
	}
	let lower = name.to_ascii_lowercase();
	lower.contains("gpio") || lower.contains("orangepi") || lower.contains("raspberry")
}

/// True when a connect error means BlueZ lost the device object (stale cache /
/// `org.freedesktop.DBus.Error.UnknownObject`) and a fresh scan can clear it.
pub fn is_retryable_connect_error(message: &str) -> bool {
	let lower = message.to_ascii_lowercase();
	lower.contains("disappeared")
		|| lower.contains("doesn't exist")
		|| lower.contains("does not exist")
		|| lower.contains("unknownobject")
		|| lower.contains("unknown object")
		|| lower.contains("not in bluez cache")
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn splits_length_prefixed_json() {
		let frames = split_ble_frames("{}", 160);
		assert_eq!(frames.len(), 1);
		assert_eq!(&frames[0][0..4], &[0, 0, 0, 2]);
		assert_eq!(&frames[0][4..], b"{}");
	}

	#[test]
	fn chunks_large_payload() {
		let payload = "a".repeat(200);
		let frames = split_ble_frames(&payload, 160);
		assert_eq!(frames.len(), 2);
		assert_eq!(frames[0].len(), 160);
		assert_eq!(frames[1].len(), 44);
		let mut joined = frames[0].clone();
		joined.extend_from_slice(&frames[1]);
		let mut len = [0u8; 4];
		len.copy_from_slice(&joined[0..4]);
		assert_eq!(u32::from_be_bytes(len), 200);
	}

	#[test]
	fn matches_name_prefix_or_service() {
		assert!(matches_board(Some("gpio-companion"), &[]));
		assert!(matches_board(
			Some("orangepi3-lts"),
			&[BLE_SERVICE_UUID]
		));
		assert!(matches_board(
			None,
			&["A1C15E00-6F10-4C9A-9C31-47B0C15E0001"]
		));
		assert!(matches_board(Some("gpio"), &[]));
		assert!(!matches_board(Some("other"), &[]));
	}

	#[test]
	fn compares_ble_ids_ignoring_separators() {
		assert!(same_ble_id("AA:BB:CC:DD:EE:FF", "aa-bb-cc-dd-ee-ff"));
		assert!(same_ble_id(
			"AA:BB:CC:DD:EE:FF",
			"AA_BB_CC_DD_EE_FF"
		));
		assert!(!same_ble_id("AA:BB:CC:DD:EE:FF", "00:11:22:33:44:55"));
	}

	#[test]
	fn treats_mac_aliases_as_anonymous() {
		assert!(looks_like_mac("1E-52-1E-18-26-4B"));
		assert!(looks_like_mac("1E:52:1E:18:26:4B"));
		assert!(!looks_like_mac("gpio-companion"));
		assert!(anonymous_ble_name("1E-52-1E-18-26-4B", "1E:52:1E:18:26:4B"));
		assert_eq!(
			clean_ble_name("1E-52-1E-18-26-4B", "1E:52:1E:18:26:4B"),
			""
		);
		assert!(probe_candidate("", "AA:BB:CC:DD:EE:FF", false));
		assert!(probe_candidate("orangepi3-lts", "AA:BB:CC:DD:EE:FF", false));
		assert!(!probe_candidate("WH-1000XM5", "80:99:E7:50:D5:75", false));
	}

	#[test]
	fn flags_vanished_device_connect_errors() {
		assert!(is_retryable_connect_error(
			"bluetooth device disappeared: move closer or re-scan and connect again"
		));
		assert!(is_retryable_connect_error(
			"bluetooth Connect: Method \"Connect\" with signature \"\" on interface \"org.bluez.Device1\" doesn't exist"
		));
		assert!(is_retryable_connect_error("bluetooth device 42:B3:EF:4C:5B:CD not in BlueZ cache"));
		assert!(!is_retryable_connect_error("bluetooth Connect: Did not receive a reply"));
		assert!(!is_retryable_connect_error("bluetooth connect: wrong PIN"));
	}
}
