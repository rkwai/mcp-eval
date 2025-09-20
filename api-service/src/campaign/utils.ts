export function pickOne<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function sampleMany<T>(list: readonly T[], count: number): T[] {
  if (count >= list.length) {
    return [...list];
  }

  const copy = [...list];
  const result: T[] = [];

  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(Math.random() * copy.length);
    const [item] = copy.splice(index, 1);
    if (item === undefined) {
      break;
    }
    result.push(item);
  }

  return result;
}

export function clampStat(value: number): number {
  return Math.max(1, Math.min(30, Math.round(value)));
}
