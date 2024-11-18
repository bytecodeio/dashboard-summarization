import { Query } from '../types';

export const fetchQueryData = async (query: Query, core40SDK: any): Promise<any> => {
  let queryDataResponse
  try {
    const response = await core40SDK.ok(core40SDK.run_inline_query({
      body: query.queryBody,
      result_format: 'json'
    }));
    console.log('query data response:',response)
    queryDataResponse = { ...query, queryData: response };
  } catch (error) {
    console.error('Error fetching query data:', error);
    queryDataResponse = null;
  }

  console.log('fetchQueryData queryResults', queryDataResponse);
  return queryDataResponse;
};