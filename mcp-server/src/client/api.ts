export interface HttpRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
}

export type HttpAdapter = <T>(request: HttpRequest) => Promise<HttpResponse<T>>;

let adapter: HttpAdapter = defaultMockAdapter;

export function configureHttpAdapter(customAdapter: HttpAdapter) {
  adapter = customAdapter;
}

export async function httpGet<T>(url: string, headers?: Record<string, string>) {
  return adapter<T>({ method: 'GET', url, headers });
}

export async function httpPost<T>(url: string, body?: unknown, headers?: Record<string, string>) {
  return adapter<T>({ method: 'POST', url, body, headers });
}

export async function httpPatch<T>(url: string, body?: unknown, headers?: Record<string, string>) {
  return adapter<T>({ method: 'PATCH', url, body, headers });
}

async function defaultMockAdapter<T>(request: HttpRequest): Promise<HttpResponse<T>> {
  throw new Error(
    `No HTTP adapter configured for request ${request.method} ${request.url}. ` +
      'Provide a custom adapter via configureHttpAdapter when integrating with live APIs.',
  );
}
