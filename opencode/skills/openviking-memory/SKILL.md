---
name: openviking-memory
description: >-
  On-device OpenViking memory reflex for gpio-companion agents. Load at every
  session start and before GPIO work when the openviking MCP tools are
  available; falls back to the gpio-pinout-* skills when they are not.
---

# OpenViking memory reflex (gpio-companion)

## First: check whether this board runs the memory server

If the `openviking_*` MCP tools (for example `openviking_recall`, `openviking_find`, `openviking_read`, `openviking_remember`) are callable in this session, the board's OpenViking server is installed — follow **With the memory server**. If they are missing, follow **Without the memory server**. Never assume; a board may have skipped the optional install (small eMMC).

## With the memory server

1. **Recall before work.** At session start and before any GPIO/project decision, call `openviking_recall` / `openviking_find` for project facts, preferences, and prior decisions instead of re-reading whole files or re-deriving from chat history.
2. **Pinout discipline.** The exact pinout for THIS board — and only this board — is seeded under `viking://resources/gpio-companion/boards/<slug>/` (slug examples: `orangepi-3-lts`, `raspberrypi`). Scope pinout retrieval to that URI (for example with `target_uri`) and read the matching `pinout.md`/`board.md`. **Never answer pinout from general knowledge, another board's schema, or unscoped search results** — if a retrieval returns a pin table from a different board, discard it. No cross-board data is seeded, so any foreign table means a bad query, not extra knowledge.
3. **Remember durable decisions.** Wiring choices, resolved gpiochip lines, board quirks, failures and their fixes, user preferences — persist with `openviking_remember` proactively; do not wait to be asked.
4. **Verify before claiming saved.** After `openviking_remember` / `openviking_add_resource`, confirm with `openviking_find` or `openviking_read` before telling the user it is stored.
5. **Never forget** memory without the user's explicit confirmation.
6. **Health troubles**: if calls fail, run `curl http://127.0.0.1:1933/health` once; if the server is down, mention it and continue without memory rather than blocking the task.

## Without the memory server

Load `opencode/skills/gpio-pinout-<hardware>/` (from `~/.config/opencode/skills/`) exactly as before the memory server existed: hardware comes from `/etc/gpio-companion/config.json` or `/proc/device-tree/model`. Orange Pi pins resolve live with `gpioinfo` / WiringOP `gpio readall`; Raspberry Pi uses BCM + the skill's `pinout.json`. Do not reference `viking://` URIs to the user on such boards, and keep the session self-sufficient — nothing was persisted.
