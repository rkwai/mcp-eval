import { deleteJson, getJson, patchJson, postJson } from '../client/api';
import {
  DropItemResponse,
  GrantItemResponse,
  PlayerItem,
  PlayerListResponse,
  PlayerProfile,
  StatsUpdatePayload,
  UseItemResponse,
} from '../types';

interface InspectArgs {
  playerId: string;
}

interface AdjustStatsArgs extends InspectArgs {
  stats: Record<string, number>;
  mode?: StatsUpdatePayload['mode'];
}

interface GrantItemArgs extends InspectArgs {
  templateId?: string;
  item?: Record<string, unknown>;
}

interface UseItemArgs extends InspectArgs {
  itemId?: string;
  itemTemplateId?: string;
}

interface DropItemArgs extends InspectArgs {
  itemId?: string;
  itemTemplateId?: string;
}

export async function listParty() {
  return getJson<PlayerListResponse>('/players');
}

export async function inspectPlayer(args: InspectArgs) {
  return getJson<PlayerProfile>(`/players/${args.playerId}`);
}

export async function adjustStats(args: AdjustStatsArgs) {
  if (!args.stats || Object.keys(args.stats).length === 0) {
    throw new Error('Provide at least one stat to modify.');
  }

  return patchJson<{ player: PlayerProfile }>(`/players/${args.playerId}/stats`, {
    mode: args.mode ?? 'absolute',
    stats: args.stats,
  });
}

export async function grantItemToPlayer(args: GrantItemArgs) {
  if (!args.templateId && !args.item) {
    throw new Error('Supply either a templateId or an item payload to grant.');
  }

  const itemPayload = normaliseItemPayload(args.item);

  return postJson<GrantItemResponse>(`/players/${args.playerId}/items`, {
    templateId: args.templateId,
    item: itemPayload,
  });
}

export async function useItem(args: UseItemArgs) {
  const itemId = args.itemId ?? (await resolveItemId(args.playerId, args.itemTemplateId));
  if (!itemId) {
    throw new Error(
      `Unable to find item${args.itemTemplateId ? ` with template ${args.itemTemplateId}` : ''} for player ${args.playerId}.`,
    );
  }

  return postJson<UseItemResponse>(`/players/${args.playerId}/items/${itemId}/use`, {});
}

export async function dropItem(args: DropItemArgs) {
  const itemId = args.itemId ?? (await resolveItemId(args.playerId, args.itemTemplateId));
  if (!itemId) {
    throw new Error(
      `Unable to find item${args.itemTemplateId ? ` with template ${args.itemTemplateId}` : ''} for player ${args.playerId}.`,
    );
  }

  return deleteJson<DropItemResponse>(`/players/${args.playerId}/items/${itemId}`);
}

async function resolveItemId(playerId: string, templateId?: string) {
  const profile = await inspectPlayer({ playerId });
  if (templateId) {
    const match = profile.items.find((item) => item.templateId === templateId);
    return match?.id;
  }
  return profile.items[0]?.id;
}

function normaliseItemPayload(input?: Record<string, unknown>) {
  if (!input) {
    return undefined;
  }

  const candidate: Partial<Omit<PlayerItem, 'id' | 'templateId' | 'state'>> & { templateId?: string } = {};

  if (typeof input.templateId === 'string') {
    candidate.templateId = input.templateId;
  }
  if (typeof input.name === 'string') {
    candidate.name = input.name;
  }
  if (typeof input.type === 'string') {
    candidate.type = input.type;
  }
  if (typeof input.rarity === 'string') {
    candidate.rarity = input.rarity as PlayerItem['rarity'];
  }
  if (typeof input.attunementRequired === 'boolean') {
    candidate.attunementRequired = input.attunementRequired;
  }
  if (typeof input.description === 'string') {
    candidate.description = input.description;
  }

  return candidate;
}
