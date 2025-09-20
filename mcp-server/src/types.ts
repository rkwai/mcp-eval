export interface StoryArc {
  name: string;
  synopsis: string;
  tone: string;
  escalation: string;
}

export interface QuestSummary {
  id: string;
  title: string;
  status: 'available' | 'active' | 'completed';
  objective: string;
  primaryLocation: string;
  suggestedChallenges: string[];
  reward: string;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface QuestBoard {
  available: QuestSummary[];
  active: QuestSummary[];
  completed: QuestSummary[];
}

export interface StoryOverview {
  arc: StoryArc;
  questBoard: QuestBoard;
  moodPrompts: string[];
}

export interface QuestListResponse {
  quests: QuestSummary[];
}

export interface StoryQuestMutationResponse {
  quest: QuestSummary;
  player: PlayerProfile;
  narration: string;
}

export interface StartAdventureResponse {
  world: WorldOverview;
  startingQuest: QuestSummary;
  player: PlayerProfile;
  startingLocation: string;
  narration: string;
}

export interface ProgressAdventureResponse {
  quest: QuestSummary;
  player: PlayerProfile;
  narration: string;
  resolutionNote: string;
  nextQuestBoard: QuestBoard;
  supportingNpcs: NpcListResponse['npcs'];
}

export type StatKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export interface PlayerItem {
  id: string;
  templateId: string;
  name: string;
  type: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  attunementRequired: boolean;
  description: string;
  state: 'equipped' | 'stowed';
}

export interface PlayerProfile {
  id: string;
  alias: string;
  class: string;
  background: string;
  level: number;
  stats: Record<StatKey, number>;
  items: PlayerItem[];
  status: string;
  currentQuest: QuestSummary | null;
  completedQuestIds: string[];
}

export interface PlayerListResponse {
  players: PlayerProfile[];
}

export interface GrantItemResponse {
  player: PlayerProfile;
  grantedItem: PlayerItem;
  narration: string;
}

export interface UseItemResponse {
  player: PlayerProfile;
  consumedItem: PlayerItem;
  effect: string;
  narration: string;
}

export interface DropItemResponse {
  player: PlayerProfile;
  droppedItem: PlayerItem;
  narration: string;
}

export interface StatsUpdatePayload {
  mode?: 'absolute' | 'delta';
  stats?: Partial<Record<string, number>>;
}

export interface WorldOverview {
  setting: {
    name: string;
    biome: string;
    description: string;
    activeThreats: string[];
    magicalPhenomena: string[];
  };
  highlights: {
    threats: string[];
    magicalPhenomena: string[];
    notableAllies: Array<{
      id: string;
      name: string;
      archetype: string;
      motivation: string;
      relationshipToParty: string;
      voiceNote: string;
    }>;
  };
}

export interface LoreListResponse {
  lore: Array<{
    id: string;
    title: string;
    summary: string;
    significance: string;
  }>;
}

export interface CreateLorePayload {
  title: string;
  summary: string;
  significance: string;
}

export interface CreateLoreResponse {
  lore: {
    id: string;
    title: string;
    summary: string;
    significance: string;
  };
}

export interface NpcListResponse {
  npcs: Array<{
    id: string;
    name: string;
    archetype: string;
    motivation: string;
    relationshipToParty: string;
    voiceNote: string;
  }>;
}

export interface CreateNpcPayload {
  name: string;
  archetype: string;
  motivation: string;
  relationshipToParty: string;
  voiceNote: string;
}

export interface CreateNpcResponse {
  npc: {
    id: string;
    name: string;
    archetype: string;
    motivation: string;
    relationshipToParty: string;
    voiceNote: string;
  };
}

export interface ItemManifestResponse {
  items: Array<{
    templateId: string;
    name: string;
    type: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    attunementRequired: boolean;
    description: string;
    origin: string;
  }>;
}

export interface CreateItemPayload {
  templateId?: string;
  name: string;
  type: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  attunementRequired: boolean;
  description: string;
  origin: string;
}

export interface CreateItemResponse {
  item: {
    templateId: string;
    name: string;
    type: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    attunementRequired: boolean;
    description: string;
    origin: string;
  };
}
