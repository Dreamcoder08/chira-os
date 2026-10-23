import type { paths } from '../../../../packages/contracts/src/api.d.ts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
export async function request<T>(
  path: string,
  associationId?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (associationId) headers.set('x-association-id', associationId);
  if (options.body && typeof options.body === 'string')
    headers.set('content-type', 'application/json');
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      data.error ?? data.code ?? 'REQUEST_FAILED',
    );
  }
  return response.json();
}
export type ParcelsResponse =
  paths['/api/v1/parcels']['get']['responses'][200]['content']['application/json'];
export function getParcels(associationId: string) {
  return request<ParcelsResponse>('/api/v1/parcels', associationId);
}
