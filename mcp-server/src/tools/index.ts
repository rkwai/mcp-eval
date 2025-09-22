import * as storyTools from './story';
import * as partyTools from './party';
import * as worldTools from './world';
import * as sessionTools from './session';

export type ToolName =
  | 'story.listBoard'
  | 'story.listQuests'
  | 'story.beginQuest'
  | 'story.completeQuest'
  | 'session.startAdventure'
  | 'session.progressAdventure'
  | 'party.list'
  | 'party.inspect'
  | 'party.adjustStats'
  | 'party.grantItem'
  | 'party.useItem'
  | 'party.dropItem'
  | 'world.overview'
  | 'world.lore'
  | 'world.npcs'
  | 'world.items'
  | 'world.createLore'
  | 'world.createNpc'
  | 'world.createItem';

export type ToolArguments = Record<string, unknown>;
export type ToolRunner = (args: ToolArguments) => Promise<unknown>;

const TOOL_REGISTRY: Record<ToolName, ToolRunner> = {
  'story.listBoard': async () => storyTools.listBoard(),
  'story.listQuests': async () => storyTools.listQuests(),
  'story.beginQuest': async (args) =>
    storyTools.beginQuest({
      playerId: requireString(args.playerId, 'playerId'),
      questId: optionalString(args.questId),
    }),
  'story.completeQuest': async (args) =>
    storyTools.completeQuest({
      playerId: requireString(args.playerId, 'playerId'),
      questId: optionalString(args.questId),
      resolutionNote: optionalString(args.resolutionNote),
    }),
  'session.startAdventure': async (args) =>
    sessionTools.startAdventure({
      playerId: resolvePlayerId(args.playerId),
    }),
  'session.progressAdventure': async (args) =>
    sessionTools.progressAdventure({
      playerId: resolvePlayerId(args.playerId),
      action: requireString(args.action, 'action'),
    }),
  'party.list': async () => partyTools.listParty(),
  'party.inspect': async (args) =>
    partyTools.inspectPlayer({
      playerId: requireString(args.playerId, 'playerId'),
    }),
  'party.adjustStats': async (args) =>
    partyTools.adjustStats({
      playerId: requireString(args.playerId, 'playerId'),
      stats: toNumberRecord(requireRecord(args.stats, 'stats')),
      mode: optionalString(args.mode) as 'absolute' | 'delta' | undefined,
    }),
  'party.grantItem': async (args) =>
    partyTools.grantItemToPlayer({
      playerId: requireString(args.playerId, 'playerId'),
      templateId: optionalString(args.templateId),
      item: optionalRecord(args.item),
    }),
  'party.useItem': async (args) =>
    partyTools.useItem({
      playerId: requireString(args.playerId, 'playerId'),
      itemId: optionalString(args.itemId),
      itemTemplateId: optionalString(args.itemTemplateId),
    }),
  'party.dropItem': async (args) =>
    partyTools.dropItem({
      playerId: requireString(args.playerId, 'playerId'),
      itemId: optionalString(args.itemId),
      itemTemplateId: optionalString(args.itemTemplateId),
    }),
  'world.overview': async () => worldTools.getOverview(),
  'world.lore': async () => worldTools.listLore(),
  'world.npcs': async () => worldTools.listNpcs(),
  'world.items': async () => worldTools.listItems(),
  'world.createLore': async (args) =>
    worldTools.createLore({
      title: requireString(args.title, 'title'),
      summary: requireString(args.summary, 'summary'),
      significance: requireString(args.significance, 'significance'),
    }),
  'world.createNpc': async (args) =>
    worldTools.createNpc({
      name: requireString(args.name, 'name'),
      archetype: requireString(args.archetype, 'archetype'),
      motivation: requireString(args.motivation, 'motivation'),
      relationshipToParty: requireString(args.relationshipToParty, 'relationshipToParty'),
      voiceNote: requireString(args.voiceNote, 'voiceNote'),
    }),
  'world.createItem': async (args) =>
    worldTools.createItem({
      templateId: optionalString(args.templateId),
      name: requireString(args.name, 'name'),
      type: requireString(args.type, 'type'),
      rarity: requireRarity(args.rarity),
      attunementRequired: requireBoolean(args.attunementRequired, 'attunementRequired'),
      description: requireString(args.description, 'description'),
      origin: requireString(args.origin, 'origin'),
      effect: optionalString(args.effect),
    }),
};

export function resolveTool(name: ToolName): ToolRunner {
  const runner = TOOL_REGISTRY[name];
  if (!runner) {
    throw new Error(`Unsupported tool: ${name}`);
  }
  return runner;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Expected ${field} to be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return undefined;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${field} to be an object.`);
  }
  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function toNumberRecord(input: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      result[key] = value;
    }
  }

  if (Object.keys(result).length === 0) {
    throw new Error('Provide at least one numeric stat value.');
  }

  return result;
}

function resolvePlayerId(value: unknown): string {
  if (value === undefined) {
    return 'ember-heart';
  }
  return requireString(value, 'playerId');
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${field} to be a boolean.`);
  }
  return value;
}

function requireRarity(value: unknown): 'common' | 'uncommon' | 'rare' | 'legendary' {
  if (typeof value !== 'string') {
    throw new Error('Expected rarity to be a string.');
  }

  const trimmed = value.trim().toLowerCase();
  const allowed = ['common', 'uncommon', 'rare', 'legendary'] as const;
  if (!allowed.includes(trimmed as typeof allowed[number])) {
    throw new Error(`Unsupported rarity: ${value}`);
  }

  return trimmed as 'common' | 'uncommon' | 'rare' | 'legendary';
}
