/*

MIT License

Copyright (c) 2023 Looker Data Sciences, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

import React from 'react';
import { Filters } from '@looker/extension-sdk';

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
  backendServiceUrl: string;
}

export interface SettingsContextProps {
  settings: VertexSettings;
  isLoading: boolean;
  error: string | null;
  saveSettings: (settings: Partial<VertexSettings>) => Promise<void>;
  storage: SafeStorage;
}

export interface Query {
    queryBody: {
        fields: any;
        dynamic_fields?: any;
        view: any;
        model: any;
        filters?: any;
        pivots?: any;
        sorts?: any;
        limit?: any;
        column_limit?: any;
        row_total?: any;
        subtotals?: any;
    };
    note_text: string;
    title: string;
}

export interface DashboardMetadata {
    dashboardFilters: Filters | undefined,
    dashboardId: string | undefined,
    queries: Query[],
    indexedFilters?: {
        [key: string]: {
            dimension: string,
            explore: string,
            model: string
        }
    },
    description?: string | undefined,
    prompt?: string | undefined
}

export interface QuerySummary {
  queryTitle: string;
  description: string;
  summary: string;
  nextSteps: string[];
}

export interface ConversationExchange {
    userPrompt: string;
    aiResponse: string;
    timestamp: number;
}

export interface SummaryDataContextType {
    data: string[];
    setData: React.Dispatch<React.SetStateAction<string[]>>;
    conversationHistory: ConversationExchange[];
    setConversationHistory: React.Dispatch<React.SetStateAction<ConversationExchange[]>>;
    querySuggestions: string[];
    setQuerySuggestions: React.Dispatch<React.SetStateAction<string[]>>;
    info: boolean;
    setInfo: React.Dispatch<React.SetStateAction<boolean>>;
    message: string;
    setMessage: React.Dispatch<React.SetStateAction<string>>;
    dashboardURL: string;
    setDashboardURL: React.Dispatch<React.SetStateAction<string>>;
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