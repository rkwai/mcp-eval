import { getJson, postJson } from '../client/api';
import {
  PlayerProfile,
  QuestListResponse,
  QuestSummary,
  StoryOverview,
  StoryQuestMutationResponse,
} from '../types';

interface BeginQuestArgs {
  playerId: string;
  questId?: string;
}

interface CompleteQuestArgs {
  playerId: string;
  questId?: string;
  resolutionNote?: string;
}

export async function listBoard() {
  return getJson<StoryOverview>('/story');
}

export async function listQuests() {
  return getJson<QuestListResponse>('/story/quests');
}

export async function beginQuest(args: BeginQuestArgs) {
  const questId = args.questId ?? (await pickFirstAvailableQuestId());
  if (!questId) {
    throw new Error('No available quest to start.');
  }

  return postJson<StoryQuestMutationResponse>(`/story/quests/${questId}/start`, {
    playerId: args.playerId,
  });
}

export async function completeQuest(args: CompleteQuestArgs) {
  const questId = args.questId ?? (await resolveActiveQuestId(args.playerId));
  if (!questId) {
    throw new Error(`Player ${args.playerId} does not have an active quest.`);
  }

  return postJson<StoryQuestMutationResponse>(`/story/quests/${questId}/complete`, {
    playerId: args.playerId,
    resolutionNote: args.resolutionNote,
  });
}

async function pickFirstAvailableQuestId(): Promise<string | undefined> {
  const { quests } = await listQuests();
  return quests.find((quest) => quest.status === 'available')?.id;
}

async function resolveActiveQuestId(playerId: string): Promise<string | undefined> {
  const player = await getJson<PlayerProfile>(`/players/${playerId}`);
  return player.currentQuest?.id;
}

export async function ensureQuestById(questId: string): Promise<QuestSummary> {
  const { quests } = await listQuests();
  const quest = quests.find((entry) => entry.id === questId);
  if (!quest) {
    throw new Error(`Quest ${questId} does not exist in the current ledger.`);
  }
  return quest;
}
