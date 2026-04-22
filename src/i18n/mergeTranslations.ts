/** Deep-merge JSON-like translation trees so locale bundles can override English partially. */
export function mergeTranslations<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>,
): T {
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(override)) {
    const bv = override[key];
    const av = base[key as keyof T] as unknown;
    if (
      bv !== undefined &&
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv) &&
      av !== undefined &&
      av !== null &&
      typeof av === 'object' &&
      !Array.isArray(av)
    ) {
      out[key] = mergeTranslations(av as Record<string, unknown>, bv as Record<string, unknown>);
    } else if (bv !== undefined) {
      out[key] = bv;
    }
  }
  return out as T;
}
