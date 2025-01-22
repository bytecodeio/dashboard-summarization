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

import { ExtensionContext, ExtensionContext40, ExtensionContextData } from '@looker/extension-sdk-react'
import { Filters } from '@looker/extension-sdk'
import MarkdownComponent from './MarkdownComponent'
import { SummaryDataContext } from '../contexts/SummaryDataContext'
import { fetchDashboardDetails } from '../utils/fetchDashboardDetails'
import { DashboardMetadata, Query, QuerySummary, SummaryDataContextType } from '../types'
import { fetchQueryData } from '../utils/fetchQueryData'
import { generate24FactorSummary } from '../utils/generate24FactorSummary'
import md5 from 'md5'

export const DashboardSummarization: React.FC = () => {
  const { extensionSDK, tileHostData, core40SDK, lookerHostData } = useContext(ExtensionContext) as ExtensionContextData
  const { dashboardFilters: tileDashboardFilters, dashboardId: tileDashboardId } = tileHostData
  const [dashboardMetadata, setDashboardMetadata] = useState<DashboardMetadata>({ dashboardFilters: {}, dashboardId: '', queries: [], description: '', prompt: '' })
  const [prompt, setPrompt] = useState<string>('')
  const { data, setData, formattedData, setFormattedData, setQuerySuggestions, info, setInfo, message, setMessage, setDashboardURL } = useContext(SummaryDataContext) as SummaryDataContextType
  const [temporaryPrompt, setTemporaryPrompt] = useState<string>('')
  const [shouldGenerateSummary, setShouldGenerateSummary] = useState(false);

  const hostContext = lookerHostData?.route || ''
  const filterPart = hostContext.split('?')[1] || ''
  const urlParams = new URLSearchParams(filterPart)
  const urlDashboardFilters: Filters = Object.fromEntries(urlParams.entries())
  const dashboardFilters = Object.keys(tileDashboardFilters || {}).length === 0 ? urlDashboardFilters : tileDashboardFilters || {}

  const updateContext = async (key: string, value: Object, currentContext: any) => {
    if (!currentContext) {
      console.log('No context data found, creating new context data')
      currentContext = {}
    }
    currentContext[key] = value
    await extensionSDK.saveContextData(currentContext)
  }

  const generateContextKey = (filters: Filters, prompt: string) => {
    return md5(JSON.stringify(filters) + prompt)
  }

  const initializeDashboard = useCallback(async () => {

    let newDashboardMetadata: DashboardMetadata | null = null
    let loadFromContext = false

    let savedContext = await extensionSDK.getContextData()
    let contextKey = ''
    if (tileDashboardId) {
      const dashboardDetails = await fetchDashboardDetails(tileDashboardId, core40SDK, extensionSDK, dashboardFilters, tileHostData);
      const { description, queries, prompt } = dashboardDetails;
      setDashboardMetadata({ dashboardFilters, dashboardId: tileDashboardId, queries, description, prompt });
      newDashboardMetadata = { dashboardFilters, dashboardId: tileDashboardId, queries, description, prompt };
      // log more details
      contextKey = generateContextKey(dashboardFilters, prompt || '')
      if (savedContext) {
        if (savedContext[contextKey]) {
          setFormattedData(savedContext[contextKey])
          loadFromContext = true
        }
      }
    }
    const marketDashboardId = newDashboardMetadata && newDashboardMetadata.description ? newDashboardMetadata.description.split('Markets:')[1] : '';
    let marketDashboard: DashboardMetadata | null = null;
    let marketData: any = {};
    if (marketDashboardId) {
      marketDashboard = await fetchDashboardDetails(marketDashboardId, core40SDK, extensionSDK, dashboardFilters, tileHostData);
      if (marketDashboard.queries.length > 0) marketData = await fetchQueryData(marketDashboard.queries, core40SDK);
    }

    if (newDashboardMetadata && newDashboardMetadata.queries.length > 0) {
      const results = await fetchQueryData(newDashboardMetadata.queries, core40SDK);

      if (!loadFromContext && results.length > 0 && (newDashboardMetadata?.prompt || prompt)) {
        try {
          const newSummary = await generate24FactorSummary(results, extensionSDK, setFormattedData, newDashboardMetadata?.prompt || prompt, newDashboardMetadata, marketData || {})
          await updateContext(contextKey, newSummary || {}, savedContext)
          console.log('updated app context with key:', contextKey)
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
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginRight: '0.5rem' }}>
            <circle cx="20" cy="20" r="20" fill="url(#paint0_linear_5319_50439)" />
            <path d="M30.2238 24.2925C26.0857 24.2925 22.7196 20.9074 22.7196 16.7461C22.7196 16.5857 22.5904 16.4558 22.4309 16.4558C22.2715 16.4558 22.1423 16.5857 22.1423 16.7461C22.1423 20.9074 18.7761 24.2925 14.6381 24.2925C14.4786 24.2925 14.3494 24.4224 14.3494 24.5828C14.3494 24.7431 14.4786 24.8731 14.6381 24.8731C18.7761 24.8731 22.1423 28.2581 22.1423 32.4195C22.1423 32.5798 22.2715 32.7098 22.4309 32.7098C22.5904 32.7098 22.7196 32.5798 22.7196 32.4195C22.7196 28.2581 26.0857 24.8731 30.2238 24.8731C30.3832 24.8731 30.5124 24.7431 30.5124 24.5828C30.5124 24.4224 30.3832 24.2925 30.2238 24.2925Z" fill="white" />
            <path d="M22.9211 9.88218C21.574 9.88218 20.4782 8.78027 20.4782 7.4255C20.4782 7.37328 20.4361 7.33093 20.3842 7.33093C20.3323 7.33093 20.2901 7.37328 20.2901 7.4255C20.2901 8.78027 19.1944 9.88218 17.8472 9.88218C17.7953 9.88218 17.7532 9.92453 17.7532 9.97675C17.7532 10.029 17.7953 10.0713 17.8472 10.0713C19.1944 10.0713 20.2901 11.1732 20.2901 12.528C20.2901 12.5802 20.3323 12.6226 20.3842 12.6226C20.4361 12.6226 20.4782 12.5802 20.4782 12.528C20.4782 11.1732 21.574 10.0713 22.9211 10.0713C22.9731 10.0713 23.0152 10.029 23.0152 9.97675C23.0152 9.92453 22.9731 9.88218 22.9211 9.88218Z" fill="white" />
            <path d="M19.0026 16.2691C16.5417 16.2691 14.5399 14.2561 14.5399 11.7813C14.5399 11.6859 14.4631 11.6086 14.3682 11.6086C14.2734 11.6086 14.1965 11.6859 14.1965 11.7813C14.1965 14.2561 12.1947 16.2691 9.73379 16.2691C9.63894 16.2691 9.56207 16.3464 9.56207 16.4418C9.56207 16.5372 9.63894 16.6145 9.73379 16.6145C12.1947 16.6145 14.1965 18.6276 14.1965 21.1023C14.1965 21.1977 14.2734 21.275 14.3682 21.275C14.4631 21.275 14.5399 21.1977 14.5399 21.1023C14.5399 18.6276 16.5417 16.6145 19.0026 16.6145C19.0975 16.6145 19.1743 16.5372 19.1743 16.4418C19.1743 16.3464 19.0975 16.2691 19.0026 16.2691Z" fill="white" />
            <defs>
              <linearGradient id="paint0_linear_5319_50439" x1="7.5" y1="5.5" x2="54" y2="63.5" gradientUnits="userSpaceOnUse">
                <stop stop-color="#70D8C3" />
                <stop offset="0.844127" stop-color="#062679" />
              </linearGradient>
            </defs>
          </svg>
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
        <div style={{ marginBottom: '1rem', paddingLeft: '1rem', marginLeft: '1rem' }}>
          <MarkdownComponent data={[formattedData]} />
        </div>
      </div>
    </div>
  );
}
