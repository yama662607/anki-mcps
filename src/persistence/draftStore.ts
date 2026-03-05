import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DraftListItem, DraftRecord, DraftState } from '../contracts/types.js';

export type DraftRow = {
  profile_id: string;
  draft_id: string;
  note_id: number;
  card_ids_json: string;
  state: DraftState;
  card_type_id: string;
  fingerprint: string;
  supersedes_draft_id: string | null;
  chain_depth: number;
  fields_json: string;
  tags_json: string;
  deck_name: string;
  mod_timestamp: number;
  client_request_id: string;
  request_fingerprint: string;
  staged_marker_tag: string;
  created_at: string;
  updated_at: string;
  committed_at: string | null;
  discarded_at: string | null;
};

export class DraftStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  insertDraft(record: DraftRecord, requestFingerprint: string): void {
    this.db
      .prepare(
        `
        INSERT INTO drafts (
          profile_id, draft_id, note_id, card_ids_json, state, card_type_id, fingerprint,
          supersedes_draft_id, chain_depth, fields_json, tags_json, deck_name, mod_timestamp,
          client_request_id, request_fingerprint, staged_marker_tag,
          created_at, updated_at, committed_at, discarded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      `,
      )
      .run(
        record.profileId,
        record.draftId,
        record.noteId,
        JSON.stringify(record.cardIds),
        record.state,
        record.cardTypeId,
        record.fingerprint,
        record.supersedesDraftId ?? null,
        record.chainDepth,
        JSON.stringify(record.fields),
        JSON.stringify(record.tags),
        record.deckName,
        record.modTimestamp,
        record.clientRequestId,
        requestFingerprint,
        record.stagedMarkerTag,
        record.createdAt,
        record.updatedAt,
      );
  }

  getDraft(profileId: string, draftId: string): DraftRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM drafts WHERE profile_id = ? AND draft_id = ?`)
      .get(profileId, draftId) as DraftRow | undefined;
    return row ? mapRowToDraft(row) : undefined;
  }

  findDraftById(draftId: string): DraftRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM drafts WHERE draft_id = ?`).get(draftId) as DraftRow | undefined;
    return row ? mapRowToDraft(row) : undefined;
  }

  findByClientRequestId(profileId: string, clientRequestId: string): { draft: DraftRecord; requestFingerprint: string } | undefined {
    const row = this.db
      .prepare(`SELECT * FROM drafts WHERE profile_id = ? AND client_request_id = ?`)
      .get(profileId, clientRequestId) as DraftRow | undefined;
    if (!row) {
      return undefined;
    }
    return {
      draft: mapRowToDraft(row),
      requestFingerprint: row.request_fingerprint,
    };
  }

  updateDraftState(input: {
    profileId: string;
    draftId: string;
    state: DraftState;
    updatedAt: string;
    committedAt?: string;
    discardedAt?: string;
  }): void {
    this.db
      .prepare(
        `
        UPDATE drafts
        SET state = ?, updated_at = ?, committed_at = COALESCE(?, committed_at), discarded_at = COALESCE(?, discarded_at)
        WHERE profile_id = ? AND draft_id = ?
      `,
      )
      .run(
        input.state,
        input.updatedAt,
        input.committedAt ?? null,
        input.discardedAt ?? null,
        input.profileId,
        input.draftId,
      );
  }

  updateFingerprint(profileId: string, draftId: string, fingerprint: string, modTimestamp: number, updatedAt: string): void {
    this.db
      .prepare(
        `
        UPDATE drafts
        SET fingerprint = ?, mod_timestamp = ?, updated_at = ?
        WHERE profile_id = ? AND draft_id = ?
      `,
      )
      .run(fingerprint, modTimestamp, updatedAt, profileId, draftId);
  }

  listDrafts(input: {
    profileId: string;
    states?: DraftState[];
    limit: number;
    cursor?: string;
  }): { items: DraftListItem[]; nextCursor?: string } {
    const params: any[] = [input.profileId];
    const whereParts = ['profile_id = ?'];

    if (input.states && input.states.length > 0) {
      whereParts.push(`state IN (${input.states.map(() => '?').join(',')})`);
      params.push(...input.states);
    }

    if (input.cursor) {
      const decoded = decodeCursor(input.cursor);
      whereParts.push('(updated_at < ? OR (updated_at = ? AND draft_id < ?))');
      params.push(decoded.updatedAt, decoded.updatedAt, decoded.draftId);
    }

    params.push(input.limit + 1);

    const rows = this.db
      .prepare(
        `
        SELECT draft_id, note_id, state, card_type_id, supersedes_draft_id, chain_depth, created_at, updated_at
        FROM drafts
        WHERE ${whereParts.join(' AND ')}
        ORDER BY updated_at DESC, draft_id DESC
        LIMIT ?
      `,
      )
      .all(...params) as Array<{
      draft_id: string;
      note_id: number;
      state: DraftState;
      card_type_id: string;
      supersedes_draft_id: string | null;
      chain_depth: number;
      created_at: string;
      updated_at: string;
    }>;

    const hasMore = rows.length > input.limit;
    const materialized = hasMore ? rows.slice(0, input.limit) : rows;

    const items: DraftListItem[] = materialized.map((row) => ({
      draftId: row.draft_id,
      noteId: row.note_id,
      state: row.state,
      cardTypeId: row.card_type_id,
      supersedesDraftId: row.supersedes_draft_id ?? undefined,
      chainDepth: row.chain_depth,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const nextCursor = hasMore
      ? encodeCursor({
          updatedAt: materialized[materialized.length - 1]!.updated_at,
          draftId: materialized[materialized.length - 1]!.draft_id,
        })
      : undefined;

    return { items, nextCursor };
  }

  listCleanupCandidates(profileId: string, states: DraftState[], olderThanIso: string): DraftRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM drafts
        WHERE profile_id = ?
          AND state IN (${states.map(() => '?').join(',')})
          AND updated_at < ?
      `,
      )
      .all(profileId, ...states, olderThanIso) as DraftRow[];
    return rows.map((row) => mapRowToDraft(row));
  }

  purgeMetadata(profileId: string, nowIso: string): number {
    const deleted = this.db
      .prepare(
        `
        DELETE FROM drafts
        WHERE profile_id = ?
          AND state IN ('committed', 'discarded')
          AND updated_at < datetime(?, '-30 days')
      `,
      )
      .run(profileId, nowIso);
    return Number(deleted.changes ?? 0);
  }

  getRequestFingerprint(profileId: string, draftId: string): string | undefined {
    const row = this.db
      .prepare(`SELECT request_fingerprint FROM drafts WHERE profile_id = ? AND draft_id = ?`)
      .get(profileId, draftId) as { request_fingerprint: string } | undefined;
    return row?.request_fingerprint;
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS drafts (
        profile_id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        note_id INTEGER NOT NULL,
        card_ids_json TEXT NOT NULL,
        state TEXT NOT NULL,
        card_type_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        supersedes_draft_id TEXT,
        chain_depth INTEGER NOT NULL,
        fields_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        deck_name TEXT NOT NULL,
        mod_timestamp INTEGER NOT NULL,
        client_request_id TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        staged_marker_tag TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        committed_at TEXT,
        discarded_at TEXT,
        PRIMARY KEY (profile_id, draft_id),
        UNIQUE (profile_id, client_request_id)
      );

      CREATE INDEX IF NOT EXISTS idx_drafts_profile_state_updated
        ON drafts(profile_id, state, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_drafts_profile_supersedes
        ON drafts(profile_id, supersedes_draft_id);
    `);
  }
}

function mapRowToDraft(row: DraftRow): DraftRecord {
  return {
    draftId: row.draft_id,
    profileId: row.profile_id,
    noteId: row.note_id,
    cardIds: JSON.parse(row.card_ids_json) as number[],
    state: row.state,
    cardTypeId: row.card_type_id,
    fingerprint: row.fingerprint,
    supersedesDraftId: row.supersedes_draft_id ?? undefined,
    chainDepth: row.chain_depth,
    fields: JSON.parse(row.fields_json) as Record<string, string>,
    tags: JSON.parse(row.tags_json) as string[],
    deckName: row.deck_name,
    modTimestamp: row.mod_timestamp,
    clientRequestId: row.client_request_id,
    stagedMarkerTag: row.staged_marker_tag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    committedAt: row.committed_at ?? undefined,
    discardedAt: row.discarded_at ?? undefined,
  };
}

function encodeCursor(value: { updatedAt: string; draftId: string }): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { updatedAt: string; draftId: string } {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
    updatedAt?: string;
    draftId?: string;
  };
  if (!parsed.updatedAt || !parsed.draftId) {
    throw new Error('Invalid cursor');
  }
  return {
    updatedAt: parsed.updatedAt,
    draftId: parsed.draftId,
  };
}
