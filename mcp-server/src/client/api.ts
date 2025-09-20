export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: composeBody(method, options.body),
  });

  if (!response.ok) {
    const text = await safeText(response);
    throw new Error(`API ${method} ${path} failed with status ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body });
}

export function deleteJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

function composeBody(method: HttpMethod, body: unknown) {
  if (method === 'GET' || method === 'DELETE') {
    return undefined;
  }

  if (body === undefined) {
    return undefined;
  }

  return JSON.stringify(body);
}

async function safeText(response: Response) {
  try {
    return await response.text();
  } catch (error) {
    return '[unreadable body]';
  }
}
