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
  it('creates staged draft and reuses same draft for idempotent retries', async () => {
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
    expect(store.getDraft('default', first.draft.draftId)?.state).toBe('staged');

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

  it('commits a staged draft and is idempotent on second commit', async () => {
    const { service, store } = createService();
    const staged = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-3',
      cardTypeId: 'programming.v1.concept-qa',
      fields: { Front: 'What is idempotency?', Back: 'Safe retry behavior' },
    });

    const firstCommit = await service.commitStagedCard({
      profileId: 'default',
      draftId: staged.draft.draftId,
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
      draftId: staged.draft.draftId,
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
    const staged = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-4',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    gateway.mutateNote(staged.draft.noteId, (note) => {
      note.fields.Back = 'changed';
    });

    await expect(
      service.commitStagedCard({
        profileId: 'default',
        draftId: staged.draft.draftId,
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
    const staged = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-5',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    let error: unknown;
    try {
      await service.commitStagedCard({
        profileId: 'default',
        draftId: staged.draft.draftId,
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
    const staged = await service.createStagedCard({
      profileId: 'profile-a',
      clientRequestId: 'req-6',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    await expect(
      service.commitStagedCard({
        profileId: 'profile-b',
        draftId: staged.draft.draftId,
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

  it('cleans up stale staged drafts with default 72h threshold', async () => {
    const { service, store } = createService();
    const staged = await service.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-8',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: { Front: 'x', Back: 'y' },
    });

    store.updateDraftState({
      profileId: 'default',
      draftId: staged.draft.draftId,
      state: 'staged',
      updatedAt: new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString(),
    });

    const cleaned = await service.cleanupStagedCards({ profileId: 'default' });
    expect(cleaned.olderThanHours).toBe(72);
    expect(cleaned.deletedDraftIds).toContain(staged.draft.draftId);

    store.close();
  });

  it('creates staged draft from a custom card type definition', async () => {
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

    const staged = await customService.createStagedCard({
      profileId: 'default',
      clientRequestId: 'req-custom-1',
      cardTypeId: 'programming.v1.ts-concept',
      fields: {
        Prompt: 'any と unknown の違いは？',
        Answer: 'unknown は絞り込みが必要。',
        DetailedExplanation: '詳細',
      },
    });

    expect(staged.draft.cardTypeId).toBe('programming.v1.ts-concept');
    expect(staged.draft.deckName).toBe('Programming::TypeScript::Concept');
    expect(staged.draft.fields.Prompt).toBe('any と unknown の違いは？');

    store.close();
  });
});
