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
import { generateFinalSummary } from '../utils/generateFinalSummary'
import { generateQuerySuggestions } from '../utils/generateQuerySuggestions'
import { QuerySuggestions } from './QuerySuggestions'

export const DashboardSummarization: React.FC = () => {
  const { extensionSDK, tileHostData, core40SDK, lookerHostData } = useContext(ExtensionContext) as ExtensionContextData
  const { dashboardFilters: tileDashboardFilters, dashboardId: tileDashboardId } = tileHostData
  const [dashboardMetadata, setDashboardMetadata] = useState<DashboardMetadata>({ dashboardFilters: {}, dashboardId: '', queries: [], description: '' })
  const [loadingDashboardMetadata, setLoadingDashboardMetadata] = useState<boolean>(false)
  const [querySummaries, setQuerySummaries] = useState<any[]>([])
  const [queryResults, setQueryResults] = useState<any[]>([])
  const [nextStepsInstructions, setNextStepsInstructions] = useState<string>('');
  const [dashboardId, setDashboardId] = useState<string>('');
  const [showIntermediateResults, setShowIntermediateResults] = useState(true);
  const { data, setData, formattedData, setFormattedData, setQuerySuggestions, info, setInfo, message, setMessage, setDashboardURL } = useContext(SummaryDataContext) as SummaryDataContextType
  const [loading, setLoading] = useState(false)
  const workspaceOauth = useWorkspaceOauth()
  const slackOauth = useSlackOauth()

  const hostContext = lookerHostData?.route || ''
  const urlPath = hostContext.split('?')[0].split('/') || []
  const urlDashboardId = urlPath[urlPath.length - 1]
  const filterPart = hostContext.split('?')[1] || ''
  const urlParams = new URLSearchParams(filterPart)
  const urlDashboardFilters: Filters = Object.fromEntries(urlParams.entries())
  const newDashboardId = urlDashboardId === 'extension.loader' ? tileDashboardId : urlDashboardId
  const dashboardFilters = Object.keys(tileDashboardFilters || {}).length === 0 ? urlDashboardFilters : tileDashboardFilters || {}

  useEffect(() => {
    if (tileDashboardId !== '' && tileDashboardId !== dashboardId) {
      const newDashboardId = urlDashboardId === 'extension.loader' ? tileDashboardId : urlDashboardId
      setDashboardId(String(newDashboardId))

    }
  }, [tileDashboardId, dashboardId, setDashboardId])

  // const restfulService = process.env.RESTFUL_WEBSERVICE || ''
  const restfulService = 'https://restful-service-730192175971.us-central1.run.app'
  useEffect(() => {
    if (tileHostData.dashboardRunState === 'RUNNING') {
      setData([])
      setLoading(false)
    }
  }, [tileHostData.dashboardRunState, setData, setLoading])

  // Fetch and set the metadata for the dashboard
  const fetchQueryMetadata = useCallback(async () => {
    if (dashboardId) {
      console.log('fetching query metadata for dashboard:', dashboardId);
      setLoadingDashboardMetadata(true)
      const { description, queries } = await fetchDashboardDetails(dashboardId, core40SDK, extensionSDK, dashboardFilters)
      if (!loadingDashboardMetadata) {
        await extensionSDK.localStorageSetItem(`${dashboardId}:${JSON.stringify(dashboardFilters)}`, JSON.stringify({ dashboardFilters, dashboardId, queries, description }))
        setDashboardMetadata({ dashboardFilters, dashboardId, queries, description })
      }
    }
  }, [dashboardId, dashboardFilters, core40SDK, extensionSDK, setLoadingDashboardMetadata, setMessage, setDashboardMetadata]);

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
    if (dashboardMetadata.dashboardId === '') {
      setDashboardURL(extensionSDK.lookerHostData?.hostUrl + "/embed/dashboards/" + dashboardId)
      fetchQueryMetadata()
    }
  }, [fetchQueryMetadata, dashboardMetadata, dashboardId, dashboardFilters, extensionSDK, setDashboardURL, setLoadingDashboardMetadata, setMessage, setDashboardMetadata]);

  // Generate final summary
  const generateSummary = async (querySummaries: QuerySummary[], queryResults: any[]) => {
    console.log('generateSummary querySummaries based on results:',queryResults);
    await generateFinalSummary(queryResults, querySummaries, restfulService, extensionSDK, setFormattedData, nextStepsInstructions);
  };

  // Generate query suggestions
  const generateSuggestions = async (querySummaries: QuerySummary[], queryResults: any[]) => {
    await generateQuerySuggestions(querySummaries, queryResults, restfulService, extensionSDK, setQuerySuggestions, nextStepsInstructions);
  };

// When the final resutls come in at first, hide the intermediat results
  useEffect(() => {
    if (formattedData.length > 0) {
      setShowIntermediateResults(false)
    }
  }, [formattedData])

  // The explore is used in the link to explore assistant app, and is assigned based on the first query in the dashboard.
  const explore = dashboardMetadata?.queries[0]?.queryBody?.view

  return (
    <div className="dashboard-summarization">
      {message && (
        <div className="message" style={{ top: info ? document.documentElement.scrollTop || document.body.scrollTop : -100 }}>
          {message}
        </div>
      )}
      <div >
        {!loading && formattedData.length === 0 && querySummaries.length === 0 && (
          <div>
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '1.2rem', opacity: '1', width: 'auto' }}>Dashboard Summarization</div>
              <div style={{ fontSize: '0.9rem', opacity: '0.8', width: '60%' }}>Looker + Vertex AI</div>
            </div>
            <div style={{ width: '100%', marginTop: '1rem' }}>
              <form onSubmit={(e) => { e.preventDefault(); setLoading(true); }}>
                <label>
                  <div style={{ fontSize: '1.2rem', opacity: '1', width: 'auto' }}>Next Steps Instructions:</div>
                  <div style={{ fontSize: '0.9rem', opacity: '0.8', width: 'auto' }}>Please provide business context for what recommendations you hope to have, and what you seek to acheive from the dashboard summary.</div>
                  <textarea
                    value={nextStepsInstructions}
                    onChange={(e) => setNextStepsInstructions(e.target.value)}
                    rows={6}
                    cols={50}
                  />
                </label>
                <div><button
                  className="button"
                  style={{ lineHeight: "20px", padding: "6px 16px" }}
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const newQuerySummaries = await collateSummaries(queryResults, restfulService, extensionSDK, dashboardMetadata, setQuerySummaries);
                      console.log('querySummaries:', newQuerySummaries);
                      generateSummary(newQuerySummaries, queryResults);
                      generateSuggestions(newQuerySummaries, queryResults);
                    } catch (error) {
                      console.error('Error generating summaries and suggestions:', error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {loading ? "Generating" : "Generate"}{" "}
                  <img
                    style={{
                      lineHeight: "20px",
                      padding: "10px 20px",
                      marginTop: "1rem",
                      backgroundColor: "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontSize: "1rem",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                    }}
                    src="https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/summarize_auto/default/20px.svg"
                  />
                </button>
                </div>
              </form>
            </div>
          </div>
        )}
         {showIntermediateResults && (
          
          <div className="intermediate-results">
            <h3>Intermediate Results</h3>
            <div className="summary-scroll">
              <MarkdownComponent data={querySummaries} />
            </div>
            <button onClick={() => setShowIntermediateResults(!showIntermediateResults)} className='button' style={{ borderRadius: '5%', padding: '0.5rem' }}>
              {showIntermediateResults ? "Hide Intermediate Results" : "Show Intermediate Results"}
            </button>
        
          </div>
        )}

        {formattedData.length > 0 && (
          <div><div className="formatted-results">
              <div className="summary-scroll">
              <MarkdownComponent data={[formattedData]} />
            </div>
          </div>
        <QuerySuggestions explore={explore} />
        <button
          className="button"
          style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
          onClick={() => {
            setQuerySummaries([]);
            setFormattedData([]);
            setNextStepsInstructions('');
          }}
        >
          Start Another Summary
        </button>
        </div>
      )}
      </div>
      <div className="actions">
        <div className='layoutBottom'>
          <span style={{ fontSize: '0.9rem', opacity: !loading ? 0.8 : 0.2, width: '30%' }}>Actions</span>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', width: '70%', opacity: !loading ? 1 : 0.2 }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', opacity: !loading ? 0.8 : 0.2, paddingRight: '0.8rem' }}>Export</span>
              <button disabled={loading || data.length <= 0} onClick={workspaceOauth} className='button' style={{ borderRadius: '50%', padding: '0.5rem' }}>
                <img height={20} width={20} src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Google_Chat_icon_%282020%29.svg/1024px-Google_Chat_icon_%282020%29.svg.png" />
              </button>
              <button disabled={loading || data.length <= 0} onClick={slackOauth} className='button' style={{ borderRadius: '50%', padding: '0.5rem', marginLeft: '2vw' }}>
                <img height={20} width={20} src="https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
