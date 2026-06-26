# Dependency License Notes

Generated during the `0.1.0` release review from `package-lock.json`.

## Direct Dependencies

| Package | Version | License |
|---|---:|---|
| `better-sqlite3` | `12.10.0` | MIT |
| `input` | `1.0.1` | MIT |
| `qrcode` | `1.5.4` | MIT |
| `qrcode-terminal` | `0.12.0` | not declared in package metadata |
| `telegram` | `2.26.22` | MIT |

## Notable Transitive Dependencies

| Package | Version | License | Via |
|---|---:|---|---|
| `@cryptography/aes` | `0.1.1` | GPL-3.0-or-later | `telegram` |
| `big-integer` | `1.6.52` | Unlicense | `telegram` |

## Release Note

The `@cryptography/aes` license is the only GPL-family license detected in the locked dependency tree. Treat this as a release risk that needs maintainer/legal acceptance before npm publishing or redistribution.
