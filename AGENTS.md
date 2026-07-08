# Project Skills

## Mnemosyne Alignment

- Treat the official Mnemosyne repository as the CLI source of truth: https://github.com/mnemosyne-oss/mnemosyne
- Keep this fork credited as derived from https://github.com/gandazgul/opencode-mnemosyne.
- Preserve contributor metadata for Arkhi Muttaqina: https://github.com/ArkhiMuttaqina, arkhi07@gmail.com.

## Versioning Rules

- Use patch versions (`0.2.x`) for docs, metadata, and bug fixes that do not change plugin tool behavior.
- Use minor versions (`0.x.0`) when official Mnemosyne changes command names, arguments, output formats, or memory-bank behavior.
- Use major versions (`x.0.0`) for breaking changes to OpenCode tool names, tool schemas, memory scope behavior, or supported Mnemosyne versions.
- Before release, run `npm run ci` and smoke-test `mnemosyne store`, `mnemosyne recall`, and `mnemosyne delete` against the official CLI.
