import json
import struct
import unittest

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def load_gatt():
	path = Path(__file__).with_name("ble-gatt-server.py")
	spec = spec_from_file_location("ble_gatt_server", path)
	assert spec and spec.loader
	mod = module_from_spec(spec)
	spec.loader.exec_module(mod)
	return mod


class TakeCommandTest(unittest.TestCase):
	def setUp(self):
		self.mod = load_gatt()
		self.take = self.mod.take_command

	def test_json_object(self):
		buf = bytearray(b'{"a":1}')
		self.assertEqual(self.take(buf), '{"a":1}')
		self.assertEqual(buf, bytearray())

	def test_length_prefix(self):
		body = b'{"method":"GET"}'
		buf = bytearray(struct.pack(">I", len(body)) + body)
		self.assertEqual(self.take(buf), body.decode())
		self.assertEqual(buf, bytearray())

	def test_incomplete_json_waits(self):
		buf = bytearray(b'{"a":')
		self.assertIsNone(self.take(buf))
		self.assertTrue(buf.startswith(b'{"a":'))

	def test_rejects_huge_length(self):
		buf = bytearray(struct.pack(">I", 9_000_000) + b"xx")
		self.assertIsNone(self.take(buf))
		self.assertEqual(buf, bytearray())

	def test_ble_forward_headers_mark_via(self):
		headers = self.mod.ble_forward_headers({"X-Gpio-Signature": "sig"})
		self.assertEqual(headers["X-Gpio-Via"], "ble")
		self.assertEqual(headers["X-Gpio-Signature"], "sig")

	def test_ble_debug_payload(self):
		payload = json.loads(
			self.mod.ble_debug_payload("GET", "/v1/info", 401, "missing device signature")
		)
		self.assertEqual(
			payload,
			{
				"method": "GET",
				"path": "/v1/info",
				"status": 401,
				"message": "missing device signature",
				"via": "ble",
			},
		)


if __name__ == "__main__":
	unittest.main()
