import { randomUUID } from 'crypto';
import {
  LoreEntry,
  LoreSetting,
  NpcProfile,
  WorldItemTemplate,
} from '../../campaign/types';
import { pickOne, sampleMany } from '../../campaign/utils';

export const loreSettings: LoreSetting[] = [
  {
    name: 'Emberfall Metropolis',
    biome: 'Volcanic coastal city',
    description: 'A layered city built into obsidian terraces, channeling geothermal currents into arcane industry.',
    activeThreats: [
      'cinder titan cultists testing the wardlines',
      'political unrest within the artificer guilds',
    ],
    magicalPhenomena: [
      'ember sprites that carry whispered news',
      'leyline vents forming spontaneous songstones',
    ],
  },
  {
    name: 'Clockwork Wilds',
    biome: 'Overgrown jungle fused with automata',
    description: 'Nature and machinery intermingle, with vine-draped constructs roaming ancient pathways.',
    activeThreats: [
      'feral gearbeasts defending an awakened core',
      'druidic wards rejecting outsiders',
    ],
    magicalPhenomena: [
      'temporal blooms that rewind moments',
      'aural illusions mimicking trusted allies',
    ],
  },
  {
    name: 'The Sapphire Expanse',
    biome: 'Floating archipelago',
    description: 'Shattered islands drift above a mirrored sea, stitched together by bridges of refracted light.',
    activeThreats: [
      'sky corsairs exploiting planar slips',
      'storm elementals bargaining for memories',
    ],
    magicalPhenomena: [
      'gravity wells that invert mid-flight',
      'sapphire rain storing echoes of conversations',
    ],
  },
];

const npcArchetypes: Omit<NpcProfile, 'id'>[] = [
  {
    name: 'Archivist Lume',
    archetype: 'Lorekeeper',
    motivation: 'Catalogue unstable artifacts before they fracture reality.',
    relationshipToParty: 'quest-giver',
    voiceNote: 'Measured cadence, punctuated by crystalline chimes from her staff.',
  },
  {
    name: 'Captain Rhi Ordell',
    archetype: 'Skyship Commander',
    motivation: 'Secure trade routes across the Sapphire Expanse.',
    relationshipToParty: 'potential ally',
    voiceNote: 'Authoritative with an undercurrent of weary optimism.',
  },
  {
    name: 'Grix the Whisper',
    archetype: 'Information Broker',
    motivation: 'Leverage secrets to keep rival factions balanced.',
    relationshipToParty: 'favors-for-sale',
    voiceNote: 'Hushed tone that always sounds like a shared secret.',
  },
  {
    name: 'Sister Myr Voss',
    archetype: 'Planar Anchorite',
    motivation: 'Close rifts that leak aberrant choruses into the material plane.',
    relationshipToParty: 'cautious collaborator',
    voiceNote: 'Ethereal resonance layered over gentle chanting.',
  },
  {
    name: 'Nix Emberweld',
    archetype: 'Artificer Savant',
    motivation: 'Prototype defensive constructs before the cultists strike.',
    relationshipToParty: 'supplier',
    voiceNote: 'Rapid-fire observations peppered with crackling sparks.',
  },
  {
    name: 'Verrin Flux',
    archetype: 'Temporal Cartographer',
    motivation: 'Map the unstable leylines to prevent planar overlap.',
    relationshipToParty: 'reluctant ally',
    voiceNote: 'Soft-spoken with occasional echoes of future words.',
  },
];

export const worldItemTemplates: WorldItemTemplate[] = [
  {
    templateId: 'stormlace-cloak',
    name: 'Stormlace Cloak',
    type: 'cloak',
    rarity: 'uncommon',
    attunementRequired: false,
    description: 'Threads of captured lightning grant gliding descents and static wards.',
    origin: 'Skyloom Atelier',
  },
  {
    templateId: 'mnemonic-dice',
    name: 'Mnemonic Dice Set',
    type: 'tool',
    rarity: 'common',
    attunementRequired: false,
    description: 'Faceted dice that replay the last critical decision when rolled.',
    origin: 'Archivist Collegium',
  },
  {
    templateId: 'phoenixfire-draught',
    name: 'Phoenixfire Draught',
    type: 'consumable',
    rarity: 'uncommon',
    attunementRequired: false,
    description: 'Fiery elixir that heals grievous wounds at the cost of temporary exhaustion.',
    origin: 'Ashen Apotheca',
  },
  {
    templateId: 'chrono-scribed-grimoire',
    name: 'Chrono-scribed Grimoire',
    type: 'tome',
    rarity: 'rare',
    attunementRequired: true,
    description: 'Spellbook that records alternate outcomes from future timelines.',
    origin: 'Temporal Scriptorium',
  },
  {
    templateId: 'runic-anchor-spike',
    name: 'Runic Anchor Spike',
    type: 'weapon',
    rarity: 'uncommon',
    attunementRequired: true,
    description: 'War spike that pins planar entities to the material plane.',
    origin: 'Wardens of Emberfall',
  },
  {
    templateId: 'glimmershard-lantern',
    name: 'Glimmershard Lantern',
    type: 'utility',
    rarity: 'common',
    attunementRequired: false,
    description: 'Lantern fueled by resonance crystals that reveal secret sigils.',
    origin: 'Guild of Illuminators',
  },
  {
    templateId: 'wildcore-seed',
    name: 'Wildcore Seed',
    type: 'totem',
    rarity: 'rare',
    attunementRequired: false,
    description: 'Living focus that communes with awakened flora constructs.',
    origin: 'Circle of Whispers',
  },
];

const loreFragments = [
  {
    title: 'The Emberfall Accord',
    summary: 'A pact forged between artificers and phoenix spirits to defend the city from cinder tides.',
    significance: 'Explains why phoenix-themed artifacts unlock civic wards.',
  },
  {
    title: 'Map of the Clockwork Wilds',
    summary: 'Cartography notes describing shifting routes maintained by druidic automatons.',
    significance: 'Provides navigation advantage when scouting the mechanical canopy.',
  },
  {
    title: 'Songs of the Astral Choir',
    summary: 'Harmonic sequences that can anchor planar breaches when sung in triad.',
    significance: 'Reveals how bardic magic can seal rifts opened by cultists.',
  },
  {
    title: 'Sapphire Expanse Trade Lanes',
    summary: 'Ledgers documenting skyship corridors and pirate ambush sites.',
    significance: 'Guides negotiation with Captain Ordell for safe passage.',
  },
];

export function selectWorldSetting(): LoreSetting {
  return pickOne(loreSettings);
}

export function generateNpcRoster(count: number): NpcProfile[] {
  return sampleMany(npcArchetypes, count).map((npc) => ({
    ...npc,
    id: `npc-${randomUUID().slice(0, 8)}`,
  }));
}

export function buildLoreEntries(setting: LoreSetting): LoreEntry[] {
  return loreFragments
    .map((fragment) => ({
      id: `lore-${randomUUID().slice(0, 6)}`,
      title: fragment.title,
      summary: fragment.summary,
      significance: fragment.significance,
    }))
    .concat({
      id: `lore-${randomUUID().slice(0, 6)}`,
      title: `${setting.name} Gazette`,
      summary: `Weekly dispatch covering developments within ${setting.name}.`,
      significance: `Highlights how ${setting.activeThreats[0]} is reshaping local politics.`,
    });
}

export function describeItemUse(templateId: string) {
  switch (templateId) {
    case 'phoenixfire-draught':
      return 'Fiery plumage erupts as wounds cauterise, leaving faint ash motes.';
    case 'stormlace-cloak':
      return 'Static shields ripple outward, deflecting incoming strikes for a turn.';
    case 'chrono-scribed-grimoire':
      return 'Temporal echoes reveal an alternate outcome, granting advantage on the next check.';
    case 'mnemonic-dice':
      return 'Visions replay the last pivotal choice, informing the party with hidden context.';
    case 'runic-anchor-spike':
      return 'The spike pins a phasing foe in place, negating teleport abilities.';
    case 'glimmershard-lantern':
      return 'Secret sigils shimmer into view, outlining hidden passages.';
    case 'wildcore-seed':
      return 'Vines surge forth, restraining hostiles while healing nearby allies.';
    default:
      return 'A burst of arcane energy resolves, altering the battlefield mood.';
  }
}
