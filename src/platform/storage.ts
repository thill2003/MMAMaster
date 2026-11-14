import { Preferences } from "@capacitor/preferences";

/**
 * Key-value storage. Capacitor Preferences on device (UserDefaults / SharedPreferences) and its
 * localStorage-backed web implementation in the browser; an in-memory map if both are unavailable.
 */
const memory = new Map<string, string>();

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    memory.set(key, value);
    try {
      await Preferences.set({ key, value });
    } catch {
      /* kept in memory for this session */
    }
  },
  async remove(key: string): Promise<void> {
    memory.delete(key);
    try {
      await Preferences.remove({ key });
    } catch {
      /* nothing stored */
    }
  },
};
