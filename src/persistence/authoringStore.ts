import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

type NoteRequestRow = {
  profile_id: string;
  client_request_id: string;
  request_fingerprint: string;
  note_id: number;
  created_at: string;
};

export class AuthoringStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  getNoteRequest(
    profileId: string,
    clientRequestId: string
  ):
    | {
        clientRequestId: string;
        requestFingerprint: string;
        noteId: number;
        createdAt: string;
      }
    | undefined {
    const row = this.db
      .prepare(
        `
        SELECT *
        FROM note_request_log
        WHERE profile_id = ? AND client_request_id = ?
      `
      )
      .get(profileId, clientRequestId) as NoteRequestRow | undefined;

    if (!row) {
      return undefined;
    }

    return {
      clientRequestId: row.client_request_id,
      requestFingerprint: row.request_fingerprint,
      noteId: row.note_id,
      createdAt: row.created_at,
    };
  }

  insertNoteRequest(input: {
    profileId: string;
    clientRequestId: string;
    requestFingerprint: string;
    noteId: number;
    createdAt: string;
  }): void {
    this.db
      .prepare(
        `
        INSERT INTO note_request_log (
          profile_id, client_request_id, request_fingerprint, note_id, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(
        input.profileId,
        input.clientRequestId,
        input.requestFingerprint,
        input.noteId,
        input.createdAt
      );
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS note_request_log (
        profile_id TEXT NOT NULL,
        client_request_id TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        note_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (profile_id, client_request_id)
      );

      CREATE INDEX IF NOT EXISTS idx_note_request_log_profile_note
        ON note_request_log(profile_id, note_id);
    `);
  }
}
