const DURATION_PATTERN = /^(\d+)([smhd])$/;

const UNIT_TO_MILLISECONDS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000
};

export function durationToMilliseconds(value: string, fallback: string): number {
  const normalized = value.trim().toLowerCase();
  const parsed = parseDuration(normalized);
  if (parsed !== null) {
    return parsed;
  }

  const parsedFallback = parseDuration(fallback);
  if (parsedFallback !== null) {
    return parsedFallback;
  }

  throw new Error(`Invalid duration value: ${value}`);
}

function parseDuration(value: string): number | null {
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const numericValue = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  const unitMilliseconds = UNIT_TO_MILLISECONDS[unit];
  if (!unitMilliseconds) {
    return null;
  }

  return numericValue * unitMilliseconds;
}
