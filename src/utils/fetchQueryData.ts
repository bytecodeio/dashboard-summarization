import { Query } from '../types';
import { getCachedQueryData, cacheQueryData } from './caching';

export const fetchQueryData = async (queries: Query[], core40SDK: any): Promise<any[]> => {
  console.log('fetchQueryData queries', queries);
  
  const queryPromises = queries.map(async (query) => {
    try {
      // Check cache first
      const cachedData = getCachedQueryData(query);
      if (cachedData) {
        console.log('Using cached query data for:', query.title);
        return cachedData;
      }
      
      // Fetch from API if not cached
      console.log('Fetching query data from API for:', query.title);
      const response = await core40SDK.ok(core40SDK.run_inline_query({
        body: query.queryBody,
        result_format: 'json'
      }));
      
      const result = { ...query, queryData: response };
      
      // Cache the result
      cacheQueryData(query, result);
      
      console.log('query data response:', response);
      return result;
    } catch (error) {
      console.error('Error fetching query data:', error);
      return null;
    }
  });

  const queryResults = await Promise.all(queryPromises);
  console.log('fetchQueryData queryResults', queryResults);
  return queryResults.filter(result => result !== null);
};