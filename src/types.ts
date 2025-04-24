/*

MIT License

...

*/

export interface VertexSettings {
  vertexProject: string;
  vertexLocation: string;
  vertexModel: string;
  googleOAuthClientId: string;
}

export interface SettingsContextProps {
  settings: VertexSettings;
  isLoading: boolean;
  error: string | null;
  saveSettings: (settings: Partial<VertexSettings>) => Promise<void>;
}