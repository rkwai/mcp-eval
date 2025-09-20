import { getJson, postJson } from '../client/api';
import {
  CreateItemPayload,
  CreateItemResponse,
  CreateLorePayload,
  CreateLoreResponse,
  CreateNpcPayload,
  CreateNpcResponse,
  ItemManifestResponse,
  LoreListResponse,
  NpcListResponse,
  WorldOverview,
} from '../types';

export async function getOverview() {
  return getJson<WorldOverview>('/world');
}

export async function listLore() {
  return getJson<LoreListResponse>('/world/lore');
}

export async function createLore(payload: CreateLorePayload) {
  return postJson<CreateLoreResponse>('/world/lore', payload);
}

export async function listNpcs() {
  return getJson<NpcListResponse>('/world/npcs');
}

export async function createNpc(payload: CreateNpcPayload) {
  return postJson<CreateNpcResponse>('/world/npcs', payload);
}

export async function listItems() {
  return getJson<ItemManifestResponse>('/world/items');
}

export async function createItem(payload: CreateItemPayload) {
  return postJson<CreateItemResponse>('/world/items', payload);
}
