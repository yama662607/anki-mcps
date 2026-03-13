# Real Anki E2E

This project includes a semi-automated smoke script for a live Anki profile.

## Safety rules

- Do not open the live collection with `sqlite3` while Anki is running.
- Do not force-kill Anki while a profile is loading.
- If Anki shows a database warning, use `Tools -> Check Database` inside Anki before continuing.
- Build the server first with `npm run build`.

## Preconditions

- Anki is running
- AnkiConnect is enabled
- optional: `anki-connect-extension` is installed if you want the read-only native preview path instead of edit-dialog fallback

## Start a single-note smoke run

```bash
ANKI_E2E_PROFILE_ID="your-profile" npm run e2e:anki
```

What it does:

- ensures `Testing::E2E::Single`
- upserts a minimal `e2e.v1.review-note` note type
- creates one suspended review-pending note with `add_note`
- opens `open_note_preview`
- saves state to `.data/real-anki-e2e-state.json`

## Start a batch smoke run

```bash
ANKI_E2E_PROFILE_ID="your-profile" ANKI_E2E_MODE=batch npm run e2e:anki
```

What it does:

- ensures `Testing::E2E::Batch`
- upserts the same minimal note type
- creates two suspended review-pending notes with `add_notes_batch`
- opens preview for the first note
- saves state to `.data/real-anki-e2e-state.json`

## Finalize after visual review

Single note:

```bash
ANKI_E2E_PROFILE_ID="your-profile" ANKI_E2E_SCENARIO=finalize ANKI_E2E_FINALIZE=update npm run e2e:anki
ANKI_E2E_PROFILE_ID="your-profile" ANKI_E2E_SCENARIO=finalize ANKI_E2E_FINALIZE=unsuspend npm run e2e:anki
ANKI_E2E_PROFILE_ID="your-profile" ANKI_E2E_SCENARIO=finalize ANKI_E2E_FINALIZE=delete npm run e2e:anki
```

Batch:

```bash
ANKI_E2E_PROFILE_ID="your-profile" ANKI_E2E_MODE=batch ANKI_E2E_SCENARIO=finalize ANKI_E2E_FINALIZE=unsuspend npm run e2e:anki
ANKI_E2E_PROFILE_ID="your-profile" ANKI_E2E_MODE=batch ANKI_E2E_SCENARIO=finalize ANKI_E2E_FINALIZE=delete npm run e2e:anki
```

## Expected review workflow

1. `add_note` or `add_notes_batch`
2. `open_note_preview`
3. Human review in the Anki GUI
4. Natural-language feedback to the agent
5. Agent calls `update_note`, `set_note_cards_suspended`, or `delete_note`

The smoke script mirrors that exact workflow.
