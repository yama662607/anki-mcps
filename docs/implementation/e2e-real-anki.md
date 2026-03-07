# Real Anki E2E

This project now includes a semi-automated E2E script for real Anki.

## Preconditions

- Anki is running
- AnkiConnect is enabled
- the optional `anki-connect-extension` add-on is installed if you want `guiPreviewNote`
- project is built with `npm run build`

## Start run

```bash
ANKI_E2E_PROFILE_ID="your-profile" npm run e2e:anki
```

What it does:
- upserts a minimal `e2e.v1.basic` note type
- upserts a matching custom card type definition
- creates a staged card
- opens Anki preview
- saves the staged state to `.data/real-anki-e2e-state.json`

## Finalize after visual review

Commit:

```bash
ANKI_E2E_PROFILE_ID="your-profile" ANKI_E2E_SCENARIO=finalize ANKI_E2E_FINALIZE=commit npm run e2e:anki
```

Discard:

```bash
ANKI_E2E_PROFILE_ID="your-profile" ANKI_E2E_SCENARIO=finalize ANKI_E2E_FINALIZE=discard npm run e2e:anki
```

## Why this is semi-automated

- the script automates setup, staging, and finalization
- visual inspection of the Anki preview remains manual
- final approval is explicit through the second command
