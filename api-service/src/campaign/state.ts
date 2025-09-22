import type {
  CampaignState,
  CompleteQuestResult,
  DomainResult,
  DropItemResult,
  GrantItemInput,
  GrantItemResult,
  LoreEntry,
  ItemInput,
  PlayerState,
  QuestUpdateInput,
  SerializedPlayer,
  SerializedQuest,
  StartQuestResult,
  StatsUpdateInput,
  UseItemResult,
  LoreInput,
  NpcInput,
  NpcProfile,
  WorldItemTemplate,
} from './types';
import { clampStat } from './utils';
export type {
  CampaignState,
  CompleteQuestResult,
  DomainResult,
  DropItemResult,
  GrantItemInput,
  GrantItemResult,
  LoreEntry,
  ItemInput,
  PlayerState,
  QuestUpdateInput,
  SerializedPlayer,
  SerializedQuest,
  StartQuestResult,
  StatsUpdateInput,
  UseItemResult,
  LoreInput,
  NpcInput,
  NpcProfile,
  WorldItemTemplate,
} from './types';
import {
  createQuestState,
  generateQuestStates,
  getMoodPrompts,
  selectStoryArc,
} from '../domains/story/data';
import { createPlayerItemFromTemplate, seedPlayers } from '../domains/players/data';
import {
  buildLoreEntries,
  describeItemUse,
  generateNpcRoster,
  selectWorldSetting,
  worldItemTemplates,
} from '../domains/world/data';
import { randomUUID } from 'crypto';

export function createCampaignState(): CampaignState {
  const storyArc = selectStoryArc();
  const questBoard = generateQuestStates(5);
  const worldSetting = selectWorldSetting();
  const npcRoster = generateNpcRoster(5);
  const itemManifest = [...worldItemTemplates];
  const loreEntries = buildLoreEntries(worldSetting);

  const players = seedPlayers(itemManifest);

  return {
    storyArc,
    questBoard,
    players,
    world: {
      currentSetting: worldSetting,
      loreEntries,
      npcRoster,
      itemManifest,
    },
  };
}

export function getStoryOverview(campaign: CampaignState) {
  return {
    arc: campaign.storyArc,
    questBoard: {
      available: campaign.questBoard.filter((quest) => quest.status === 'available').map(serializeQuest),
      active: campaign.questBoard.filter((quest) => quest.status === 'active').map(serializeQuest),
      completed: campaign.questBoard.filter((quest) => quest.status === 'completed').map(serializeQuest),
    },
    moodPrompts: getMoodPrompts(3),
  };
}

export function listQuests(campaign: CampaignState) {
  return campaign.questBoard.map(serializeQuest);
}

export function updateQuest(
  campaign: CampaignState,
  questId: string,
  input: QuestUpdateInput,
): DomainResult<{ quest: SerializedQuest }> {
  const quest = getQuestById(campaign, questId);
  if (!quest) {
    return domainError(404, `Quest ${questId} does not exist.`);
  }

  let mutated = false;

  if (isNonEmptyString(input.title)) {
    quest.title = input.title.trim();
    mutated = true;
  }

  if (isNonEmptyString(input.objective)) {
    quest.objective = input.objective.trim();
    mutated = true;
  }

  if (isNonEmptyString(input.primaryLocation)) {
    quest.primaryLocation = input.primaryLocation.trim();
    mutated = true;
  }

  if (typeof input.reward === 'string') {
    const reward = input.reward.trim();
    if (reward.length > 0) {
      quest.reward = reward;
      mutated = true;
    }
  }

  if (Array.isArray(input.suggestedChallenges)) {
    const cleaned = input.suggestedChallenges
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    quest.suggestedChallenges = cleaned;
    mutated = true;
  }

  if (!mutated) {
    return domainError(400, 'Provide at least one quest field to update.');
  }

  return {
    ok: true,
    data: {
      quest: serializeQuest(quest),
    },
  };
}

export function startQuest(
  campaign: CampaignState,
  questId: string,
  playerId: string,
): DomainResult<StartQuestResult> {
  if (!playerId) {
    return domainError(400, 'playerId is required to start a quest.');
  }

  const quest = getQuestById(campaign, questId);
  if (!quest) {
    return domainError(404, `Quest ${questId} does not exist.`);
  }

  if (quest.status !== 'available') {
    return domainError(409, `Quest ${quest.title} is not available.`);
  }

  const player = campaign.players.get(playerId);
  if (!player) {
    return domainError(404, `Player ${playerId} is not tracked by the party.`);
  }

  if (player.currentQuestId) {
    return domainError(409, `${player.alias} already has an active quest.`);
  }

  quest.status = 'active';
  quest.assignedTo = playerId;
  quest.startedAt = new Date().toISOString();
  player.currentQuestId = questId;
  player.status = 'active-duty';

  return {
    ok: true,
    data: {
      quest: serializeQuest(quest),
      player: serializePlayer(campaign, player),
      narration: `${player.alias} accepts "${quest.title}" and prepares to depart for ${quest.primaryLocation}.`,
    },
  };
}

export function completeQuest(
  campaign: CampaignState,
  questId: string,
  playerId: string,
  resolutionNote?: string,
): DomainResult<CompleteQuestResult> {
  if (!playerId) {
    return domainError(400, 'playerId is required to complete a quest.');
  }

  const quest = getQuestById(campaign, questId);
  if (!quest) {
    return domainError(404, `Quest ${questId} does not exist.`);
  }

  if (quest.status !== 'active' || quest.assignedTo !== playerId) {
    return domainError(409, `Quest ${quest.title} is not active for player ${playerId}.`);
  }

  const player = campaign.players.get(playerId);
  if (!player) {
    return domainError(404, `Player ${playerId} is not tracked by the party.`);
  }

  quest.status = 'completed';
  quest.completedAt = new Date().toISOString();
  player.completedQuestIds.push(questId);
  player.currentQuestId = undefined;
  player.status = 'on-short-rest';

  if (resolutionNote) {
    quest.reward = `${quest.reward} | Resolution: ${resolutionNote}`;
  }

  ensureQuestBoardHasAvailableOptions(campaign);

  return {
    ok: true,
    data: {
      quest: serializeQuest(quest),
      player: serializePlayer(campaign, player),
      narration: `${player.alias} reports back victorious. The party earns ${quest.reward}.`,
    },
  };
}

export function listPlayers(campaign: CampaignState): SerializedPlayer[] {
  return Array.from(campaign.players.values()).map((player) => serializePlayer(campaign, player));
}

export function getPlayer(
  campaign: CampaignState,
  playerId: string,
): DomainResult<SerializedPlayer> {
  const player = campaign.players.get(playerId);
  if (!player) {
    return domainError(404, `Player ${playerId} is not tracked by the party.`);
  }

  return { ok: true, data: serializePlayer(campaign, player) };
}

export function updatePlayerStats(
  campaign: CampaignState,
  playerId: string,
  input: StatsUpdateInput,
): DomainResult<{ player: SerializedPlayer }> {
  const player = campaign.players.get(playerId);
  if (!player) {
    return domainError(404, `Player ${playerId} is not tracked by the party.`);
  }

  const mode = input.mode ?? 'absolute';
  const stats = input.stats;

  if (!stats || Object.keys(stats).length === 0) {
    return domainError(400, 'Provide at least one stat to update.');
  }

  Object.entries(stats).forEach(([key, value]) => {
    if (!isStatKey(key)) {
      return;
    }

    if (typeof value !== 'number' || Number.isNaN(value)) {
      return;
    }

    if (mode === 'delta') {
      player.stats[key] = clampStat(player.stats[key] + value);
    } else {
      player.stats[key] = clampStat(value);
    }
  });

  player.level = Math.max(1, Math.round(player.level));

  return { ok: true, data: { player: serializePlayer(campaign, player) } };
}

export function grantItem(
  campaign: CampaignState,
  playerId: string,
  input: GrantItemInput,
): DomainResult<GrantItemResult> {
  const player = campaign.players.get(playerId);
  if (!player) {
    return domainError(404, `Player ${playerId} is not tracked by the party.`);
  }

  const template = resolveWorldItemTemplate(campaign, input.templateId ?? input.item?.templateId);
  let newItem = template ? createPlayerItemFromTemplate(template) : createFallbackItem(campaign, input.item);

  player.items.push(newItem);

  return {
    ok: true,
    data: {
      player: serializePlayer(campaign, player),
      grantedItem: newItem,
      narration: `${player.alias} acquires ${newItem.name}.`,
    },
  };
}

export function useItem(
  campaign: CampaignState,
  playerId: string,
  itemId: string,
): DomainResult<UseItemResult> {
  const player = campaign.players.get(playerId);
  if (!player) {
    return domainError(404, `Player ${playerId} is not tracked by the party.`);
  }

  const itemIndex = player.items.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) {
    return domainError(404, `Item ${itemId} does not exist in ${player.alias}'s inventory.`);
  }

  const [item] = player.items.splice(itemIndex, 1);
  const template = resolveWorldItemTemplate(campaign, item.templateId);
  const effect = template?.effect?.trim() && template.effect.trim().length > 0
    ? template.effect.trim()
    : describeItemUse(item.templateId);

  return {
    ok: true,
    data: {
      player: serializePlayer(campaign, player),
      consumedItem: item,
      effect,
      narration: `${player.alias} uses ${item.name}. ${effect}`,
    },
  };
}

export function dropItem(
  campaign: CampaignState,
  playerId: string,
  itemId: string,
): DomainResult<DropItemResult> {
  const player = campaign.players.get(playerId);
  if (!player) {
    return domainError(404, `Player ${playerId} is not tracked by the party.`);
  }

  const itemIndex = player.items.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) {
    return domainError(404, `Item ${itemId} does not exist in ${player.alias}'s inventory.`);
  }

  const [item] = player.items.splice(itemIndex, 1);

  return {
    ok: true,
    data: {
      player: serializePlayer(campaign, player),
      droppedItem: item,
      narration: `${player.alias} drops ${item.name} at the edge of ${campaign.world.currentSetting.name}.`,
    },
  };
}

export function getWorldOverview(campaign: CampaignState) {
  const { currentSetting, npcRoster } = campaign.world;
  return {
    setting: currentSetting,
    highlights: {
      threats: currentSetting.activeThreats,
      magicalPhenomena: currentSetting.magicalPhenomena,
      notableAllies: npcRoster.slice(0, 2),
    },
  };
}

export function listLore(campaign: CampaignState) {
  return campaign.world.loreEntries;
}

export function listNpcs(campaign: CampaignState) {
  return campaign.world.npcRoster;
}

export function listItems(campaign: CampaignState) {
  return campaign.world.itemManifest;
}

export function createLoreEntry(
  campaign: CampaignState,
  input: LoreInput,
): DomainResult<{ lore: LoreEntry }> {
  if (!isNonEmptyString(input.title) || !isNonEmptyString(input.summary) || !isNonEmptyString(input.significance)) {
    return domainError(400, 'title, summary, and significance are required.');
  }

  const entry: LoreEntry = {
    id: `lore-${cryptoUUID()}`,
    title: input.title.trim(),
    summary: input.summary.trim(),
    significance: input.significance.trim(),
  };

  campaign.world.loreEntries.push(entry);

  return { ok: true, data: { lore: entry } };
}

export function createNpc(
  campaign: CampaignState,
  input: NpcInput,
): DomainResult<{ npc: NpcProfile }> {
  if (!validateNpcInput(input)) {
    return domainError(400, 'name, archetype, motivation, relationshipToParty, and voiceNote are required.');
  }

  const npc: NpcProfile = {
    id: `npc-${cryptoUUID()}`,
    name: input.name.trim(),
    archetype: input.archetype.trim(),
    motivation: input.motivation.trim(),
    relationshipToParty: input.relationshipToParty.trim(),
    voiceNote: input.voiceNote.trim(),
  };

  campaign.world.npcRoster.push(npc);

  return { ok: true, data: { npc } };
}

export function createWorldItem(
  campaign: CampaignState,
  input: ItemInput,
): DomainResult<{ item: WorldItemTemplate }> {
  if (!validateItemInput(input)) {
    return domainError(400, 'name, type, rarity, attunementRequired, description, and origin are required.');
  }

  const templateId = input.templateId?.trim() && input.templateId.trim().length > 0
    ? input.templateId.trim()
    : `item-${cryptoUUID()}`;

  const item: WorldItemTemplate = {
    templateId,
    name: input.name.trim(),
    type: input.type.trim(),
    rarity: input.rarity,
    attunementRequired: input.attunementRequired,
    description: input.description.trim(),
    origin: input.origin.trim(),
    effect: input.effect?.trim() && input.effect.trim().length > 0 ? input.effect.trim() : undefined,
  };

  campaign.world.itemManifest.push(item);

  return { ok: true, data: { item } };
}

function createFallbackItem(
  campaign: CampaignState,
  itemOverrides: GrantItemInput['item'],
) {
  const template = pickWorldTemplate(campaign.world.itemManifest);
  let item = createPlayerItemFromTemplate(template);

  if (itemOverrides) {
    item = {
      ...item,
      name: typeof itemOverrides.name === 'string' ? itemOverrides.name : item.name,
      type: typeof itemOverrides.type === 'string' ? itemOverrides.type : item.type,
      rarity: typeof itemOverrides.rarity === 'string' ? (itemOverrides.rarity as WorldItemTemplate['rarity']) : item.rarity,
      attunementRequired:
        typeof itemOverrides.attunementRequired === 'boolean'
          ? itemOverrides.attunementRequired
          : item.attunementRequired,
      description:
        typeof itemOverrides.description === 'string' ? itemOverrides.description : item.description,
      effect:
        typeof itemOverrides.effect === 'string' && itemOverrides.effect.trim().length > 0
          ? itemOverrides.effect.trim()
          : item.effect,
    };
  }

  return item;
}

function ensureQuestBoardHasAvailableOptions(campaign: CampaignState) {
  const availableCount = campaign.questBoard.filter((quest) => quest.status === 'available').length;
  if (availableCount < 3) {
    campaign.questBoard.push(createQuestState());
  }
}

function getQuestById(campaign: CampaignState, questId: string) {
  return campaign.questBoard.find((quest) => quest.id === questId);
}

function serializeQuest(quest: CampaignState['questBoard'][number]): SerializedQuest {
  return {
    id: quest.id,
    title: quest.title,
    status: quest.status,
    objective: quest.objective,
    primaryLocation: quest.primaryLocation,
    suggestedChallenges: quest.suggestedChallenges,
    reward: quest.reward,
    assignedTo: quest.assignedTo,
    startedAt: quest.startedAt,
    completedAt: quest.completedAt,
  };
}

function serializePlayer(campaign: CampaignState, player: PlayerState): SerializedPlayer {
  const activeQuest = player.currentQuestId ? getQuestById(campaign, player.currentQuestId) : undefined;

  return {
    id: player.id,
    alias: player.alias,
    class: player.class,
    background: player.background,
    level: player.level,
    stats: player.stats,
    items: player.items,
    status: player.status,
    currentQuest: activeQuest ? serializeQuest(activeQuest) : null,
    completedQuestIds: player.completedQuestIds,
  };
}

function resolveWorldItemTemplate(campaign: CampaignState, templateId?: string) {
  if (!templateId) {
    return undefined;
  }

  return campaign.world.itemManifest.find((template) => template.templateId === templateId);
}

function pickWorldTemplate(manifest: WorldItemTemplate[]) {
  if (manifest.length === 0) {
    throw new Error('World item manifest is empty.');
  }
  return manifest[Math.floor(Math.random() * manifest.length)];
}

function isStatKey(value: string): value is keyof PlayerState['stats'] {
  return ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateNpcInput(input: NpcInput): boolean {
  return (
    isNonEmptyString(input.name) &&
    isNonEmptyString(input.archetype) &&
    isNonEmptyString(input.motivation) &&
    isNonEmptyString(input.relationshipToParty) &&
    isNonEmptyString(input.voiceNote)
  );
}

function validateItemInput(input: ItemInput): boolean {
  return (
    isNonEmptyString(input.name) &&
    isNonEmptyString(input.type) &&
    typeof input.rarity === 'string' &&
    typeof input.attunementRequired === 'boolean' &&
    isNonEmptyString(input.description) &&
    isNonEmptyString(input.origin) &&
    (input.effect === undefined || isNonEmptyString(input.effect))
  );
}

function cryptoUUID() {
  return randomUUID().slice(0, 8);
}

function domainError(status: number, message: string): DomainResult<never> {
  return { ok: false, status, message };
}
