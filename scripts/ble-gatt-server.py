#!/usr/bin/env python3
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request

try:
	from gi.repository import GLib
	import dbus
	import dbus.exceptions
	import dbus.mainloop.glib
	import dbus.service
except ImportError:
	sys.stderr.write("gpio-companion ble: python dbus/gi missing\n")
	sys.exit(0)

BLUEZ = "org.bluez"
GATT_MANAGER = "org.bluez.GattManager1"
LE_AD_MANAGER = "org.bluez.LEAdvertisingManager1"
GATT_SERVICE = "org.bluez.GattService1"
GATT_CHRC = "org.bluez.GattCharacteristic1"
LE_AD = "org.bluez.LEAdvertisement1"
OM_IFACE = "org.freedesktop.DBus.ObjectManager"
PROP_IFACE = "org.freedesktop.DBus.Properties"

GATT_NOTIFY_MAX = 512

SERVICE_UUID = os.environ.get(
	"GPIO_BLE_SERVICE", "a1c15e00-6f10-4c9a-9c31-47b0c15e0001"
)
INFO_UUID = os.environ.get("GPIO_BLE_INFO", "a1c15e00-6f10-4c9a-9c31-47b0c15e0002")
CMD_UUID = os.environ.get("GPIO_BLE_CMD", "a1c15e00-6f10-4c9a-9c31-47b0c15e0003")
STATUS_UUID = os.environ.get(
	"GPIO_BLE_STATUS", "a1c15e00-6f10-4c9a-9c31-47b0c15e0004"
)
API = os.environ.get("GPIO_COMPANION_BLE_API", "http://127.0.0.1:4150")
PAIR_UUID = os.environ.get("GPIO_COMPANION_PAIRING_UUID", "")
HARDWARE = os.environ.get("GPIO_COMPANION_HARDWARE", "raspberrypi")
LOCAL_NAME = os.environ.get("GPIO_BLE_NAME", "gpio-companion")
DEVICE_URL = os.environ.get("GPIO_COMPANION_DEVICE_URL", "")


class Application(dbus.service.Object):
	def __init__(self, bus):
		self.path = "/org/gpio/ble"
		self.services = []
		dbus.service.Object.__init__(self, bus, self.path)

	def get_path(self):
		return dbus.ObjectPath(self.path)

	def add_service(self, service):
		self.services.append(service)

	@dbus.service.method(OM_IFACE, out_signature="a{oa{sa{sv}}}")
	def GetManagedObjects(self):
		response = {}
		for service in self.services:
			response[service.get_path()] = service.get_properties()
			for chrc in service.characteristics:
				response[chrc.get_path()] = chrc.get_properties()
		return response


class Service(dbus.service.Object):
	def __init__(self, bus, index, uuid):
		self.path = f"/org/gpio/ble/service{index}"
		self.uuid = uuid
		self.characteristics = []
		dbus.service.Object.__init__(self, bus, self.path)

	def get_properties(self):
		return {
			GATT_SERVICE: {
				"UUID": self.uuid,
				"Primary": True,
				"Characteristics": dbus.Array(
					[c.get_path() for c in self.characteristics], signature="o"
				),
			}
		}

	def get_path(self):
		return dbus.ObjectPath(self.path)

	def add_characteristic(self, chrc):
		self.characteristics.append(chrc)

	@dbus.service.method(PROP_IFACE, in_signature="s", out_signature="a{sv}")
	def GetAll(self, interface):
		return self.get_properties()[GATT_SERVICE]

	@dbus.service.method(PROP_IFACE, in_signature="ss", out_signature="v")
	def Get(self, interface, prop):
		return self.get_properties()[GATT_SERVICE][prop]


class Characteristic(dbus.service.Object):
	def __init__(self, bus, index, uuid, flags, service):
		self.path = f"{service.path}/char{index}"
		self.uuid = uuid
		self.service = service
		self.flags = flags
		self.value = []
		self.notifying = False
		dbus.service.Object.__init__(self, bus, self.path)

	def get_properties(self):
		return {
			GATT_CHRC: {
				"Service": self.service.get_path(),
				"UUID": self.uuid,
				"Flags": self.flags,
				"Value": dbus.Array(self.value, signature="y"),
			}
		}

	def get_path(self):
		return dbus.ObjectPath(self.path)

	def set_value(self, data):
		self.value = list(data)
		if self.notifying and should_notify_value(self.value):
			self.PropertiesChanged(
				GATT_CHRC, {"Value": dbus.Array(self.value, signature="y")}, []
			)

	@dbus.service.method(PROP_IFACE, in_signature="s", out_signature="a{sv}")
	def GetAll(self, interface):
		return self.get_properties()[GATT_CHRC]

	@dbus.service.method(PROP_IFACE, in_signature="ss", out_signature="v")
	def Get(self, interface, prop):
		return self.get_properties()[GATT_CHRC][prop]

	@dbus.service.method(GATT_CHRC, in_signature="a{sv}", out_signature="ay")
	def ReadValue(self, options):
		return dbus.Array(characteristic_read(self.value, options), signature="y")

	@dbus.service.method(GATT_CHRC, in_signature="aya{sv}")
	def WriteValue(self, value, options):
		self.value = list(value)

	@dbus.service.method(GATT_CHRC)
	def StartNotify(self):
		self.notifying = True
		if should_notify_value(self.value):
			self.PropertiesChanged(
				GATT_CHRC, {"Value": dbus.Array(self.value, signature="y")}, []
			)

	@dbus.service.method(GATT_CHRC)
	def StopNotify(self):
		self.notifying = False

	@dbus.service.signal(PROP_IFACE, signature="sa{sv}as")
	def PropertiesChanged(self, interface, changed, invalidated):
		pass


class CommandCharacteristic(Characteristic):
	def __init__(self, bus, index, uuid, flags, service, on_payload):
		super().__init__(bus, index, uuid, flags, service)
		self.on_payload = on_payload
		self.buf = bytearray()

	@dbus.service.method(GATT_CHRC, in_signature="aya{sv}")
	def WriteValue(self, value, options):
		self.buf.extend(bytes(value))
		if len(self.buf) > 256 * 1024:
			self.buf = bytearray()
			report_debug("WRITE", "/ble/cmd", 400, "ble command overflow")
			return
		payload = take_command(self.buf)
		if payload is not None:
			self.on_payload(payload)


def characteristic_read(value, options=None):
	offset = 0
	if options:
		raw = options.get("offset", 0)
		try:
			offset = int(raw)
		except (TypeError, ValueError):
			offset = 0
	if offset < 0:
		offset = 0
	data = bytes(value)
	if offset >= len(data):
		return b""
	return data[offset:]


def should_notify_value(value):
	return 0 < len(value) <= GATT_NOTIFY_MAX


def take_command(buf):
	if not buf:
		return None
	if buf[0] == 0x7B:
		try:
			payload = buf.decode("utf-8").strip()
			json.loads(payload)
			buf.clear()
			return payload
		except (UnicodeDecodeError, json.JSONDecodeError):
			return None
	if len(buf) < 4:
		return None
	length = struct.unpack(">I", buf[:4])[0]
	if length > 256 * 1024:
		buf.clear()
		report_debug("WRITE", "/ble/cmd", 400, "ble command overflow")
		return None
	if len(buf) < 4 + length:
		return None
	payload = bytes(buf[4 : 4 + length]).decode("utf-8")
	del buf[: 4 + length]
	return payload


def advertisement_payloads():
	uuid = dbus.Array([SERVICE_UUID], signature="s")
	cores = (
		{"Type": "peripheral", "ServiceUUIDs": uuid, "LocalName": LOCAL_NAME},
		{"Type": "peripheral", "ServiceUUIDs": uuid, "LocalName": "gpio"},
		{"Type": "peripheral", "ServiceUUIDs": uuid},
		{"Type": "peripheral", "LocalName": LOCAL_NAME},
	)
	fast = {
		"MinInterval": dbus.UInt32(20),
		"MaxInterval": dbus.UInt32(100),
		"TxPower": dbus.Int16(4),
	}
	return tuple({**fast, **core} for core in cores) + cores


class Advertisement(dbus.service.Object):
	def __init__(self, bus):
		self.path = "/org/gpio/ble/advertisement0"
		self.payload = advertisement_payloads()[0]
		dbus.service.Object.__init__(self, bus, self.path)

	def get_path(self):
		return dbus.ObjectPath(self.path)

	def set_payload(self, payload):
		self.payload = payload

	def get_properties(self):
		return {LE_AD: self.payload}

	@dbus.service.method(PROP_IFACE, in_signature="s", out_signature="a{sv}")
	def GetAll(self, interface):
		return self.get_properties()[LE_AD]

	@dbus.service.method(PROP_IFACE, in_signature="ss", out_signature="v")
	def Get(self, interface, prop):
		return self.get_properties()[LE_AD][prop]

	@dbus.service.method(LE_AD)
	def Release(self):
		pass


def power_adapter(bus, path):
	props = dbus.Interface(bus.get_object(BLUEZ, path), PROP_IFACE)
	sets = (
		("Powered", dbus.Boolean(True)),
		("Discoverable", dbus.Boolean(True)),
		("Alias", dbus.String(LOCAL_NAME)),
		("DiscoverableTimeout", dbus.UInt32(0)),
	)
	for key, value in sets:
		try:
			props.Set("org.bluez.Adapter1", key, value)
		except dbus.exceptions.DBusException:
			pass


def find_adapter(bus):
	om = dbus.Interface(bus.get_object(BLUEZ, "/"), OM_IFACE)
	gatt = None
	for path, ifaces in om.GetManagedObjects().items():
		if "org.bluez.Adapter1" in ifaces:
			power_adapter(bus, path)
		if GATT_MANAGER in ifaces and LE_AD_MANAGER in ifaces:
			return path
		if GATT_MANAGER in ifaces:
			gatt = path
	return gatt


def wait_adapter(bus):
	adapter = None
	for _ in range(20):
		adapter = find_adapter(bus)
		if adapter is None:
			time.sleep(0.5)
			continue
		om = dbus.Interface(bus.get_object(BLUEZ, "/"), OM_IFACE)
		ifaces = om.GetManagedObjects().get(adapter, {})
		if LE_AD_MANAGER in ifaces:
			return adapter
		time.sleep(0.5)
	return adapter


def register_gatt(service_manager, ad_manager, app, ad):
	loop = GLib.MainLoop()
	payloads = advertisement_payloads()
	state = {"failed": False, "ad_tries": 0}

	def fail(kind, error):
		state["failed"] = True
		sys.stderr.write(f"gpio-companion ble: {kind}: {error}\n")
		loop.quit()

	def on_ad_ok():
		sys.stdout.write("gpio-companion ble: advertising\n")
		sys.stdout.flush()

	def start_ad():
		index = min(state["ad_tries"], len(payloads) - 1)
		ad.set_payload(payloads[index])
		ad_manager.RegisterAdvertisement(
			ad.get_path(),
			{},
			reply_handler=on_ad_ok,
			error_handler=on_ad_err,
		)
		return False

	def on_ad_err(error):
		state["ad_tries"] += 1
		sys.stderr.write(
			f"gpio-companion ble: advertise retry {state['ad_tries']}: {error}\n"
		)
		ad_manager.UnregisterAdvertisement(
			ad.get_path(),
			reply_handler=lambda: None,
			error_handler=lambda _error: None,
		)
		if state["ad_tries"] >= 8:
			fail("advertise failed", error)
			return
		GLib.timeout_add(500, start_ad)

	def on_app_ok():
		start_ad()

	service_manager.RegisterApplication(
		app.get_path(),
		{},
		reply_handler=on_app_ok,
		error_handler=lambda error: fail("register failed", error),
	)
	loop.run()
	if state["failed"]:
		sys.exit(1)


def ble_forward_headers(headers):
	return {
		"content-type": "application/json",
		"X-Gpio-Via": "ble",
		**{str(k): str(v) for k, v in (headers or {}).items()},
	}


def ble_debug_payload(method, path, status, message):
	return json.dumps(
		{
			"method": method,
			"path": path,
			"status": status,
			"message": message,
			"via": "ble",
		}
	).encode("utf-8")


def report_debug(method, path, status, message):
	try:
		req = urllib.request.Request(
			f"{API}/v1/debug/event",
			data=ble_debug_payload(method, path, status, message),
			method="POST",
			headers={"content-type": "application/json"},
		)
		urllib.request.urlopen(req, timeout=1).read()
	except Exception:
		pass


def forward_envelope(payload, status_char):
	method = "PUT"
	path = "/v1/config/wifi"
	status_char.set_value(b'{"pending":true}')
	try:
		envelope = json.loads(payload)
		body = envelope.get("body") or ""
		headers = envelope.get("headers") or {}
		path = envelope.get("path") or path
		method = envelope.get("method") or method
		if not any(str(key).lower() == "x-gpio-signature" for key in headers):
			status_char.set_value(b'{"error":"missing device signature"}')
			report_debug(method, path, 401, "missing device signature")
			return False
		req = urllib.request.Request(
			f"{API}{path}",
			data=body.encode("utf-8") if body else None,
			method=method,
			headers=ble_forward_headers(headers),
		)
		with urllib.request.urlopen(req, timeout=45) as resp:
			status_char.set_value(resp.read())
	except json.JSONDecodeError:
		status_char.set_value(b'{"error":"ble forward failed"}')
		report_debug(method, path, 400, "invalid envelope")
	except Exception as error:
		message = b'{"error":"ble forward failed"}'
		if isinstance(error, urllib.error.HTTPError):
			message = error.read() or message
		else:
			report_debug(method, path, 504, "ble forward failed")
		status_char.set_value(message)
	return False


def main():
	dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
	bus = dbus.SystemBus()
	adapter = wait_adapter(bus)
	if adapter is None:
		sys.stderr.write("gpio-companion ble: no bluetooth adapter\n")
		sys.exit(0)

	app = Application(bus)
	svc = Service(bus, 0, SERVICE_UUID)
	info = Characteristic(bus, 0, INFO_UUID, ["read"], svc)
	info.set_value(
		json.dumps(
			{
				"uuid": PAIR_UUID,
				"hardware": HARDWARE,
				"name": LOCAL_NAME,
				"deviceUrl": DEVICE_URL,
			}
		).encode("utf-8")
	)
	status = Characteristic(bus, 2, STATUS_UUID, ["read", "notify"], svc)
	status.set_value(b'{"ready":true}')
	def queue_forward(payload):
		status.set_value(b'{"pending":true}')
		GLib.idle_add(forward_envelope, payload, status)

	cmd = CommandCharacteristic(
		bus,
		1,
		CMD_UUID,
		["write", "write-without-response"],
		svc,
		queue_forward,
	)
	svc.add_characteristic(info)
	svc.add_characteristic(cmd)
	svc.add_characteristic(status)
	app.add_service(svc)

	service_manager = dbus.Interface(bus.get_object(BLUEZ, adapter), GATT_MANAGER)
	ad_manager = dbus.Interface(bus.get_object(BLUEZ, adapter), LE_AD_MANAGER)
	ad = Advertisement(bus)
	register_gatt(service_manager, ad_manager, app, ad)


if __name__ == "__main__":
	main()
