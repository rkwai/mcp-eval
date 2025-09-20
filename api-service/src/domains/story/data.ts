import { randomUUID } from 'crypto';
import { QuestState, StoryArc } from '../../campaign/types';
import { pickOne, sampleMany } from '../../campaign/utils';

export const storyArcs: StoryArc[] = [
  {
    name: 'Shadows Over Emberfall',
    synopsis: 'An exiled pyromancer dismantles the city wards to revive a slumbering cinder titan.',
    tone: 'brooding heroism',
    escalation: 'ritual clock',
  },
  {
    name: 'The Clockwork Wilds',
    synopsis: 'A druidic enclave fuses nature with forgotten automata, birthing unpredictable guardians.',
    tone: 'mystic curiosity',
    escalation: 'territorial expansion',
  },
  {
    name: 'Echoes of the Astral Choir',
    synopsis: 'Disgraced choristers harness aberrant harmonics to fracture planar boundaries.',
    tone: 'cosmic dread',
    escalation: 'planar breach',
  },
  {
    name: 'The Sapphire Heist',
    synopsis: 'A rival adventuring guild plots to steal a draconic heartstone during the eclipse gala.',
    tone: 'high-stakes intrigue',
    escalation: 'race against time',
  },
];

const questObjectives = [
  'disrupt the binding ritual before the final verse',
  'escort a relic-bearing acolyte across enemy territory',
  'recover lost schematics from a haunted vault',
  'negotiate a cease-fire between warring guilds',
  'locate the keystone that stabilises the leyline breach',
  'survive the trial of embers to earn phoenix favor',
];

const questChallenges = [
  'arcane feedback storms',
  'clockwork sentinels with adaptive plating',
  'political sabotage from inside the council',
  'memory wells that rewrite recent history',
  'glacial spirits vying for mortal hosts',
  'rival adventurers tracking the same objective',
  'shifting dungeon geometry every dusk',
];

const questRewards = [
  'mythic-grade focus crystal',
  'exclusive audience with the Lorekeeper',
  'reputation boost with the Emberfall Council',
  'ancestral weapon infusion',
  'access to the Horizon Archive',
  'favor token redeemable for planar passage',
];

const questLocales = [
  'Shattered Ember Plaza',
  'the Rootspire Catacombs',
  'Crescent Harbor Sky-Docks',
  'Glimmerfen Expanse',
  'Vaults of Resonant Steel',
  'The Veiled Conservatory',
];

export const moodPalette = [
  'smoldering tension',
  'gallows humor',
  'unlikely alliances',
  'reckless ambition',
  'embracing the unknown',
  'sacrifice for the greater good',
  'whispers of betrayal',
  'rallying hope',
] as const;

export function selectStoryArc(): StoryArc {
  return pickOne(storyArcs);
}

export function createQuestState(): QuestState {
  const objective = pickOne(questObjectives);
  const location = pickOne(questLocales);
  const reward = pickOne(questRewards);
  const challenges = sampleMany(questChallenges, 2 + Math.floor(Math.random() * 2));
  const title = `${pickOne(['Forged', 'Lost', 'Secret', 'Echoing', 'Shattered', 'Awakened'])} ${pickOne([
    'Legacy',
    'Vault',
    'Pact',
    'Symphony',
    'Beacon',
    'Labyrinth',
  ])}`;

  return {
    id: `quest-${randomUUID().slice(0, 8)}`,
    title,
    objective,
    primaryLocation: location,
    suggestedChallenges: challenges,
    reward,
    status: 'available',
  };
}

export function generateQuestStates(count: number): QuestState[] {
  return Array.from({ length: count }, () => createQuestState());
}

export function getMoodPrompts(count: number): string[] {
  return sampleMany(moodPalette, count);
}
