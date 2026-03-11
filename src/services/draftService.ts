import { randomUUID } from 'node:crypto';
import { AppError, asAppError } from '../contracts/errors.js';
import type { BatchResultSummary, DraftRecord, DraftState, ReviewDecision } from '../contracts/types.js';
import { toCanonicalJson, normalizeTags } from '../utils/canonical.js';
import { sha256 } from '../utils/hash.js';
import { resolveProfileId } from '../utils/profile.js';
import type { AnkiGateway } from '../gateway/ankiGateway.js';
import { DraftStore } from '../persistence/draftStore.js';
import { CatalogService } from './catalogService.js';

type DraftServiceConfig = {
  activeProfileId?: string;
  stagedMarkerTag: string;
};

export class DraftService {
  constructor(
    private readonly store: DraftStore,
    private readonly catalogService: CatalogService,
    private readonly ankiGateway: AnkiGateway,
    private readonly config: DraftServiceConfig,
  ) {}

  async createStagedCard(input: {
    profileId: string;
    clientRequestId: string;
    cardTypeId: string;
    fields: Record<string, string>;
    deckName?: string;
    tags?: string[];
    supersedesDraftId?: string;
  }): Promise<{ contractVersion: '1.0.0'; profileId: string; draft: DraftRecord }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const requestFingerprint = this.computeRequestFingerprint({
      cardTypeId: input.cardTypeId,
      fields: input.fields,
      deckName: input.deckName,
      tags: input.tags ?? [],
      supersedesDraftId: input.supersedesDraftId,
    });

    const existing = this.store.findByClientRequestId(profileId, input.clientRequestId);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new AppError('CONFLICT', 'clientRequestId was reused with a different payload', {
          hint: 'Use a new clientRequestId for changed content.',
          context: { clientRequestId: input.clientRequestId },
        });
      }
      return {
        contractVersion: '1.0.0',
        profileId,
        draft: existing.draft,
      };
    }

    const validation = this.catalogService.validateFields({
      profileId,
      cardTypeId: input.cardTypeId,
      fields: input.fields,
      deckName: input.deckName,
      tags: input.tags,
    });

    if (!validation.valid) {
      throw new AppError('INVALID_ARGUMENT', 'Validation failed before draft creation', {
        context: { errors: validation.errors },
        hint: 'Fix required fields before create_draft.',
      });
    }

    const cardType = this.catalogService.getCardTypeDefinition(profileId, input.cardTypeId);

    let chainDepth = 0;
    if (input.supersedesDraftId) {
      const sourceDraft = this.store.getDraft(profileId, input.supersedesDraftId);
      if (!sourceDraft) {
        const foreignDraft = this.store.findDraftById(input.supersedesDraftId);
        if (foreignDraft && foreignDraft.profileId !== profileId) {
          throw new AppError('PROFILE_SCOPE_MISMATCH', 'supersedesDraftId belongs to a different profile', {
            context: { requestedProfileId: profileId, draftProfileId: foreignDraft.profileId },
          });
        }
      }
      if (!sourceDraft || sourceDraft.state !== 'draft') {
        throw new AppError('INVALID_SUPERSEDE_SOURCE', 'supersedesDraftId must reference an active draft');
      }
      chainDepth = sourceDraft.chainDepth + 1;
      this.store.updateDraftState({
        profileId,
        draftId: sourceDraft.draftId,
        state: 'superseded',
        updatedAt: new Date().toISOString(),
      });
    }

    const mergedTags = normalizeTags([...validation.normalized.tags, this.config.stagedMarkerTag]);

    const created = await this.ankiGateway.createNote({
      deckName: validation.normalized.deckName,
      modelName: cardType.modelName,
      fields: validation.normalized.fields,
      tags: mergedTags,
    });

    await this.ankiGateway.applyStagedIsolation(created.noteId, created.cardIds, this.config.stagedMarkerTag);
    const stagedSnapshot = await this.ankiGateway.getNoteSnapshot(created.noteId);

    const draftId = randomUUID();
    const timestamp = new Date().toISOString();
    const fingerprint = this.computeLiveFingerprint({
      modelName: stagedSnapshot.modelName,
      fields: stagedSnapshot.fields,
      tags: stagedSnapshot.tags,
      profileId,
      noteId: stagedSnapshot.noteId,
      modTimestamp: stagedSnapshot.modTimestamp,
    });

    const draft: DraftRecord = {
      draftId,
      profileId,
      noteId: created.noteId,
      cardIds: created.cardIds,
      state: 'draft',
      cardTypeId: cardType.cardTypeId,
      fingerprint,
      supersedesDraftId: input.supersedesDraftId,
      chainDepth,
      fields: validation.normalized.fields,
      tags: mergedTags,
      deckName: validation.normalized.deckName,
      modTimestamp: stagedSnapshot.modTimestamp,
      clientRequestId: input.clientRequestId,
      draftMarkerTag: this.config.stagedMarkerTag,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.insertDraft(draft, requestFingerprint);
    this.logLifecycleEvent('draft_created', {
      profileId,
      draftId,
      noteId: created.noteId,
      state: draft.state,
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      draft,
    };
  }

  async openStagedCardPreview(input: {
    draftId: string;
    profileId?: string;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    draftId: string;
    preview: { opened: boolean; selectedNoteId: number; selectedCardIds: number[]; browserQuery: string };
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: false,
    });

    const draft = this.store.getDraft(profileId, input.draftId);
    if (!draft) {
      const foreignDraft = this.store.findDraftById(input.draftId);
      if (foreignDraft && foreignDraft.profileId !== profileId) {
        throw new AppError('PROFILE_SCOPE_MISMATCH', 'draftId belongs to a different profile', {
          context: { requestedProfileId: profileId, draftProfileId: foreignDraft.profileId },
        });
      }
      throw new AppError('NOT_FOUND', `Draft not found: ${input.draftId}`);
    }

    const preview = await this.ankiGateway.openBrowserForNote(draft.noteId);

    return {
      contractVersion: '1.0.0',
      profileId,
      draftId: draft.draftId,
      preview: {
        opened: preview.opened,
        selectedNoteId: draft.noteId,
        selectedCardIds: preview.selectedCardIds,
        browserQuery: preview.browserQuery,
      },
    };
  }

  async getStagedCard(input: {
    draftId: string;
    profileId?: string;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    draft: DraftRecord;
    cardType: ReturnType<CatalogService['getCardTypeSummary']>;
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: false,
    });

    const draft = this.requireDraft(profileId, input.draftId);

    return {
      contractVersion: '1.0.0',
      profileId,
      draft,
      cardType: this.catalogService.getCardTypeSummary(profileId, draft.cardTypeId, { allowDeprecated: true }),
    };
  }

  async commitStagedCard(input: {
    profileId: string;
    draftId: string;
    reviewDecision: ReviewDecision;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    result: {
      status: 'committed' | 'already_committed';
      draftId: string;
      noteId: number;
      cardIds: number[];
      committedAt: string;
    };
  }> {
    this.assertReviewDecision(input.reviewDecision);

    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const draft = this.store.getDraft(profileId, input.draftId);
    if (!draft) {
      const foreignDraft = this.store.findDraftById(input.draftId);
      if (foreignDraft && foreignDraft.profileId !== profileId) {
        throw new AppError('PROFILE_SCOPE_MISMATCH', 'draftId belongs to a different profile', {
          context: { requestedProfileId: profileId, draftProfileId: foreignDraft.profileId },
        });
      }
      throw new AppError('NOT_FOUND', `Draft not found: ${input.draftId}`);
    }

    if (draft.state === 'committed') {
      return {
        contractVersion: '1.0.0',
        profileId,
        result: {
          status: 'already_committed',
          draftId: draft.draftId,
          noteId: draft.noteId,
          cardIds: draft.cardIds,
          committedAt: draft.committedAt ?? draft.updatedAt,
        },
      };
    }

    if (draft.state === 'superseded') {
      throw new AppError('CONFLICT', 'Draft is superseded and cannot be committed', {
        hint: 'Commit the latest active draft in the supersede chain.',
      });
    }

    if (draft.state !== 'draft') {
      throw new AppError('INVALID_STATE_TRANSITION', `Cannot commit draft in state: ${draft.state}`);
    }

    const snapshot = await this.ankiGateway.getNoteSnapshot(draft.noteId);
    const liveFingerprint = this.computeLiveFingerprint({
      modelName: snapshot.modelName,
      fields: snapshot.fields,
      tags: snapshot.tags,
      profileId,
      noteId: snapshot.noteId,
      modTimestamp: snapshot.modTimestamp,
    });

    if (liveFingerprint !== draft.fingerprint) {
      throw new AppError('CONFLICT', 'Draft fingerprint mismatch before commit', {
        hint: 'Create a superseding draft using current note content.',
        context: {
          draftId: draft.draftId,
          noteId: draft.noteId,
        },
      });
    }

    await this.ankiGateway.releaseStagedIsolation(draft.noteId, draft.cardIds, draft.draftMarkerTag);

    const committedAt = new Date().toISOString();
    this.store.updateDraftState({
      profileId,
      draftId: draft.draftId,
      state: 'committed',
      updatedAt: committedAt,
      committedAt,
    });
    this.logLifecycleEvent('draft_committed', {
      profileId,
      draftId: draft.draftId,
      noteId: draft.noteId,
      state: 'committed',
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      result: {
        status: 'committed',
        draftId: draft.draftId,
        noteId: draft.noteId,
        cardIds: draft.cardIds,
        committedAt,
      },
    };
  }

  async discardStagedCard(input: {
    profileId: string;
    draftId: string;
    reason?: 'user_request' | 'cleanup' | 'superseded' | 'conflict_recovery';
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    result: {
      status: 'discarded' | 'already_discarded';
      draftId: string;
      discardedAt: string;
      deletedNoteId?: number;
    };
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const draft = this.store.getDraft(profileId, input.draftId);
    if (!draft) {
      const foreignDraft = this.store.findDraftById(input.draftId);
      if (foreignDraft && foreignDraft.profileId !== profileId) {
        throw new AppError('PROFILE_SCOPE_MISMATCH', 'draftId belongs to a different profile', {
          context: { requestedProfileId: profileId, draftProfileId: foreignDraft.profileId },
        });
      }
      throw new AppError('NOT_FOUND', `Draft not found: ${input.draftId}`);
    }

    if (draft.state === 'discarded') {
      return {
        contractVersion: '1.0.0',
        profileId,
        result: {
          status: 'already_discarded',
          draftId: draft.draftId,
          discardedAt: draft.discardedAt ?? draft.updatedAt,
        },
      };
    }

    if (draft.state === 'committed') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Committed draft cannot be discarded');
    }

    await this.ankiGateway.deleteNote(draft.noteId);

    const discardedAt = new Date().toISOString();
    this.store.updateDraftState({
      profileId,
      draftId: draft.draftId,
      state: 'discarded',
      updatedAt: discardedAt,
      discardedAt,
    });
    this.logLifecycleEvent('draft_discarded', {
      profileId,
      draftId: draft.draftId,
      noteId: draft.noteId,
      state: 'discarded',
      reason: input.reason ?? 'user_request',
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      result: {
        status: 'discarded',
        draftId: draft.draftId,
        discardedAt,
        deletedNoteId: draft.noteId,
      },
    };
  }

  listStagedCards(input: {
    profileId?: string;
    states?: DraftState[];
    limit?: number;
    cursor?: string;
  }): {
    contractVersion: '1.0.0';
    profileId: string;
    items: Array<{
      draftId: string;
      noteId: number;
      state: DraftState;
      cardTypeId: string;
      supersedesDraftId?: string;
      chainDepth: number;
      createdAt: string;
      updatedAt: string;
    }>;
    nextCursor?: string;
  } {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: false,
    });

    const result = this.store.listDrafts({
      profileId,
      states: input.states,
      limit: input.limit ?? 50,
      cursor: input.cursor,
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      items: result.items,
      nextCursor: result.nextCursor,
    };
  }

  async cleanupStagedCards(input: {
    profileId: string;
    olderThanHours?: number;
    states?: Array<'draft' | 'superseded'>;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    olderThanHours: number;
    deletedCount: number;
    deletedDraftIds: string[];
    executedAt: string;
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const olderThanHours = input.olderThanHours ?? 72;
    const states = input.states ?? ['draft', 'superseded'];
    const threshold = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
    const candidates = this.store.listCleanupCandidates(profileId, states, threshold);

    const deletedDraftIds: string[] = [];
    for (const candidate of candidates) {
      await this.discardStagedCard({ profileId, draftId: candidate.draftId, reason: 'cleanup' });
      deletedDraftIds.push(candidate.draftId);
    }

    const executedAt = new Date().toISOString();
    this.store.purgeMetadata(profileId, executedAt);
    this.logLifecycleEvent('cleanup_completed', {
      profileId,
      state: 'discarded',
      deletedCount: deletedDraftIds.length,
      olderThanHours,
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      olderThanHours,
      deletedCount: deletedDraftIds.length,
      deletedDraftIds,
      executedAt,
    };
  }

  async createStagedCardsBatch(input: {
    profileId: string;
    items: Array<{
      itemId: string;
      clientRequestId: string;
      cardTypeId: string;
      fields: Record<string, string>;
      deckName?: string;
      tags?: string[];
      supersedesDraftId?: string;
    }>;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    summary: BatchResultSummary;
    results: Array<
      | { itemId: string; ok: true; draft: DraftRecord }
      | { itemId: string; ok: false; error: ReturnType<AppError['toPayload']> }
    >;
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const results: Array<
      | { itemId: string; ok: true; draft: DraftRecord }
      | { itemId: string; ok: false; error: ReturnType<AppError['toPayload']> }
    > = [];

    for (const item of input.items) {
      try {
        const created = await this.createStagedCard({
          profileId,
          clientRequestId: item.clientRequestId,
          cardTypeId: item.cardTypeId,
          fields: item.fields,
          deckName: item.deckName,
          tags: item.tags,
          supersedesDraftId: item.supersedesDraftId,
        });
        results.push({ itemId: item.itemId, ok: true, draft: created.draft });
      } catch (error) {
        results.push({ itemId: item.itemId, ok: false, error: asAppError(error).toPayload() });
      }
    }

    return {
      contractVersion: '1.0.0',
      profileId,
      summary: summarizeBatch(results),
      results,
    };
  }

  async commitStagedCardsBatch(input: {
    profileId: string;
    items: Array<{
      itemId: string;
      draftId: string;
      reviewDecision: ReviewDecision;
    }>;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    summary: BatchResultSummary;
    results: Array<
      | {
          itemId: string;
          ok: true;
          result: {
            status: 'committed' | 'already_committed';
            draftId: string;
            noteId: number;
            cardIds: number[];
            committedAt: string;
          };
        }
      | { itemId: string; ok: false; error: ReturnType<AppError['toPayload']> }
    >;
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const results: Array<
      | {
          itemId: string;
          ok: true;
          result: {
            status: 'committed' | 'already_committed';
            draftId: string;
            noteId: number;
            cardIds: number[];
            committedAt: string;
          };
        }
      | { itemId: string; ok: false; error: ReturnType<AppError['toPayload']> }
    > = [];

    for (const item of input.items) {
      try {
        const committed = await this.commitStagedCard({
          profileId,
          draftId: item.draftId,
          reviewDecision: item.reviewDecision,
        });
        results.push({ itemId: item.itemId, ok: true, result: committed.result });
      } catch (error) {
        results.push({ itemId: item.itemId, ok: false, error: asAppError(error).toPayload() });
      }
    }

    return {
      contractVersion: '1.0.0',
      profileId,
      summary: summarizeBatch(results),
      results,
    };
  }

  async discardStagedCardsBatch(input: {
    profileId: string;
    items: Array<{
      itemId: string;
      draftId: string;
      reason?: 'user_request' | 'cleanup' | 'superseded' | 'conflict_recovery';
    }>;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    summary: BatchResultSummary;
    results: Array<
      | {
          itemId: string;
          ok: true;
          result: {
            status: 'discarded' | 'already_discarded';
            draftId: string;
            discardedAt: string;
            deletedNoteId?: number;
          };
        }
      | { itemId: string; ok: false; error: ReturnType<AppError['toPayload']> }
    >;
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const results: Array<
      | {
          itemId: string;
          ok: true;
          result: {
            status: 'discarded' | 'already_discarded';
            draftId: string;
            discardedAt: string;
            deletedNoteId?: number;
          };
        }
      | { itemId: string; ok: false; error: ReturnType<AppError['toPayload']> }
    > = [];

    for (const item of input.items) {
      try {
        const discarded = await this.discardStagedCard({
          profileId,
          draftId: item.draftId,
          reason: item.reason,
        });
        results.push({ itemId: item.itemId, ok: true, result: discarded.result });
      } catch (error) {
        results.push({ itemId: item.itemId, ok: false, error: asAppError(error).toPayload() });
      }
    }

    return {
      contractVersion: '1.0.0',
      profileId,
      summary: summarizeBatch(results),
      results,
    };
  }

  getCatalogResourcePayload() {
    return {
      contractVersion: '1.0.0',
      ...this.catalogService.listCardTypes(this.config.activeProfileId ?? 'default'),
    };
  }

  private computeRequestFingerprint(input: {
    cardTypeId: string;
    fields: Record<string, string>;
    deckName?: string;
    tags: string[];
    supersedesDraftId?: string;
  }): string {
    return sha256(
      toCanonicalJson({
        cardTypeId: input.cardTypeId,
        fields: input.fields,
        deckName: input.deckName,
        sortedTags: normalizeTags(input.tags),
        supersedesDraftId: input.supersedesDraftId,
      }),
    );
  }

  private computeLiveFingerprint(input: {
    modelName: string;
    fields: Record<string, string>;
    tags: string[];
    profileId: string;
    noteId: number;
    modTimestamp: number;
  }): string {
    return sha256(
      toCanonicalJson({
        modelName: input.modelName,
        fields: input.fields,
        sortedTags: normalizeTags(input.tags),
        profileId: input.profileId,
        noteId: input.noteId,
        modTimestamp: input.modTimestamp,
      }),
    );
  }

  private assertReviewDecision(reviewDecision: ReviewDecision): void {
    if (!reviewDecision.targetIdentityMatched || !reviewDecision.questionConfirmed || !reviewDecision.answerConfirmed) {
      throw new AppError('INVALID_ARGUMENT', 'All review checklist fields must be true before commit', {
        hint: 'Complete preview confirmation and retry commit.',
      });
    }
  }

  private requireDraft(profileId: string, draftId: string): DraftRecord {
    const draft = this.store.getDraft(profileId, draftId);
    if (!draft) {
      const foreignDraft = this.store.findDraftById(draftId);
      if (foreignDraft && foreignDraft.profileId !== profileId) {
        throw new AppError('PROFILE_SCOPE_MISMATCH', 'draftId belongs to a different profile', {
          context: { requestedProfileId: profileId, draftProfileId: foreignDraft.profileId },
        });
      }
      throw new AppError('NOT_FOUND', `Draft not found: ${draftId}`);
    }
    return draft;
  }

  private logLifecycleEvent(event: string, context: Record<string, unknown>): void {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ...context,
    };
    console.error(JSON.stringify(payload));
  }
}

function summarizeBatch(results: Array<{ ok: boolean }>): BatchResultSummary {
  const succeeded = results.filter((item) => item.ok).length;
  return {
    succeeded,
    failed: results.length - succeeded,
  };
}
