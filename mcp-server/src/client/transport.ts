export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
}

export type Transport = <T>(request: HttpRequest) => Promise<HttpResponse<T>>;

export interface FetchTransportOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
}

function mergeHeaders(
  defaults: Record<string, string> | undefined,
  overrides: Record<string, string> | undefined,
): Record<string, string> {
  return {
    ...(defaults ?? {}),
    ...(overrides ?? {}),
  };
}

export function createFetchTransport(options: FetchTransportOptions): Transport {
  const { baseUrl, defaultHeaders, timeoutMs = 15000 } = options;

  return async <T>(request: HttpRequest): Promise<HttpResponse<T>> => {
    const url = new URL(request.url, baseUrl).toString();
    const headers = mergeHeaders(defaultHeaders, request.headers);

    if (!headers['Accept']) {
      headers['Accept'] = 'application/json';
    }

    if (request.body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (error) {
          throw new Error(
            `Failed to parse JSON response from ${request.method} ${url}: ${(error as Error).message}`,
          );
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
      }

      return { status: response.status, data: data as T };
    } finally {
      clearTimeout(timeout);
    }
  };
}
