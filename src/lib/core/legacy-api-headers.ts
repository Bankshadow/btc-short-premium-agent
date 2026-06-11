export const LEGACY_API_DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "2026-12-31",
  Link: '</api/core/projections/bundle>; rel="successor-version"',
  "X-Legacy-Api": "true",
};

export function withLegacyApiHeaders<T extends Response>(response: T): T {
  for (const [key, value] of Object.entries(LEGACY_API_DEPRECATION_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
