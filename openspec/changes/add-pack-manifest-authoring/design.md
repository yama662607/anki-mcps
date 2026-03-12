## Context

The current server already lets an agent create arbitrary note types, card type definitions, and draft cards through MCP tools, but reusable starter packs remain hard-coded in `src/contracts/starterPacks.ts`. This means a new domain can be prototyped in a single session, yet it cannot be registered as a reusable pack for future sessions without editing and shipping new MCP code.

The main technical constraint is safety: pack application can mutate note types and custom card type definitions, so a custom pack registry must not silently take over resources that were created manually or by a different pack. The current design also has a second constraint: `apply_starter_pack` only accepts a fixed `options` object (`deckRoot`, `languages`), which is too narrow for agent-authored packs.

## Goals / Non-Goals

**Goals:**
- Allow agents to register reusable custom pack manifests without changing MCP source code.
- Keep pack application on the existing safe path: `apply -> create_draft -> preview -> commit/discard`.
- Unify built-in and custom pack discovery so clients can use one catalog.
- Prevent accidental overwrite of resources managed outside the target pack.
- Generalize pack options so future packs are not limited to `deckRoot` and `languages`.

**Non-Goals:**
- Replacing the built-in packs with database-seeded copies.
- Supporting destructive note type migration beyond the existing additive-safe policy.
- Automatically generating learning content or notes from pack registration alone.
- Cross-profile or cloud-synced pack sharing in this phase.
- Adding new field primitives beyond the current field kinds and HTML policies.

## Decisions

### 1. Store custom pack manifests in the existing SQLite state store
Custom packs will be persisted in the local MCP SQLite database, scoped by `profileId` and `packId`, alongside the existing draft metadata and custom card type definitions.

Why:
- The project already uses SQLite for profile-scoped mutable state.
- Registry operations must be available even when Anki data has not yet been provisioned.
- SQLite gives deterministic local persistence without introducing a new config file location or merge story.

Alternatives considered:
- JSON files in the repo: rejected because runtime-authored packs should not require workspace writes or git involvement.
- Persisting inside Anki notes: rejected because pack manifests are MCP control-plane data, not learning content.

### 2. Keep built-in packs code-defined and overlay custom packs at runtime
Built-in packs will remain in `src/contracts/starterPacks.ts`. Custom packs will be loaded from SQLite and merged into the same discovery/apply path.

Why:
- It preserves the current built-in behavior and avoids a migration of stable curated packs.
- It gives a clear trust boundary: built-ins are shipped with the server, custom packs are user/agent-authored.

Alternatives considered:
- Moving built-ins into SQLite during migration: rejected because it adds unnecessary migration complexity and weakens reproducibility.

### 3. Add explicit pack authoring tools instead of overloading starter-pack tools
The new control-plane tools will be:
- `list_pack_manifests`
- `get_pack_manifest`
- `upsert_pack_manifest`
- `deprecate_pack_manifest`

Existing user-facing provisioning tools remain:
- `list_starter_packs`
- `apply_starter_pack`

Why:
- Discovery/apply and registry authoring are different risk levels and should stay separate.
- This mirrors the existing split between card-type authoring and draft creation.
- It keeps agent usage simple: registry tools for setup, starter-pack tools for provisioning.

Alternatives considered:
- Reusing `upsert_card_type_definition` to store pack-shaped metadata: rejected because pack manifests include note types, deck roots, and option contracts.
- Adding delete tools: rejected in favor of deprecation to preserve auditability and rollback paths.

### 4. Generalize pack options to a manifest-defined option map
`apply_starter_pack` will move from a fixed options object to a dynamic string/string-array map validated against the selected manifest's `supportedOptions` definitions.

Why:
- A truly agent-authored pack cannot be constrained to the built-in `deckRoot` and `languages` options.
- The manifest already advertises `supportedOptions`; the apply contract should honor that dynamically.

Compatibility approach:
- Existing built-in packs keep advertising the same options, so current clients can keep sending `deckRoot` and `languages`.
- Unknown options remain validation errors.

Alternatives considered:
- Keeping fixed options and forcing all new packs into the same shape: rejected because it defeats the core goal.

### 5. Track pack ownership of provisioned resources
A new ownership ledger will record which note types and custom card type definitions were last provisioned by which `(profileId, packId)`.

Why:
- Without ownership tracking, applying a custom pack could silently overwrite resources created manually or by another pack.
- Reapply needs to distinguish safe updates from collisions.

Operational rule:
- Reapplying the same pack may update resources it already owns.
- If a manifest wants to mutate a resource owned by another pack, or an unmanaged conflicting resource, the apply step must fail with `CONFLICT`.
- Dry-run must surface the same collision before any write.

Alternatives considered:
- Relying only on unique IDs and naming conventions: rejected because agents and users make mistakes, and collisions need deterministic protection.

### 6. Keep pack application free of learning-note creation
Applying a pack will continue to provision only note types, card type definitions, deck roots, tag templates, and ownership metadata. It will not create notes or drafts.

Why:
- It preserves the current separation between authoring setup and actual card creation.
- It avoids accidental content injection during pack registration.

## Risks / Trade-offs

- [Registry state becomes more complex] -> Keep the manifest store and ownership ledger small, profile-scoped, and fully covered by service tests.
- [Custom packs still cannot express brand-new field primitives] -> Accept this for now; reuse existing field kinds and add new primitives only in a future change when there is evidence they are needed.
- [Ownership rules may block legitimate refactors] -> Prefer fail-closed behavior; users can deprecate and recreate packs rather than silently taking over resources.
- [Dynamic options make schemas looser] -> Counterbalance with explicit per-manifest validation and contract/resource examples.
- [Built-in and custom pack catalogs can diverge in UX expectations] -> Use one summary shape with explicit `source` metadata and stable discovery ordering.

## Migration Plan

1. Add SQLite tables for custom pack manifests and pack-owned resources.
2. Introduce registry tools and merged starter-pack discovery without changing draft workflow.
3. Extend `apply_starter_pack` to resolve built-in or custom manifests and validate dynamic options.
4. Add ownership conflict checks in both dry-run and apply paths.
5. Add docs and regression coverage.
6. Rollback strategy: if the feature must be disabled, stop exposing new tools and ignore custom pack manifests; existing built-in packs continue to work because they remain code-defined.

## Open Questions

- None for this phase. The design intentionally keeps pack sharing/export, destructive migrations, and new field primitives out of scope.
