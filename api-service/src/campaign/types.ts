export type StatKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type QuestStatus = 'available' | 'active' | 'completed';
export type StatsUpdateMode = 'absolute' | 'delta';

export type StatsMap = Record<StatKey, number>;

export interface Quest {
  id: string;
  title: string;
  objective: string;
  primaryLocation: string;
  suggestedChallenges: string[];
  reward: string;
}

export interface QuestState extends Quest {
  status: QuestStatus;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface QuestUpdateInput {
  title?: string;
  objective?: string;
  primaryLocation?: string;
  suggestedChallenges?: string[];
  reward?: string;
}

export interface StoryArc {
  name: string;
  synopsis: string;
  tone: string;
  escalation: string;
}

export interface PlayerItem {
  id: string;
  templateId: string;
  name: string;
  type: string;
  rarity: Rarity;
  attunementRequired: boolean;
  description: string;
  state: 'equipped' | 'stowed';
}

export interface PlayerState {
  id: string;
  alias: string;
  class: string;
  background: string;
  level: number;
  stats: StatsMap;
  items: PlayerItem[];
  status: string;
  currentQuestId?: string;
  completedQuestIds: string[];
}

export interface LoreSetting {
  name: string;
  biome: string;
  description: string;
  activeThreats: string[];
  magicalPhenomena: string[];
}

export interface LoreEntry {
  id: string;
  title: string;
  summary: string;
  significance: string;
}

export interface LoreInput {
  title: string;
  summary: string;
  significance: string;
}

export interface NpcProfile {
  id: string;
  name: string;
  archetype: string;
  motivation: string;
  relationshipToParty: string;
  voiceNote: string;
}

export interface NpcInput {
  name: string;
  archetype: string;
  motivation: string;
  relationshipToParty: string;
  voiceNote: string;
}

export interface WorldItemTemplate {
  templateId: string;
  name: string;
  type: string;
  rarity: Rarity;
  attunementRequired: boolean;
  description: string;
  origin: string;
}

export interface ItemInput {
  templateId?: string;
  name: string;
  type: string;
  rarity: Rarity;
  attunementRequired: boolean;
  description: string;
  origin: string;
}

export interface WorldState {
  currentSetting: LoreSetting;
  loreEntries: LoreEntry[];
  npcRoster: NpcProfile[];
  itemManifest: WorldItemTemplate[];
}

export interface CampaignState {
  storyArc: StoryArc;
  questBoard: QuestState[];
  players: Map<string, PlayerState>;
  world: WorldState;
}

export interface SerializedQuest {
  id: string;
  title: string;
  status: QuestStatus;
  objective: string;
  primaryLocation: string;
  suggestedChallenges: string[];
  reward: string;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SerializedPlayer {
  id: string;
  alias: string;
  class: string;
  background: string;
  level: number;
  stats: StatsMap;
  items: PlayerItem[];
  status: string;
  currentQuest: SerializedQuest | null;
  completedQuestIds: string[];
}

export type DomainResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export interface StartQuestResult {
  quest: SerializedQuest;
  player: SerializedPlayer;
  narration: string;
}

export interface CompleteQuestResult {
  quest: SerializedQuest;
  player: SerializedPlayer;
  narration: string;
}

export interface GrantItemInput {
  templateId?: string;
  item?: Partial<Omit<PlayerItem, 'id' | 'templateId' | 'state'>> & { templateId?: string };
}

export interface GrantItemResult {
  player: SerializedPlayer;
  grantedItem: PlayerItem;
  narration: string;
}

export interface UseItemResult {
  player: SerializedPlayer;
  consumedItem: PlayerItem;
  effect: string;
  narration: string;
}

export interface DropItemResult {
  player: SerializedPlayer;
  droppedItem: PlayerItem;
  narration: string;
}

export interface StatsUpdateInput {
  mode?: StatsUpdateMode;
  stats?: Partial<Record<string, number>>;
}
