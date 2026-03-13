# AGENTS.md

This file contains instructions for AI agents working on this project.

## Justfile Usage (AI Agent Protocol)

This project uses `just` for task automation. Agents MUST use these commands for quality assurance.

### Core Principles
- **Default behavior**: `just` (no args) = `just check`
- **Agent requirement**: Run `just check` after any file edits and report results
- **First response**: If `just check` fails, run `just fix` then `just check` again

### Standard Interface

| Command | Purpose | CI Safe |
|---------|---------|---------|
| `just check` | Read-only quality verification (CI gate) | Yes |
| `just fix` | Auto-fix format and lint issues | No |
| `just setup` | Install dependencies, setup toolchain | No |

### Workflow
1. Before starting work: Run `just check` to verify baseline
2. After editing files: Run `just check` to verify changes
3. If errors occur: Run `just fix` for auto-fixes, then `just check` again
4. Before committing: Ensure `just check` passes

### Granular Commands

**Format**
- `just fmt-check` — Check formatting (read-only)
- `just fmt` — Apply formatting (modifies files)

**Lint**
- `just lint` — Check linting (read-only)
- `just lint-fix` — Fix linting issues (modifies files)

**Typecheck**
- `just typecheck` — Run TypeScript type checker

**Testing**
- `just test [args]` — Run Vitest unit tests (argument pass-through)
- `just test-mcp` — Run MCP server tests specifically
- `just test-watch` — Run tests in watch mode
- `just e2e [args]` — Run E2E tests against real Anki (argument pass-through)

**Development**
- `just dev` — Start development server
- `just build` — Production build
- `just clean` — Remove build artifacts

**Dependencies**
- `just upgrade` — Upgrade all dependencies (with safety checks)

### Important Notes
- Biome is currently optional — format/lint commands will skip if not installed
- `just check` matches CI exactly — use it as your quality gate
- `just test` and `just e2e` accept argument pass-through
- Report `just check` results after any file modifications

## Project Structure

```
anki-mcp/
├── src/              # Source code
│   ├── contracts/    # Type definitions and schemas
│   ├── gateway/      # AnkiConnect API gateway
│   ├── mcp/          # MCP server implementation
│   ├── persistence/  # Data persistence layer
│   ├── services/     # Business logic services
│   └── utils/        # Utility functions
├── tests/            # Test files
├── dist/             # Build output
└── scripts/          # Build and utility scripts
```

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js >= 22
- **Package Manager**: npm
- **Testing**: Vitest
- **Build**: TypeScript compiler (tsc)
- **MCP SDK**: @modelcontextprotocol/sdk

## Coding Conventions

- Use TypeScript strict mode
- Follow functional programming patterns where appropriate
- Services handle business logic, gateways handle external APIs
- Use Zod for runtime validation
- Prefer composition over inheritance
