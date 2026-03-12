## MODIFIED Requirements

### Requirement: Starter pack discovery
The system SHALL expose a stable catalog of built-in and custom starter packs so an agent can discover reusable domain bootstraps without reading repository docs.

#### Scenario: List available starter packs
- **WHEN** the client calls `list_starter_packs`
- **THEN** the server returns active pack summaries including `packId`, `label`, `version`, `domains`, `supportedOptions`, and `source`
- **AND** built-in and active custom packs use the same summary shape

#### Scenario: Starter pack catalog is also cacheable
- **WHEN** the client reads the starter-pack resource for the same server state
- **THEN** the pack list is semantically equivalent to the tool output for that version
- **AND** the resource reflects newly registered or deprecated custom packs for that profile context

### Requirement: Starter pack application
The system SHALL provide an idempotent starter-pack application flow that provisions note types and custom card type definitions from either built-in or registered custom manifests without creating learning notes.

#### Scenario: Dry-run starter pack application
- **WHEN** the client applies any starter pack with `dryRun=true`
- **THEN** the system returns the note types, card type definitions, deck roots, and tag templates that would be created or updated
- **AND** no Anki models, card type definitions, ownership records, or notes are mutated

#### Scenario: Reapply same starter pack version
- **WHEN** the client reapplies the same `packId` and `version` against the same profile
- **THEN** the operation succeeds without duplicate definitions
- **AND** the response identifies unchanged versus updated items

#### Scenario: Unknown pack is rejected
- **WHEN** the client applies a `packId` that is neither built-in nor registered for that profile
- **THEN** the server returns `NOT_FOUND`
- **AND** no provisioning side effects occur

### Requirement: Pack options are explicit and validated
The system SHALL validate manifest-defined pack options before attempting application.

#### Scenario: Unknown option is rejected
- **WHEN** the client supplies an option key that is not declared in the target pack's `supportedOptions`
- **THEN** the server returns `INVALID_ARGUMENT`
- **AND** no apply operation starts

#### Scenario: Required option is enforced
- **WHEN** the target pack declares a required option and the client omits it
- **THEN** the server returns `INVALID_ARGUMENT`
- **AND** the response identifies the missing option name

#### Scenario: Pack defaults are deterministic
- **WHEN** the client omits optional pack configuration
- **THEN** the system uses the manifest's declared default values
- **AND** does not guess profile-specific values beyond the existing explicit profile resolution rules
