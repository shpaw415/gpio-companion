#!/usr/bin/env python3
import argparse
import json
import queue
import re
import struct
import subprocess
import sys
import threading
import time

SERVICE = "a1c15e00-6f10-4c9a-9c31-47b0c15e0001"
INFO = "a1c15e00-6f10-4c9a-9c31-47b0c15e0002"
CMD = "a1c15e00-6f10-4c9a-9c31-47b0c15e0003"
STATUS = "a1c15e00-6f10-4c9a-9c31-47b0c15e0004"
MTU = 20


def emit(payload):
	sys.stdout.write(json.dumps(payload) + "\n")
	sys.stdout.flush()


def idle(text):
	raw = (text or "").strip()
	if not raw:
		return True
	try:
		parsed = json.loads(raw)
	except json.JSONDecodeError:
		return False
	if not isinstance(parsed, dict):
		return False
	keys = list(parsed.keys())
	if keys == ["ready"] and parsed.get("ready") is True:
		return True
	return keys == ["pending"] and parsed.get("pending") is True


def complete(text):
	raw = (text or "").strip()
	if not raw or idle(raw):
		return False
	try:
		json.loads(raw)
		return True
	except json.JSONDecodeError:
		return True


def frames(payload):
	body = payload.encode("utf-8")
	blob = struct.pack(">I", len(body)) + body
	for offset in range(0, len(blob), MTU):
		yield blob[offset : offset + MTU]


def decode_info(text):
	raw = (text or "").strip()
	try:
		parsed = json.loads(raw)
		if isinstance(parsed, dict):
			return parsed
	except json.JSONDecodeError:
		pass
	return {"raw": raw}


def scan_address(timeout):
	listed = subprocess.run(
		["bluetoothctl", "devices"],
		capture_output=True,
		text=True,
		timeout=8,
	)
	match = re.search(
		r"Device\s+([0-9A-F:]{17})\s+gpio-companion",
		listed.stdout or "",
		re.I,
	)
	if match:
		return match.group(1)
	proc = subprocess.run(
		["bluetoothctl", "--timeout", str(max(int(timeout), 5)), "scan", "le"],
		capture_output=True,
		text=True,
		timeout=timeout + 5,
	)
	text = (proc.stdout or "") + "\n" + (listed.stdout or "")
	match = re.search(
		r"Device\s+([0-9A-F:]{17})\s+gpio-companion",
		text,
		re.I,
	)
	if match:
		return match.group(1)
	raise RuntimeError("no gpio-companion radio found")


class GattTool:
	def __init__(self, address):
		self.address = address
		self.proc = subprocess.Popen(
			["gatttool", "-t", "public", "-b", address, "-I"],
			stdin=subprocess.PIPE,
			stdout=subprocess.PIPE,
			stderr=subprocess.STDOUT,
			text=True,
			bufsize=1,
		)
		self.lines = queue.Queue()
		self.thread = threading.Thread(target=self._pump, daemon=True)
		self.thread.start()
		self.handles = {INFO: None, CMD: None, STATUS: None}
		self.cccd = None

	def _pump(self):
		assert self.proc.stdout is not None
		ansi = re.compile(r"\x1b\[[0-9;]*m")
		for line in self.proc.stdout:
			self.lines.put(ansi.sub("", line).rstrip("\n"))

	def send(self, command):
		assert self.proc.stdin is not None
		self.proc.stdin.write(command + "\n")
		self.proc.stdin.flush()

	def wait_contains(self, needle, timeout):
		deadline = time.time() + timeout
		collected = []
		while time.time() < deadline:
			remain = deadline - time.time()
			try:
				line = self.lines.get(timeout=max(remain, 0.05))
			except queue.Empty:
				continue
			collected.append(line)
			if needle.lower() in line.lower():
				return "\n".join(collected)
		raise TimeoutError(
			f"gatttool timed out waiting for {needle}: " + " | ".join(collected[-8:])
		)

	def drain(self):
		while True:
			try:
				self.lines.get_nowait()
			except queue.Empty:
				return

	def connect(self, timeout):
		self.send("connect")
		try:
			self.wait_contains("connection successful", timeout)
		except TimeoutError as error:
			self.send("connect")
			try:
				self.wait_contains("connection successful", timeout)
			except TimeoutError:
				raise error from None

	def discover(self):
		self.drain()
		self.send("characteristics")
		deadline = time.time() + 8
		found = 0
		while time.time() < deadline and found < 3:
			remain = deadline - time.time()
			try:
				line = self.lines.get(timeout=max(remain, 0.05))
			except queue.Empty:
				continue
			match = re.search(
				r"char value handle\s*[:=]\s*(0x[0-9a-f]+).*uuid\s*[:=]\s*([0-9a-f-]+)",
				line,
				re.I,
			)
			if not match:
				continue
			handle, uuid = match.group(1), match.group(2).lower()
			if uuid in self.handles:
				self.handles[uuid] = handle
				found += 1
		missing = [uuid for uuid, handle in self.handles.items() if not handle]
		if missing:
			raise RuntimeError(f"missing GATT characteristics: {', '.join(missing)}")
		status_handle = int(self.handles[STATUS], 16)
		self.cccd = f"0x{status_handle + 1:04x}"
		self.drain()
		self.send(f"char-write-req {self.cccd} 01 00")
		try:
			self.wait_contains("written successfully", 3)
		except TimeoutError:
			self.cccd = None

	def read_handle(self, handle, timeout=8):
		self.drain()
		self.send(f"char-read-hnd {handle}")
		raw = self.wait_contains("characteristic value/descriptor", timeout)
		match = re.search(
			r"characteristic value/descriptor:\s*([0-9a-fA-F ]+)",
			raw,
			re.I,
		)
		if not match:
			raise RuntimeError(f"gatttool read failed: {raw}")
		hexed = re.sub(r"\s+", "", match.group(1))
		return bytes.fromhex(hexed).decode("utf-8", "replace")

	def write_cmd(self, handle, data):
		hexed = " ".join(f"{byte:02x}" for byte in data)
		self.send(f"char-write-req {handle} {hexed}")
		try:
			self.wait_contains("written successfully", 3)
		except TimeoutError:
			pass

	def close(self):
		try:
			self.send("disconnect")
		except Exception:
			pass
		self.proc.kill()


def session(args):
	address = scan_address(args.scan_timeout)
	gatt = GattTool(address)
	try:
		gatt.connect(args.timeout)
		gatt.discover()
		info_text = gatt.read_handle(gatt.handles[INFO])
		info = decode_info(info_text)
		board = str(info.get("uuid") or "").strip()
		wanted = (args.uuid or "").strip()
		if wanted and board and board.lower() != wanted.lower():
			raise RuntimeError(f"GATT info UUID {board} does not match {args.uuid}")
		emit({"event": "ready", "info": info, "address": address})
		for line in sys.stdin:
			text = line.strip()
			if not text:
				continue
			message = json.loads(text)
			cmd = message.get("cmd")
			if cmd == "close":
				break
			if cmd != "send":
				emit({"event": "error", "error": f"unknown cmd {cmd}"})
				continue
			try:
				raw = send_envelope(gatt, message["envelope"], args.timeout)
				emit({"event": "result", "raw": raw})
			except Exception as error:
				emit({"event": "error", "error": str(error)})
	finally:
		gatt.close()


def send_envelope(gatt, envelope, timeout):
	payload = json.dumps(envelope, separators=(",", ":"))
	previous = ""
	try:
		previous = gatt.read_handle(gatt.handles[STATUS]).strip()
	except Exception:
		previous = ""
	for frame in frames(payload):
		gatt.write_cmd(gatt.handles[CMD], frame)
		time.sleep(0.01)
	deadline = time.time() + timeout
	while time.time() < deadline:
		try:
			text = gatt.read_handle(gatt.handles[STATUS], timeout=5).strip()
		except Exception:
			text = ""
		if complete(text) and text != previous:
			return text
		time.sleep(0.25)
	raise TimeoutError(
		"bluetooth timed out waiting for the status characteristic. Update the Pi companion BLE helper if this persists."
	)


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument("--uuid", default="")
	parser.add_argument("--timeout", type=float, default=30)
	parser.add_argument("--scan-timeout", type=float, default=20)
	args = parser.parse_args()
	try:
		session(args)
	except Exception as error:
		emit({"event": "error", "error": str(error)})
		sys.exit(1)


if __name__ == "__main__":
	main()
