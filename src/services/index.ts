import type { SaveData } from "@/core/progress";

/**
 * v1 ships offline (MM-132): no accounts, no Supabase. These stubs hold the shape the UI will call
 * once auth, cloud saves and leaderboards arrive in v1.1 (MM-133) — only this folder will import
 * `@supabase/supabase-js`, and nothing else has to change.
 */
export interface LeaderboardEntry {
  name: string;
  score: number;
}

export const auth = {
  isSignedIn: (): boolean => false,
  userId: (): string | null => null,
};

export const savesSync = {
  /** Cloud merge keeps the best of local and remote. Offline: local wins. */
  async merge(local: SaveData): Promise<SaveData> {
    return local;
  },
  async push(_save: SaveData): Promise<void> {
    /* offline build */
  },
};

export const leaderboard = {
  async top(_levelId: string): Promise<LeaderboardEntry[]> {
    return [];
  },
  async submit(_levelId: string, _score: number): Promise<void> {
    /* offline build */
  },
};
