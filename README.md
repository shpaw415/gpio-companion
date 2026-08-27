# gpio-companion

Bun monorepo for gpio-companion.

```txt
.
├── apps/          # applications
├── packages/      # shared libraries
└── binary/        # compile-to-native CLIs
```

## Workspaces

| Path | Package | Role |
| --- | --- | --- |
| `packages/core` | `gpio-companion` | shared library |
| `apps/web` | `gpio-companion-web` | web companion |
| `binary/gpio-companion` | `gpio-companion-bin` | standalone binary |

## Scripts

```sh
bun install
bun test
bun run typecheck
bun run dev
bun run compile
```
