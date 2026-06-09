const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

export function getSafeExternalUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    try {
      const url = new URL(`https://${trimmed}`);
      return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }
}
