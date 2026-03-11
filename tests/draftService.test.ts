import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { CatalogService } from '../src/services/catalogService.js';
import { DraftStore } from '../src/persistence/draftStore.js';
import { MemoryGateway } from '../src/gateway/memoryGateway.js';
import { DraftService } from '../src/services/draftService.js';
import { AppError } from '../src/contracts/errors.js';

const dbPath = resolve(process.cwd(), '.data/test-drafts.sqlite');

afterEach(() => {
  try {
    rmSync(dbPath, { force: true });
  } catch {
    // ignore
  }
});

function createService() {
  const store = new DraftStore(dbPath);
  const gateway = new MemoryGateway();
  const service = new DraftService(store, new CatalogService(store), gateway, {
    activeProfileId: 'default',
    stagedMarkerTag: '__mcp_staged',
  });
  return { service, store, gateway };
}

describe('DraftService', () => {
  it('creates draft and reuses same draft for idempotent retries', async () => {
    const { service, store } = createService();

    const first = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-1',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'hello', Back: 'こんにちは' },
    });

    const second = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-1',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'hello', Back: 'こんにちは' },
    });

    expect(second.draft.draftId).toBe(first.draft.draftId);
    expect(store.getDraft('default', first.draft.draftId)?.state).toBe('draft');

    store.close();
  });

  it('rejects idempotency key reuse with changed payload', async () => {
    const { service, store } = createService();

    await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-2',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'hello', Back: 'a' },
    });

    await expect(
      service.createStagedCard({
        profileId: 'default',
        clientRequestId: 'req-2',
        cardTypeId: 'language.v1.basic-bilingual',
        fields: { Front: 'hello', Back: 'b' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    store.close();
  });

  it('commits a draft and is idempotent on second commit', async () => {
    const { service, store } = createService();
    const draft = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-3',
      cardTypeId: 'programming.v1.concept-qa',
      fields: { Front: 'What is idempotency?', Back: 'Safe retry behavior' },
    });

    const firstCommit = await service.commitStagedCard({
      profileId: 'default',
      draftId: draft.draft.draftId,
      reviewDecision: {
        targetIdentityMatched: true,
        questionConfirmed: true,
        answerConfirmed: true,
        reviewedAt: new Date().toISOString(),
        reviewer: 'user',
      },
    });

    const secondCommit = await service.commitStagedCard({
      profileId: 'default',
      draftId: draft.draft.draftId,
      reviewDecision: {
        targetIdentityMatched: true,
        questionConfirmed: true,
        answerConfirmed: true,
        reviewedAt: new Date().toISOString(),
        reviewer: 'user',
      },
    });

    expect(firstCommit.result.status).toBe('committed');
    expect(secondCommit.result.status).toBe('already_committed');
    store.close();
  });

  it('detects conflict when note changes before commit', async () => {
    const { service, store, gateway } = createService();
    const draft = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-4',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    gateway.mutateNote(draft.draft.noteId, (note) => {
      note.fields.Back = 'changed';
    });

    await expect(
      service.commitStagedCard({
        profileId: 'default',
        draftId: draft.draft.draftId,
        reviewDecision: {
          targetIdentityMatched: true,
          questionConfirmed: true,
          answerConfirmed: true,
          reviewedAt: new Date().toISOString(),
          reviewer: 'user',
        },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    store.close();
  });

  it('rejects missing checklist confirmation', async () => {
    const { service, store } = createService();
    const draft = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-5',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    let error: unknown;
    try {
      await service.commitStagedCard({
        profileId: 'default',
        draftId: draft.draft.draftId,
        reviewDecision: {
          targetIdentityMatched: false,
          questionConfirmed: true,
          answerConfirmed: true,
          reviewedAt: new Date().toISOString(),
          reviewer: 'user',
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('INVALID_ARGUMENT');

    store.close();
  });

  it('returns PROFILE_SCOPE_MISMATCH when mutating other profile draft', async () => {
    const { service, store } = createService();
    const draft = await service.createStagedCard({
      profileId: 'profile-a',
      clientRequestId: 'req-6',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    await expect(
      service.commitStagedCard({
        profileId: 'profile-b',
        draftId: draft.draft.draftId,
        reviewDecision: {
          targetIdentityMatched: true,
          questionConfirmed: true,
          answerConfirmed: true,
          reviewedAt: new Date().toISOString(),
          reviewer: 'user',
        },
      }),
    ).rejects.toMatchObject({ code: 'PROFILE_SCOPE_MISMATCH' });

    store.close();
  });

  it('supersedes previous draft and blocks direct commit of superseded one', async () => {
    const { service, store } = createService();
    const first = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-7a',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'first', Back: 'first' },
    });

    const second = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-7b',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'second', Back: 'second' },
      supersedesDraftId: first.draft.draftId,
    });

    await expect(
      service.commitStagedCard({
        profileId: 'default',
        draftId: first.draft.draftId,
        reviewDecision: {
          targetIdentityMatched: true,
          questionConfirmed: true,
          answerConfirmed: true,
          reviewedAt: new Date().toISOString(),
          reviewer: 'user',
        },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const committed = await service.commitStagedCard({
      profileId: 'default',
      draftId: second.draft.draftId,
      reviewDecision: {
        targetIdentityMatched: true,
        questionConfirmed: true,
        answerConfirmed: true,
        reviewedAt: new Date().toISOString(),
        reviewer: 'user',
      },
    });

    expect(committed.result.status).toBe('committed');
    store.close();
  });

  it('cleans up stale drafts with default 72h threshold', async () => {
    const { service, store } = createService();
    const draft = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-8',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    store.updateDraftState({
      profileId: 'default',
      draftId: draft.draft.draftId,
      state: 'draft',
      updatedAt: new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(),
    });

    const cleaned = await service.cleanupStagedCards({ profileId: 'default' });
    expect(cleaned.olderThanHours).toBe(72);
    expect(cleaned.deletedDraftIds).toContain(draft.draft.draftId);

    store.close();
  });

  it('returns already_discarded on second discard and rejects discarding committed drafts', async () => {
    const { service, store } = createService();
    const draft = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-9',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    const firstDiscard = await service.discardStagedCard({
      profileId: 'default',
      draftId: draft.draft.draftId,
    });
    const secondDiscard = await service.discardStagedCard({
      profileId: 'default',
      draftId: draft.draft.draftId,
    });

    expect(firstDiscard.result.status).toBe('discarded');
    expect(secondDiscard.result.status).toBe('already_discarded');

    const committed = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-10',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'commit', Back: 'me' },
    });

    await service.commitStagedCard({
      profileId: 'default',
      draftId: committed.draft.draftId,
      reviewDecision: {
        targetIdentityMatched: true,
        questionConfirmed: true,
        answerConfirmed: true,
        reviewedAt: new Date().toISOString(),
        reviewer: 'user',
      },
    });

    await expect(
      service.discardStagedCard({
        profileId: 'default',
        draftId: committed.draft.draftId,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });

    store.close();
  });

  it('rejects invalid supersede sources and profile-mismatched supersede chains', async () => {
    const { service, store } = createService();
    const original = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-11a',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'first', Back: 'first' },
    });

    await service.discardStagedCard({
      profileId: 'default',
      draftId: original.draft.draftId,
    });

    await expect(
      service.createStagedCard({
        profileId: 'default',
        clientRequestId: 'req-11b',
        cardTypeId: 'language.v1.basic-bilingual',
        fields: { Front: 'second', Back: 'second' },
        supersedesDraftId: original.draft.draftId,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SUPERSEDE_SOURCE' });

    const foreign = await service.createStagedCard({
      profileId: 'profile-a',
      clientRequestId: 'req-11c',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'foreign', Back: 'foreign' },
    });

    await expect(
      service.createStagedCard({
        profileId: 'profile-b',
        clientRequestId: 'req-11d',
        cardTypeId: 'language.v1.basic-bilingual',
        fields: { Front: 'local', Back: 'local' },
        supersedesDraftId: foreign.draft.draftId,
      }),
    ).rejects.toMatchObject({ code: 'PROFILE_SCOPE_MISMATCH' });

    store.close();
  });

  it('creates draft from a custom card type definition', async () => {
    const store = new DraftStore(dbPath);
    const gateway = new MemoryGateway();

    const catalog = new CatalogService(store);
    catalog.upsertCustomCardTypeDefinition('default', {
      cardTypeId: 'programming.v1.ts-concept',
      label: 'TypeScript Concept',
      modelName: 'ts.v1.concept',
      defaultDeck: 'Programming::TypeScript::Concept',
      source: 'custom',
      requiredFields: ['Prompt', 'Answer'],
      optionalFields: ['DetailedExplanation'],
      renderIntent: 'production',
      allowedHtmlPolicy: 'safe_inline_html',
      fields: [
        { name: 'Prompt', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
        { name: 'Answer', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
        { name: 'DetailedExplanation', required: false, type: 'markdown', allowedHtmlPolicy: 'safe_inline_html', multiline: true },
      ],
    });

    const customService = new DraftService(store, catalog, gateway, {
      activeProfileId: 'default',
      stagedMarkerTag: '__mcp_staged',
    });

    const draft = await customService.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-custom-1',
      cardTypeId: 'programming.v1.ts-concept',
      fields: {
        Prompt: 'any と unknown の違いは？',
        Answer: 'unknown は絞り込みが必要。',
        DetailedExplanation: '詳細',
      },
    });

    expect(draft.draft.cardTypeId).toBe('programming.v1.ts-concept');
    expect(draft.draft.deckName).toBe('Programming::TypeScript::Concept');
    expect(draft.draft.fields.Prompt).toBe('any と unknown の違いは？');

    store.close();
  });

  it('returns stored draft details and blocks cross-profile inspection', async () => {
    const { service, store } = createService();
    const draft = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-12',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'hello', Back: 'こんにちは' },
      tags: ['lesson-1'],
    });

    const detail = await service.getStagedCard({
      profileId: 'default',
      draftId: draft.draft.draftId,
    });

    expect(detail.draft.draftId).toBe(draft.draft.draftId);
    expect(detail.draft.fields.Front).toBe('hello');
    expect(detail.cardType.cardTypeId).toBe('language.v1.basic-bilingual');

    await expect(
      service.getStagedCard({
        profileId: 'other-profile',
        draftId: draft.draft.draftId,
      }),
    ).rejects.toMatchObject({ code: 'PROFILE_SCOPE_MISMATCH' });

    store.close();
  });

  it('creates drafts in batch with mixed outcomes', async () => {
    const { service, store } = createService();

    const batch = await service.createStagedCardsBatch({
      profileId: 'default',
      items: [
        {
          itemId: 'ok-1',
          clientRequestId: 'req-batch-1',
          cardTypeId: 'language.v1.basic-bilingual',
          fields: { Front: 'a', Back: 'b' },
        },
        {
          itemId: 'bad-1',
          clientRequestId: 'req-batch-2',
          cardTypeId: 'language.v1.basic-bilingual',
          fields: { Front: 'missing-back' },
        },
      ],
    });

    expect(batch.summary.succeeded).toBe(1);
    expect(batch.summary.failed).toBe(1);
    expect(batch.results[0]).toMatchObject({ itemId: 'ok-1', ok: true });
    expect(batch.results[1]).toMatchObject({
      itemId: 'bad-1',
      ok: false,
      error: { code: 'INVALID_ARGUMENT' },
    });

    store.close();
  });

  it('commits and discards drafts in batch with per-item semantics', async () => {
    const { service, store } = createService();
    const first = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-batch-3',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'a', Back: 'b' },
    });
    const second = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-batch-4',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'c', Back: 'd' },
    });

    const committed = await service.commitStagedCardsBatch({
      profileId: 'default',
      items: [
        {
          itemId: 'commit-ok',
          draftId: first.draft.draftId,
          reviewDecision: {
            targetIdentityMatched: true,
            questionConfirmed: true,
            answerConfirmed: true,
            reviewedAt: new Date().toISOString(),
            reviewer: 'user',
          },
        },
        {
          itemId: 'commit-bad',
          draftId: second.draft.draftId,
          reviewDecision: {
            targetIdentityMatched: false,
            questionConfirmed: true,
            answerConfirmed: true,
            reviewedAt: new Date().toISOString(),
            reviewer: 'user',
          },
        },
      ],
    });

    expect(committed.summary.succeeded).toBe(1);
    expect(committed.summary.failed).toBe(1);
    expect(committed.results[1]).toMatchObject({
      itemId: 'commit-bad',
      ok: false,
      error: { code: 'INVALID_ARGUMENT' },
    });

    const discarded = await service.discardStagedCardsBatch({
      profileId: 'default',
      items: [
        { itemId: 'discard-ok', draftId: second.draft.draftId, reason: 'user_request' },
        { itemId: 'discard-again', draftId: second.draft.draftId, reason: 'user_request' },
      ],
    });

    expect(discarded.summary.succeeded).toBe(2);
    expect(discarded.results[0]).toMatchObject({
      itemId: 'discard-ok',
      ok: true,
      result: { status: 'discarded' },
    });
    expect(discarded.results[1]).toMatchObject({
      itemId: 'discard-again',
      ok: true,
      result: { status: 'already_discarded' },
    });

    store.close();
  });

  it('rejects deprecated custom card type definitions during draft creation', async () => {
    const store = new DraftStore(dbPath);
    const gateway = new MemoryGateway();
    const catalog = new CatalogService(store);

    catalog.upsertCustomCardTypeDefinition('default', {
      cardTypeId: 'programming.v1.ts-debug',
      label: 'TypeScript Debug',
      modelName: 'ts.v1.debug',
      defaultDeck: 'Programming::TypeScript::Debug',
      source: 'custom',
      requiredFields: ['BuggyCode', 'Fix'],
      optionalFields: [],
      renderIntent: 'production',
      allowedHtmlPolicy: 'safe_inline_html',
      fields: [
        { name: 'BuggyCode', required: true, type: 'markdown', allowedHtmlPolicy: 'safe_inline_html' },
        { name: 'Fix', required: true, type: 'markdown', allowedHtmlPolicy: 'safe_inline_html' },
      ],
    });
    catalog.deprecateCardTypeDefinition('default', 'programming.v1.ts-debug');

    const customService = new DraftService(store, catalog, gateway, {
      activeProfileId: 'default',
      stagedMarkerTag: '__mcp_staged',
    });

    await expect(
      customService.createStagedCard({
        profileId: 'default',
        clientRequestId: 'req-deprecated-1',
        cardTypeId: 'programming.v1.ts-debug',
        fields: { BuggyCode: 'x', Fix: 'y' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    store.close();
  });
});
