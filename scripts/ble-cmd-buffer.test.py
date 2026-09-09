import json
import struct
import unittest

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def load_take_command():
	path = Path(__file__).with_name("ble-gatt-server.py")
	spec = spec_from_file_location("ble_gatt_server", path)
	assert spec and spec.loader
	mod = module_from_spec(spec)
	spec.loader.exec_module(mod)
	return mod.take_command


class TakeCommandTest(unittest.TestCase):
	def setUp(self):
		self.take = load_take_command()

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


if __name__ == "__main__":
	unittest.main()
