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

import md5 from 'md5';
import { DashboardMetadata, Query } from '../types';

// In-memory cache to avoid localStorage issues
const cache = new Map<string, { data: any; timestamp: number }>();

// Cache TTL in milliseconds (30 minutes)
const CACHE_TTL = 30 * 60 * 1000;

// Generate cache key from dashboard ID and filters
export function generateCacheKey(dashboardId: string, filters: any): string {
  const filterString = JSON.stringify(filters || {});
  return md5(`${dashboardId}:${filterString}`);
}

// Generate cache key for query data
export function generateQueryCacheKey(query: Query): string {
  const queryString = JSON.stringify(query.queryBody);
  return md5(`query:${queryString}`);
}

// Check if cached item is still valid
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

// Get cached dashboard metadata
export function getCachedDashboardMetadata(dashboardId: string, filters: any): DashboardMetadata | null {
  const key = generateCacheKey(dashboardId, filters);
  const cached = cache.get(key);
  
  if (cached && isCacheValid(cached.timestamp)) {
    console.log('Cache hit for dashboard metadata:', key);
    return cached.data;
  }
  
  if (cached) {
    console.log('Cache expired for dashboard metadata:', key);
    cache.delete(key);
  }
  
  return null;
}

// Cache dashboard metadata
export function cacheDashboardMetadata(dashboardId: string, filters: any, metadata: DashboardMetadata): void {
  const key = generateCacheKey(dashboardId, filters);
  cache.set(key, {
    data: metadata,
    timestamp: Date.now()
  });
  console.log('Cached dashboard metadata:', key);
}

// Get cached query data
export function getCachedQueryData(query: Query): any | null {
  const key = generateQueryCacheKey(query);
  const cached = cache.get(key);
  
  if (cached && isCacheValid(cached.timestamp)) {
    console.log('Cache hit for query data:', key);
    return cached.data;
  }
  
  if (cached) {
    console.log('Cache expired for query data:', key);
    cache.delete(key);
  }
  
  return null;
}

// Cache query data
export function cacheQueryData(query: Query, data: any): void {
  const key = generateQueryCacheKey(query);
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
  console.log('Cached query data:', key);
}

// Clear all cache
export function clearCache(): void {
  cache.clear();
  console.log('Cache cleared');
}

// Clear expired cache entries
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (!isCacheValid(value.timestamp)) {
      cache.delete(key);
    }
  }
  console.log('Expired cache entries cleared');
}

// Get cache stats for debugging
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}
