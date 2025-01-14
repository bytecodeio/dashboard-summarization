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

import React, { useCallback, useContext, useEffect, useState } from 'react'
import { ExtensionContext, ExtensionContextData } from '@looker/extension-sdk-react'
import { Filters } from '@looker/extension-sdk'
import { GenerativeLogo, LandingPage } from './LandingPage'
import MarkdownComponent from './MarkdownComponent'
import useWorkspaceOauth from '../hooks/useWorkspaceOauth'
import { SummaryDataContext } from '../contexts/SummaryDataContext'
import useSlackOauth from '../hooks/useSlackOauth'
import { fetchDashboardDetails } from '../utils/fetchDashboardDetails'
import { DashboardMetadata, Query, QuerySummary, SummaryDataContextType } from '../types'
import { fetchQueryData } from '../utils/fetchQueryData'
import { collateSummaries } from '../utils/collateSummaries'
import { generate24FactorSummary } from '../utils/generate24FactorSummary'
import { DashboardEmbed } from './DashboardEmbed'
import lensLogo from '../assets/lens.png'
export const DashboardSummarization: React.FC = () => {
  const { extensionSDK, tileHostData, core40SDK, lookerHostData } = useContext(ExtensionContext) as ExtensionContextData
  const { dashboardFilters: tileDashboardFilters, dashboardId: tileDashboardId } = tileHostData
  const [dashboardMetadata, setDashboardMetadata] = useState<DashboardMetadata>({ dashboardFilters: {}, dashboardId: '', queries: [], description: '' , prompt: ''})
  const [prompt, setPrompt] = useState<string>('')
  const { data, setData, formattedData, setFormattedData, setQuerySuggestions, info, setInfo, message, setMessage, setDashboardURL } = useContext(SummaryDataContext) as SummaryDataContextType
  const [temporaryPrompt, setTemporaryPrompt] = useState<string>('')
  const [shouldGenerateSummary, setShouldGenerateSummary] = useState(false);

  const hostContext = lookerHostData?.route || ''
  const filterPart = hostContext.split('?')[1] || ''
  const urlParams = new URLSearchParams(filterPart)
  const urlDashboardFilters: Filters = Object.fromEntries(urlParams.entries())
  const dashboardFilters = Object.keys(tileDashboardFilters || {}).length === 0 ? urlDashboardFilters : tileDashboardFilters || {}

  const initializeDashboard = useCallback(async () => {

    let newDashboardMetadata: DashboardMetadata | null  = null
    if (tileDashboardId ) {
      console.log('fetching query metadata for dashboard:', tileDashboardId);
      
      const dashboardDetails = await fetchDashboardDetails(tileDashboardId, core40SDK, extensionSDK, dashboardFilters, tileHostData);
      console.log('dashboardDetails:', dashboardDetails);
      const { description, queries, prompt } = dashboardDetails;
      setDashboardMetadata({ dashboardFilters, dashboardId: tileDashboardId, queries, description, prompt });  
      newDashboardMetadata = { dashboardFilters, dashboardId: tileDashboardId, queries, description, prompt };
    }
    const marketDashboardId = newDashboardMetadata && newDashboardMetadata.description ? newDashboardMetadata.description.split('Markets:')[1] : '';
    let marketDashboard: DashboardMetadata | null = null;
    let marketData: any = {};
    if (marketDashboardId ) {
      marketDashboard = await fetchDashboardDetails(marketDashboardId, core40SDK, extensionSDK, dashboardFilters, tileHostData);
      console.log('marketDashboard:', marketDashboard);
      if (marketDashboard.queries.length > 0) marketData = await fetchQueryData(marketDashboard.queries, core40SDK);
    }

    if (newDashboardMetadata && newDashboardMetadata.queries.length > 0) {
      console.log('fetching query results for metadata:', newDashboardMetadata);
      const results = await fetchQueryData(newDashboardMetadata.queries, core40SDK);

      if (results.length > 0 && (newDashboardMetadata?.prompt || prompt)) {
        try {
          await generate24FactorSummary(results, extensionSDK, setFormattedData, newDashboardMetadata?.prompt || prompt, newDashboardMetadata, marketData || {});
        } catch (error) {
          console.error('Error generating summaries and suggestions:', error);
        } 
      }
    }
  }, [tileDashboardId, tileHostData.dashboardRunState, extensionSDK, core40SDK, prompt, setDashboardMetadata, setFormattedData, dashboardFilters, tileHostData]);

  useEffect(() => {
    if (tileDashboardId)
    initializeDashboard();
  }, [tileHostData.dashboardRunState, prompt, tileDashboardId, extensionSDK]);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDashboardMetadata(prev => ({ ...prev, prompt: temporaryPrompt }));
    setPrompt(temporaryPrompt);
    setTemporaryPrompt('');
  };

  return (
    <div className="dashboard-summarization">
      {message && (
        <div className="message" style={{ top: info ? document.documentElement.scrollTop || document.body.scrollTop : -100 }}>
          {message}
        </div>
      )}
      {!dashboardMetadata.prompt && (
        <form onSubmit={handlePromptSubmit} style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', paddingLeft: '1rem' }}>
          <span role="img" aria-label="Generative AI Logo" style={{ marginRight: '0.5rem', fontSize: '24px' }}>🤖</span>
          <input
            type="text"
            value={temporaryPrompt}
            onChange={(e) => setTemporaryPrompt(e.target.value)}
            placeholder="Enter your prompt"
            style={{ flex: 1, padding: '0.5rem' }}
          />
          <button type="submit" style={{ marginLeft: '0.5rem', padding: '0.5rem 1rem' }}>Submit</button>
        </form>
      )}
      <div>
        <div style={{ marginBottom: '1rem', paddingLeft: '1rem' }}>
            <MarkdownComponent data={[formattedData]} />
          </div>
      </div>
    </div>
  );
}
