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

import React, { useCallback, useContext, useEffect, useState, useRef } from 'react'
import { ExtensionContext, ExtensionContext40, ExtensionContextData } from '@looker/extension-sdk-react'
import { Filters } from '@looker/extension-sdk'
import MarkdownComponent from './MarkdownComponent'
import { SummaryDataContext } from '../contexts/SummaryDataContext'
import { useSettings } from '../contexts/SettingsContext' // Import settings context
import { fetchDashboardDetails } from '../utils/fetchDashboardDetails'
import { DashboardMetadata, Query, QuerySummary, SummaryDataContextType } from '../types'
import { fetchQueryData } from '../utils/fetchQueryData'
import { generateArbitraryResponse } from '../utils/generateArbitraryResponse'
import md5 from 'md5'
import './Spinner.css' // Import custom spinner CSS
import { generateFinalSummary } from '../utils/generateFinalSummary'
import { useAutoOAuth } from '../utils/useAutoOAuth'
import SettingsModal from './SettingsModal'

export const DashboardSummarization: React.FC = () => {
  const { extensionSDK, tileHostData, core40SDK, lookerHostData } = useContext(ExtensionContext) as ExtensionContextData
  const { dashboardFilters: tileDashboardFilters, dashboardId: tileDashboardId } = tileHostData
  const [dashboardMetadata, setDashboardMetadata] = useState<DashboardMetadata>({ dashboardFilters: {}, dashboardId: '', queries: [], description: '', prompt: '' })
  const [prompt, setPrompt] = useState<string | null>(null)
  const { data, setData, formattedData, setFormattedData, setQuerySuggestions, info, setInfo, message, setMessage, setDashboardURL } = useContext(SummaryDataContext) as SummaryDataContextType
  const [temporaryPrompt, setTemporaryPrompt] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); 
  
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [marketInfo, setMarketInfo] = useState<{ data: any, dashboard: DashboardMetadata | null }>({ data: {}, dashboard: null });
  
  // Get settings from context
  const { settings } = useSettings();

   useEffect(() => {
    extensionSDK.rendered()
  }, [])

  // Use refs to track initialization state and prevent duplicate calls
  const initializationRef = useRef<{ 
    dashboardId: string | null, 
    hasInitialized: boolean,
    isInitializing: boolean,
    filterHash: string | null
  }>({ dashboardId: null, hasInitialized: false, isInitializing: false, filterHash: null });
  
  // Add a ref to track if queries are being fetched
  const queryFetchRef = useRef<Map<string, Promise<any>>>(new Map());
  
  // Use the OAuth hook with auto-check enabled but more safely now
  const { isAuthenticating, oauthToken, initiateAuth } = useAutoOAuth(true);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // More robust permission checking should be done here if available
        // For now, successfully fetching 'me' implies sufficient rights to see settings
        await core40SDK.ok(core40SDK.me());
        setIsAdmin(true); 
        console.log('Admin status set to true');
      } catch (error) {
        console.error('Error checking admin status or insufficient permissions:', error);
        setIsAdmin(false);
        console.log('Admin status set to false due to error or insufficient permissions');
      }
    };
    checkAdminStatus();
  }, [core40SDK]);

  // Step 1: Fetch essential dashboard and query data
  const fetchEssentialData = useCallback(async () => {
    if (!tileDashboardId) {
      console.log('fetchEssentialData: No tileDashboardId, skipping.');
      return;
    }
    // Don't proceed if we're authenticating (relevant if auth affects data fetching ability)
    // if (isAuthenticating) {
    //   console.log('fetchEssentialData: OAuth authentication in progress, delaying data fetching');
    //   return;
    // }

    const filterHash = JSON.stringify(tileDashboardFilters || {});

    if (initializationRef.current.isInitializing) {
      console.log('fetchEssentialData: Already initializing, skipping.');
      return;
    }

    if (initializationRef.current.dashboardId === tileDashboardId &&
        initializationRef.current.filterHash === filterHash &&
        initializationRef.current.hasInitialized) {
      console.log('fetchEssentialData: Data already fetched for this configuration, skipping.');
      return;
    }

    initializationRef.current.isInitializing = true;
    initializationRef.current.dashboardId = tileDashboardId;
    initializationRef.current.filterHash = filterHash;
    console.log('fetchEssentialData: Starting data fetch for ID:', tileDashboardId);
    setIsLoading(true);

    try {
      const currentDashboardFilters = tileDashboardFilters || {};
      const details = await fetchDashboardDetails(tileDashboardId, core40SDK, extensionSDK, currentDashboardFilters, tileHostData);
      const currentDashboardMetadata: DashboardMetadata = { 
        dashboardFilters: currentDashboardFilters, 
        dashboardId: tileDashboardId, 
        queries: details.queries, 
        description: details.description, 
        prompt: details.prompt 
      };
      setDashboardMetadata(currentDashboardMetadata);
      if (!prompt && details.prompt) { // Set initial prompt from dashboard if not already set by user
        setPrompt(details.prompt);
      }

      // Fetch market data if applicable
      const marketDashboardId = details.description ? details.description.split('Dashboard:')[1] : '';
      let fetchedMarketData: any = {};
      let fetchedMarketDashboard: DashboardMetadata | null = null;
      if (marketDashboardId) {
        fetchedMarketDashboard = await fetchDashboardDetails(marketDashboardId, core40SDK, extensionSDK, currentDashboardFilters, tileHostData);
        if (fetchedMarketDashboard && fetchedMarketDashboard.queries.length > 0) {
          fetchedMarketData = await fetchQueryData(fetchedMarketDashboard.queries, core40SDK);
        }
      }
      setMarketInfo({ data: fetchedMarketData, dashboard: fetchedMarketDashboard });

      // Fetch main query data
      if (currentDashboardMetadata.queries.length > 0) {
        const queryKey = JSON.stringify(currentDashboardMetadata.queries.map(q => q.queryBody));
        let results;
        if (queryFetchRef.current.has(queryKey)) {
          results = await queryFetchRef.current.get(queryKey);
        } else {
          const fetchPromise = fetchQueryData(currentDashboardMetadata.queries, core40SDK);
          queryFetchRef.current.set(queryKey, fetchPromise);
          try {
            results = await fetchPromise;
          } finally {
            queryFetchRef.current.delete(queryKey);
          }
        }
        setQueryResults(results);
      } else {
        setQueryResults([]); // No queries, set to empty array
      }
      
      initializationRef.current.hasInitialized = true;
      console.log('fetchEssentialData: Data fetching completed for ID:', tileDashboardId);
    } catch (error) {
      console.error('fetchEssentialData: Error fetching data:', error);
      // Potentially set error state here
    } finally {
      initializationRef.current.isInitializing = false;
      // setIsLoading(false); // Loading will be handled by generation effect or if no generation needed
    }
  }, [tileDashboardId, core40SDK, extensionSDK, tileDashboardFilters, tileHostData, prompt]); // Added prompt here to ensure initial prompt from dashboard is considered

  // useEffect for fetching data
  useEffect(() => {
    const filterHash = JSON.stringify(tileDashboardFilters || {});
    if (initializationRef.current.dashboardId !== tileDashboardId ||
        initializationRef.current.filterHash !== filterHash) {
      console.log('Dashboard ID or filters changed, resetting initialization state for data fetching.');
      initializationRef.current.hasInitialized = false;
      initializationRef.current.isInitializing = false;
      initializationRef.current.dashboardId = null;
      initializationRef.current.filterHash = null;
      queryFetchRef.current.clear();
      setQueryResults(null); // Clear previous results
      setMarketInfo({ data: {}, dashboard: null }); // Clear market info
      setFormattedData(''); // Clear old summary
    }

    if (tileDashboardId) {
      fetchEssentialData();
    }
  }, [tileDashboardId, tileDashboardFilters, fetchEssentialData]);


  // Step 2: useEffect for generating summaries when data or prompt changes
  useEffect(() => {
    const effectivePrompt = prompt || dashboardMetadata.prompt;

    if (!effectivePrompt) {
      console.log('generateSummaryEffect: No prompt available, skipping generation.');
      if (initializationRef.current.hasInitialized && !initializationRef.current.isInitializing) {
         setIsLoading(false); // Stop loading if data is fetched but no prompt
      }
      return;
    }

    if (isAuthenticating) {
      console.log('generateSummaryEffect: OAuth authentication in progress, delaying generation.');
      return;
    }

    if (!oauthToken) {
      console.log('generateSummaryEffect: No OAuth token, skipping generation.');
      // Potentially set a message for the user to authenticate/reload
      setFormattedData("Error: Authentication required. Please ensure you are logged in with Google, or try reloading. If the issue persists, check settings.");
      setIsLoading(false);
      return;
    }

    // Ensure queryResults are loaded (can be an empty array if no queries)
    // and dashboardMetadata is available (even if queries array is empty)
    if (queryResults === null && dashboardMetadata.queries.length > 0) {
        console.log('generateSummaryEffect: Query results not yet available, skipping generation.');
        return;
    }
    
    // If there are no queries, queryResults will be an empty array.
    // dashboardMetadata should always be available if fetchEssentialData ran.
    if (!dashboardMetadata.dashboardId) {
        console.log('generateSummaryEffect: Dashboard metadata not yet available, skipping generation.');
        return;
    }

    console.log('generateSummaryEffect: Attempting to generate summary. Effective prompt:', effectivePrompt);
    setIsLoading(true);

    // Get Vertex settings from context
    const vertexSettings = {
      vertexProject: settings.vertexProject,
      vertexLocation: settings.vertexLocation,
      vertexModel: settings.vertexModel
    };

    const generationData = queryResults || []; // Use empty array if queryResults is null but dashboard has no queries

    generateArbitraryResponse(
      generationData,
      extensionSDK,
      '', // No restful service
      setFormattedData,
      effectivePrompt,
      dashboardMetadata,
      marketInfo.data || {},
      oauthToken, // Pass the OAuth token from useAutoOAuth hook
      vertexSettings // Pass vertex settings
    ).then(() => {
      console.log('generateSummaryEffect: Summary generation completed.');
    }).catch(error => {
      console.error('generateSummaryEffect: Error generating summary:', error);
      setFormattedData(`Error generating summary: ${error.message}`);
    }).finally(() => {
      setIsLoading(false);
    });

  }, [queryResults, dashboardMetadata, prompt, marketInfo, oauthToken, isAuthenticating, extensionSDK, setFormattedData, settings]);


  const handlePromptSubmit = (e: React.FormEvent) => {
    console.log('Prompt submitted:', temporaryPrompt);
    e.preventDefault();
    setDashboardMetadata((prev: DashboardMetadata) => ({ ...prev, prompt: temporaryPrompt }));
    setPrompt(temporaryPrompt);
    setTemporaryPrompt('');
  };

  // console.log('Rendering DashboardSummarization, isAdmin:', isAdmin, 'isSettingsOpen:', isSettingsOpen, 'current prompt state:', prompt);

  return (
    <div className="dashboard-summarization">
      {message && (
        <div className="message" style={{ top: info ? document.documentElement.scrollTop || document.body.scrollTop : -100 }}>
          {message}
        </div>
      )}
      
      <div className="controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid #eee' }}>
        {!dashboardMetadata.prompt && (
          <form onSubmit={handlePromptSubmit} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginRight: '0.5rem' }}>
              <circle cx="20" cy="20" r="20" fill="url(#paint0_linear_5319_50439)" />
              <path d="M30.2238 24.2925C26.0857 24.2925 22.7196 20.9074 22.7196 16.7461C22.7196 16.5857 22.5904 16.4558 22.4309 16.4558C22.2715 16.4558 22.1423 16.5857 22.1423 16.7461C22.1423 20.9074 18.7761 24.2925 14.6381 24.2925C14.4786 24.2925 14.3494 24.4224 14.3494 24.5828C14.3494 24.7431 14.4786 24.8731 14.6381 24.8731C18.7761 24.8731 22.1423 28.2581 22.1423 32.4195C22.1423 32.5798 22.2715 32.7098 22.4309 32.7098C22.5904 32.7098 22.7196 32.5798 22.7196 32.4195C22.7196 28.2581 26.0857 24.8731 30.2238 24.8731C30.3832 24.8731 30.5124 24.7431 30.5124 24.5828C30.5124 24.4224 30.3832 24.2925 30.2238 24.2925Z" fill="white" />
              <path d="M22.9211 9.88218C21.574 9.88218 20.4782 8.78027 20.4782 7.4255C20.4782 7.37328 20.4361 7.33093 20.3842 7.33093C20.3323 7.33093 20.2901 7.37328 20.2901 7.4255C20.2901 8.78027 19.1944 9.88218 17.8472 9.88218C17.7953 9.88218 17.7532 9.92453 17.7532 9.97675C17.7532 10.029 17.7953 10.0713 17.8472 10.0713C19.1944 10.0713 20.2901 11.1732 20.2901 12.528C20.2901 12.5802 20.3323 12.6226 20.3842 12.6226C20.4361 12.6226 20.4782 12.5802 20.4782 12.528C20.4782 11.1732 21.574 10.0713 22.9211 10.0713C22.9731 10.0713 23.0152 10.029 23.0152 9.97675C23.0152 9.92453 22.9731 9.88218 22.9211 9.88218Z" fill="white" />
              <path d="M19.0026 16.2691C16.5417 16.2691 14.5399 14.2561 14.5399 11.7813C14.5399 11.6859 14.4631 11.6086 14.3682 11.6086C14.2734 11.6086 14.1965 11.6859 14.1965 11.7813C14.1965 14.2561 12.1947 16.2691 9.73379 16.2691C9.63894 16.2691 9.56207 16.3464 9.56207 16.4418C9.56207 16.5372 9.63894 16.6145 9.73379 16.6145C12.1947 16.6145 14.1965 18.6276 14.1965 21.1023C14.1965 21.1977 14.2734 21.275 14.3682 21.275C14.4631 21.275 14.5399 21.1977 14.5399 21.1023C14.5399 18.6276 16.5417 16.6145 19.0026 16.6145C19.0975 16.6145 19.1743 16.5372 19.1743 16.4418C19.1743 16.3464 19.0975 16.2691 19.0026 16.2691Z" fill="white" />
              <defs>
                <linearGradient id="paint0_linear_5319_50439" x1="7.5" y1="5.5" x2="54" y2="63.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#70D8C3" />
                  <stop offset="0.844127" stopColor="#062679" />
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
        
        {isAdmin ? (
          <button 
          onClick={() => {
            console.log('Settings button clicked. Current isSettingsOpen:', isSettingsOpen);
            setIsSettingsOpen(true);
            console.log('Settings button clicked. Attempting to set isSettingsOpen to true.');
          }} 
          style={{ 
            marginLeft: dashboardMetadata.prompt ? 'auto' : '1rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ⚙️ Settings
        </button>) : null}
      </div>
      
      {isLoading ? (
        <div className="spinner-container">
          <div className="spinner"></div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '1rem', paddingLeft: '1rem', marginLeft: '1rem' }}>
            <MarkdownComponent data={[formattedData]} />
          </div>
        </div>
      )}
      
      {/* Temporarily disabled due to compilation issues */}
      {isSettingsOpen && (
        <SettingsModal 
          open={isSettingsOpen} 
          onClose={() => {
            console.log('Closing settings modal');
            setIsSettingsOpen(false);
          }} 
          isAdmin={isAdmin}
        />
      )}
      {/*
      {isSettingsOpen && (
        <SettingsModal 
          open={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      )}
      */}
    </div>
  );
}
