import { localDayKey } from './economy';
import { DailyQuestDef } from '../data/quests';

export interface DailyQuestState {
  day: string;
  progress: Record<string, number>;
  claimed: string[];
}

export function createDailyQuestState(now: number): DailyQuestState {
  return { day: localDayKey(now), progress: {}, claimed: [] };
}

/** Returns `state` with progress/claims cleared if local midnight has passed. */
export function resetDailyQuestsIfNewDay(state: DailyQuestState, now: number): DailyQuestState {
  const today = localDayKey(now);
  if (today === state.day) return state;
  return { day: today, progress: {}, claimed: [] };
}

export function incrementQuestProgress(state: DailyQuestState, questId: string, amount = 1): DailyQuestState {
  return { ...state, progress: { ...state.progress, [questId]: (state.progress[questId] ?? 0) + amount } };
}

export function isQuestComplete(state: DailyQuestState, quest: DailyQuestDef): boolean {
  return (state.progress[quest.id] ?? 0) >= quest.target;
}

export function isQuestClaimed(state: DailyQuestState, questId: string): boolean {
  return state.claimed.includes(questId);
}

export function claimQuest(state: DailyQuestState, questId: string): DailyQuestState {
  return { ...state, claimed: [...state.claimed, questId] };
}
