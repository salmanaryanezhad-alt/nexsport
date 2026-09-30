import zlib from "zlib";

export interface CompactTournamentPayload {
  id: string;
  title: string;
  format: string;
  sport?: string | null;
  teamCount: number;
  state: any;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * Encodes tournament data into a compact, URL-safe base64url string.
 * Uses deflateRaw for maximum compression efficiency.
 */
export function encodeTournamentPayload(data: CompactTournamentPayload): string {
  try {
    const json = JSON.stringify({
      i: data.id,
      t: data.title,
      f: data.format,
      s: data.sport || undefined,
      c: data.teamCount,
      st: data.state,
      ca: data.createdAt ? new Date(data.createdAt).toISOString() : undefined,
      ua: data.updatedAt ? new Date(data.updatedAt).toISOString() : undefined,
    });

    const deflated = zlib.deflateRawSync(Buffer.from(json, "utf8"));
    return deflated.toString("base64url");
  } catch (err) {
    console.warn("[TournamentCodec] Failed to deflate, falling back to base64url:", err);
    try {
      const json = JSON.stringify(data);
      return Buffer.from(json, "utf8").toString("base64url");
    } catch {
      return "";
    }
  }
}

/**
 * Decodes tournament data from a URL-safe base64url string.
 * Supports both deflated and plain base64url formats.
 */
export function decodeTournamentPayload(str: string): CompactTournamentPayload | null {
  if (!str || typeof str !== "string") return null;

  try {
    const buf = Buffer.from(str.trim(), "base64url");
    let jsonStr: string;

    try {
      // First attempt inflated
      const inflated = zlib.inflateRawSync(buf);
      jsonStr = inflated.toString("utf8");
    } catch {
      // Fallback: try raw uncompressed buffer
      jsonStr = buf.toString("utf8");
    }

    const parsed = JSON.parse(jsonStr);

    // If encoded with compact keys
    if (parsed.i || parsed.t || parsed.f) {
      return {
        id: String(parsed.i || ""),
        title: String(parsed.t || "مسابقات ورزشی"),
        format: String(parsed.f || "league"),
        sport: parsed.s ? String(parsed.s) : null,
        teamCount: Number(parsed.c) || 0,
        state: parsed.st || {},
        createdAt: parsed.ca || new Date().toISOString(),
        updatedAt: parsed.ua || new Date().toISOString(),
      };
    }

    // Direct object format
    if (parsed.id || parsed.title) {
      return {
        id: String(parsed.id || ""),
        title: String(parsed.title || "مسابقات ورزشی"),
        format: String(parsed.format || "league"),
        sport: parsed.sport || null,
        teamCount: Number(parsed.teamCount || parsed.team_count) || 0,
        state: parsed.state || {},
        createdAt: parsed.createdAt || parsed.created_at || new Date().toISOString(),
        updatedAt: parsed.updatedAt || parsed.updated_at || new Date().toISOString(),
      };
    }

    return null;
  } catch (err) {
    console.error("[TournamentCodec] Decode error:", err);
    return null;
  }
}
