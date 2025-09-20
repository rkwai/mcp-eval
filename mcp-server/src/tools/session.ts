import * as storyTools from './story';
import * as partyTools from './party';
import * as worldTools from './world';
import {
  ProgressAdventureResponse,
  QuestSummary,
  StartAdventureResponse,
} from '../types';

interface StartAdventureArgs {
  playerId: string;
}

interface ProgressAdventureArgs {
  playerId: string;
  action: string;
}

export async function startAdventure({ playerId }: StartAdventureArgs): Promise<StartAdventureResponse> {
  const [world, questLedger] = await Promise.all([
    worldTools.getOverview(),
    storyTools.listQuests(),
  ]);

  const availableQuest = questLedger.quests.find((quest) => quest.status === 'available');
  if (!availableQuest) {
    throw new Error('No quests are currently available to start.');
  }

  const begun = await storyTools.beginQuest({ playerId, questId: availableQuest.id });

  return {
    world,
    startingQuest: begun.quest,
    player: begun.player,
    startingLocation: begun.quest.primaryLocation,
    narration: begun.narration,
  };
}

export async function progressAdventure({ playerId, action }: ProgressAdventureArgs): Promise<ProgressAdventureResponse> {
  const trimmedAction = action.trim();
  if (!trimmedAction) {
    throw new Error('action must be a non-empty string.');
  }

  const playerProfile = await partyTools.inspectPlayer({ playerId });
  let activeQuest: QuestSummary | null = playerProfile.currentQuest;

  if (!activeQuest) {
    const questLedger = await storyTools.listQuests();
    const fallbackQuest = questLedger.quests.find((quest) => quest.status === 'available');
    if (!fallbackQuest) {
      throw new Error('No quest is available to progress.');
    }
    const begun = await storyTools.beginQuest({ playerId, questId: fallbackQuest.id });
    activeQuest = begun.quest;
  }

  const resolutionNote = `Player action: ${trimmedAction}.`;
  const completed = await storyTools.completeQuest({
    playerId,
    questId: activeQuest.id,
    resolutionNote,
  });

  const [boardOverview, npcRoster] = await Promise.all([
    storyTools.listBoard(),
    worldTools.listNpcs(),
  ]);

  return {
    quest: completed.quest,
    player: completed.player,
    narration: completed.narration,
    resolutionNote,
    nextQuestBoard: boardOverview.questBoard,
    supportingNpcs: npcRoster.npcs.slice(0, 3),
  };
}
