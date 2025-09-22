import { randomUUID } from 'crypto';
import { PlayerItem, PlayerState, StatKey, StatsMap, WorldItemTemplate } from '../../campaign/types';
import { clampStat, pickOne, sampleMany } from '../../campaign/utils';

interface PlayerBlueprint {
  id: string;
  alias: string;
  class: string;
  background: string;
  baseLevel: number;
  baseStats: StatsMap;
  signatureItem: string;
}

const playerBlueprints: PlayerBlueprint[] = [
  {
    id: 'ember-heart',
    alias: 'Ember Heart',
    class: 'College of Valor Bard',
    background: 'Former court minstrel turned tactical chronicler.',
    baseLevel: 7,
    baseStats: {
      strength: 10,
      dexterity: 14,
      constitution: 12,
      intelligence: 13,
      wisdom: 11,
      charisma: 17,
    },
    signatureItem: 'stormlace-cloak',
  },
  {
    id: 'zorin-shield',
    alias: 'Zorin Shield',
    class: 'Oath of Vigilance Paladin',
    background: 'Guardian of the Emberfall civic wardens.',
    baseLevel: 8,
    baseStats: {
      strength: 16,
      dexterity: 11,
      constitution: 15,
      intelligence: 9,
      wisdom: 13,
      charisma: 14,
    },
    signatureItem: 'runic-anchor-spike',
  },
  {
    id: 'silis-veil',
    alias: 'Silis Veil',
    class: 'Circle of Whispers Druid',
    background: 'Interpreter of elemental echoes in the clockwork wilds.',
    baseLevel: 7,
    baseStats: {
      strength: 8,
      dexterity: 13,
      constitution: 12,
      intelligence: 12,
      wisdom: 16,
      charisma: 11,
    },
    signatureItem: 'wildcore-seed',
  },
];

export const playerStatuses = [
  'active-duty',
  'planning-downtime',
  'on-short-rest',
  'scouting-forward',
] as const;

export function seedPlayers(manifest: WorldItemTemplate[]): Map<string, PlayerState> {
  const players = new Map<string, PlayerState>();
  playerBlueprints.forEach((blueprint) => {
    players.set(blueprint.id, buildPlayerState(blueprint, manifest));
  });
  return players;
}

export function buildPlayerState(blueprint: PlayerBlueprint, manifest: WorldItemTemplate[]): PlayerState {
  const stats = Object.entries(blueprint.baseStats).reduce<StatsMap>((acc, [key, value]) => {
    const statKey = key as StatKey;
    acc[statKey] = rollStat(value ?? 10);
    return acc;
  }, {} as StatsMap);

  const items = generateInventory(blueprint.signatureItem, manifest);

  return {
    id: blueprint.id,
    alias: blueprint.alias,
    class: blueprint.class,
    background: blueprint.background,
    level: blueprint.baseLevel,
    stats,
    items,
    status: pickOne(playerStatuses),
    currentQuestId: undefined,
    completedQuestIds: [],
  };
}

function generateInventory(preferredTemplateId: string, manifest: WorldItemTemplate[]): PlayerItem[] {
  const preferredTemplate = manifest.find((template) => template.templateId === preferredTemplateId);
  const pool = manifest.filter((template) => template.templateId !== preferredTemplateId);
  const extra = sampleMany(pool, 2 + Math.floor(Math.random() * 2));
  const loadout: PlayerItem[] = [];

  if (preferredTemplate) {
    loadout.push({ ...createPlayerItemFromTemplate(preferredTemplate), state: 'equipped' });
  }

  extra.forEach((template) => {
    loadout.push(createPlayerItemFromTemplate(template));
  });

  return loadout;
}

export function createPlayerItemFromTemplate(template: WorldItemTemplate): PlayerItem {
  return {
    id: `item-${randomUUID().slice(0, 8)}`,
    templateId: template.templateId,
    name: template.name,
    type: template.type,
    rarity: template.rarity,
    attunementRequired: template.attunementRequired,
    description: template.description,
    state: 'stowed',
    effect: template.effect,
  };
}

function rollStat(base: number): number {
  const variance = [-2, -1, 0, 1, 2];
  return clampStat(base + pickOne(variance));
}
