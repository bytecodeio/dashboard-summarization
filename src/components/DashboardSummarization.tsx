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
  const [loadingDashboardMetadata, setLoadingDashboardMetadata] = useState<boolean>(false)
  const [querySummaries, setQuerySummaries] = useState<any[]>([])
  const [queryResults, setQueryResults] = useState<any[]>([])
  const { data, setData, formattedData, setFormattedData, setQuerySuggestions, info, setInfo, message, setMessage, setDashboardURL } = useContext(SummaryDataContext) as SummaryDataContextType
  const [loading, setLoading] = useState(false)
  const workspaceOauth = useWorkspaceOauth()
  const slackOauth = useSlackOauth()
  const [temporaryPrompt, setTemporaryPrompt] = useState<string>('')
  const [hasRun, setHasRun] = useState(false);

  const hostContext = lookerHostData?.route || ''
  const filterPart = hostContext.split('?')[1] || ''
  const urlParams = new URLSearchParams(filterPart)
  const urlDashboardFilters: Filters = Object.fromEntries(urlParams.entries())
  const dashboardFilters = Object.keys(tileDashboardFilters || {}).length === 0 ? urlDashboardFilters : tileDashboardFilters || {}

  useEffect(() => {
    if (tileDashboardId) {
      setDashboardURL(extensionSDK.lookerHostData?.hostUrl + "/embed/dashboards/" + tileDashboardId)
    }
  }, [tileDashboardId, extensionSDK, setDashboardURL])

  // const restfulService = process.env.RESTFUL_WEBSERVICE || ''
  const restfulService = 'https://restfulserviceimage-1098454044038.us-central1.run.app'
  useEffect(() => {
    if (tileHostData.dashboardRunState === 'RUNNING' && !hasRun) {
      setData([])
      setLoading(false)
      setHasRun(true);
    } else if (tileHostData.dashboardRunState !== 'RUNNING') {
      setHasRun(false);
    }
  }, [tileHostData.dashboardRunState, setData, setLoading, hasRun]);

  // Fetch and set the metadata for the dashboard
  const fetchQueryMetadata = useCallback(async () => {
    console.log('fetching query metadata for dashboard:', tileDashboardId);
    if (tileDashboardId) {
      setLoadingDashboardMetadata(true)
      const dashboardDetails = await fetchDashboardDetails(tileDashboardId, core40SDK, extensionSDK, dashboardFilters, tileHostData)
      console.log('dashboardDetails:', dashboardDetails);
      const { description, queries, prompt } = dashboardDetails
      if (!loadingDashboardMetadata) {
        await extensionSDK.localStorageSetItem((`${tileDashboardId}:${JSON.stringify(dashboardFilters)}`), JSON.stringify({ dashboardFilters, dashboardId: tileDashboardId, queries, description }))
        setDashboardMetadata({ dashboardFilters, dashboardId: tileDashboardId, queries, description, prompt })
      }
    }
  }, [tileDashboardId, dashboardFilters, core40SDK, extensionSDK, setLoadingDashboardMetadata, setMessage, setDashboardMetadata]);

  // Update the message when the dashboard metadata is loaded
  useEffect(() => {
    if (message && message.includes('Loaded Dashboard Metadata') || message.includes("Google Chat") || message.includes("Slack")) {
      setTimeout(() => {
        setInfo(false)
      }, 1000)
    }
  }, [message])

  // Run each query in the dashboard to get query data
  useEffect(() => {
    if (dashboardMetadata.queries.length <= 0) return;
    console.log('fetching query results for metadata:', dashboardMetadata);
    const fetchQueryResults = async () => {
      if (dashboardMetadata.queries.length > 0) {
        const results = await fetchQueryData(dashboardMetadata.queries, core40SDK);
        setQueryResults(results);
      }
    };

    fetchQueryResults();
  }, [dashboardMetadata.queries, core40SDK]);

  // Fetch dashboard metadata, including description and queries
  useEffect(() => {
    if (dashboardMetadata.dashboardId === '' || hasRun===false) {
      fetchQueryMetadata()
    }
  }, [fetchQueryMetadata, dashboardMetadata, tileDashboardId, dashboardFilters, extensionSDK, tileHostData.dashboardRunState, hasRun, setLoadingDashboardMetadata, setMessage, setDashboardMetadata]);


  // The explore is used in the link to explore assistant app, and is assigned based on the first query in the dashboard.
  const explore = dashboardMetadata?.queries[0]?.queryBody?.view
console.log('dashboardMetadata:', dashboardMetadata);
  const prompt = dashboardMetadata?.prompt || 'test'
  // || "You are an analytics agent. Please summarize the 24 factors that went into this Market Score."
  const sharedContext = dashboardMetadata

  // Automatically fetch query summaries and generate the 24 factors summary
  useEffect(() => {
    const generateSummary = async () => {
      setLoading(true);
      try {
        await generate24FactorSummary(queryResults, extensionSDK, setFormattedData, dashboardMetadata.prompt || '', sharedContext);
      } catch (error) {
        console.error('Error generating summaries and suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    if (queryResults.length > 0 && dashboardMetadata.prompt) {
      generateSummary();
    }
  }, [queryResults, restfulService, extensionSDK, dashboardMetadata.prompt, setFormattedData, sharedContext]);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setDashboardMetadata(prev => ({ ...prev, prompt: temporaryPrompt }))
    setTemporaryPrompt('')
  }

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
