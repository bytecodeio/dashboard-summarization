/*

MIT License

...

*/

export enum StorageType {
  LocalStorage = 'localStorage',
  SessionStorage = 'sessionStorage',
  Memory = 'memory'
}

export interface SafeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

export interface VertexSettings {
  vertexProject: string;
  vertexLocation: string;
  vertexModel: string;
  googleOAuthClientId: string;
  storageType?: StorageType;
}

export interface SettingsContextProps {
  settings: VertexSettings;
  isLoading: boolean;
  error: string | null;
  saveSettings: (settings: Partial<VertexSettings>) => Promise<void>;
  storage: SafeStorage;
}

export function isStorageAccessible(storage: Storage): boolean {
  if (!storage) return false;

  try {
    const testKey = '__test__';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    if (e instanceof DOMException) {
      // Handle specific DOMException cases
      if (
        e.code === DOMException.QUOTA_EXCEEDED_ERR ||
        e.code === DOMException.SECURITY_ERR ||
        e.code === DOMException.INVALID_STATE_ERR
      ) {
        console.warn('Storage is not accessible:', e.message);
        return false;
      }
    }
    console.error('Unexpected error while accessing storage:', e);
    return false;
  }
}