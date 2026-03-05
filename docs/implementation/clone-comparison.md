# Clone Comparison Summary

Compared reference implementations in `clones/` against v1 target criteria:

| Project | Safety | Recovery | Testability | Observability | Total |
|---|---:|---:|---:|---:|---:|
| `anki-connect-mcp` | 2 | 1 | 2 | 1 | 6 |
| `anki-mcp` | 3 | 2 | 2 | 2 | 9 |
| `anki-mcp-server` | 3 | 2 | 3 | 2 | 10 |
| `ankimcp-anki-mcp-server` | 3 | 3 | 3 | 3 | 12 |
| **this project target (v1)** | **4** | **4** | **4** | **4** | **16** |

Rationale for target advantage:
- strict staged lifecycle state machine
- explicit commit/discard separation
- deterministic conflict fingerprinting
- write-time explicit profile requirement
- frozen v1 schema registry and contract resources
