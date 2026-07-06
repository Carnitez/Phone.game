import { describe, expect, it } from 'vitest';
import {
  claimQuest,
  createDailyQuestState,
  incrementQuestProgress,
  isQuestClaimed,
  isQuestComplete,
  resetDailyQuestsIfNewDay,
} from './quests';
import { DailyQuestDef } from '../data/quests';

const QUEST: DailyQuestDef = { id: 'catch-3', description: 'Catch 3 creatures', target: 3, rewardCoins: 30, rewardGems: 0 };

describe('daily quest state', () => {
  it('starts with zero progress and no claims', () => {
    const state = createDailyQuestState(1000);
    expect(state.progress).toEqual({});
    expect(state.claimed).toEqual([]);
    expect(isQuestComplete(state, QUEST)).toBe(false);
  });

  it('tracks progress toward a quest target', () => {
    let state = createDailyQuestState(1000);
    state = incrementQuestProgress(state, QUEST.id);
    state = incrementQuestProgress(state, QUEST.id);
    expect(isQuestComplete(state, QUEST)).toBe(false);
    state = incrementQuestProgress(state, QUEST.id);
    expect(isQuestComplete(state, QUEST)).toBe(true);
  });

  it('marks a quest claimed and idempotent to check', () => {
    let state = createDailyQuestState(1000);
    expect(isQuestClaimed(state, QUEST.id)).toBe(false);
    state = claimQuest(state, QUEST.id);
    expect(isQuestClaimed(state, QUEST.id)).toBe(true);
  });

  it('resets progress and claims at local midnight', () => {
    let state = createDailyQuestState(1000);
    state = incrementQuestProgress(state, QUEST.id, 3);
    state = claimQuest(state, QUEST.id);

    const sameDay = resetDailyQuestsIfNewDay(state, 1000 + 60 * 1000);
    expect(sameDay).toBe(state);

    const oneDayLaterMs = 1000 + 24 * 60 * 60 * 1000;
    const nextDay = resetDailyQuestsIfNewDay(state, oneDayLaterMs);
    expect(nextDay.progress).toEqual({});
    expect(nextDay.claimed).toEqual([]);
  });
});
