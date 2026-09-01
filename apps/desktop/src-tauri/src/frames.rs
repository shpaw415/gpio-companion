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
		value
			.to_ascii_lowercase()
			.starts_with(BLE_DEVICE_NAME)
	})
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
		assert!(!matches_board(Some("other"), &[]));
	}
}
