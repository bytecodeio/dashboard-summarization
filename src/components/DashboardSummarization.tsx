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
import { fetchDashboardDetails } from '../utils/fetchDashboardDetails'
import { DashboardMetadata, Query, QuerySummary, SummaryDataContextType } from '../types'
import { fetchQueryData } from '../utils/fetchQueryData'
import { generateArbitraryResponse } from '../utils/generateArbitraryResponse'
import md5 from 'md5'
import './Spinner.css' // Import custom spinner CSS
import { generateFinalSummary } from '../utils/generateFinalSummary'
import { useAutoOAuth } from '../utils/useAutoOAuth'
// import SettingsModal from './SettingsModal'

export const DashboardSummarization: React.FC = () => {
  const { extensionSDK, tileHostData, core40SDK, lookerHostData } = useContext(ExtensionContext) as ExtensionContextData
  const { dashboardFilters: tileDashboardFilters, dashboardId: tileDashboardId } = tileHostData
  const [dashboardMetadata, setDashboardMetadata] = useState<DashboardMetadata>({ dashboardFilters: {}, dashboardId: '', queries: [], description: '', prompt: '' })
  const [prompt, setPrompt] = useState<string | null>(null)
  const { data, setData, formattedData, setFormattedData, setQuerySuggestions, info, setInfo, message, setMessage, setDashboardURL } = useContext(SummaryDataContext) as SummaryDataContextType
  const [temporaryPrompt, setTemporaryPrompt] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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

  // Initialize dashboard based on tile data
  const initializeDashboard = useCallback(async () => {
    // Don't proceed with initialization if we're authenticating
    if (isAuthenticating) {
      console.log('OAuth authentication in progress, delaying dashboard initialization');
      return;
    }
    
    // Create a unique identifier for this dashboard + filters combination
    const filterHash = JSON.stringify(tileDashboardFilters || {});
    const currentState = `${tileDashboardId}:${filterHash}`;
    
    // Check if we're already initializing or have already initialized this exact configuration
    if (initializationRef.current.isInitializing) {
      console.log('Dashboard initialization already in progress, skipping');
      return;
    }
    
    if (initializationRef.current.dashboardId === tileDashboardId && 
        initializationRef.current.filterHash === filterHash && 
        initializationRef.current.hasInitialized) {
      console.log('Dashboard already initialized for this configuration, skipping');
      return;
    }
    
    // Mark as initializing
    initializationRef.current.isInitializing = true;
    initializationRef.current.dashboardId = tileDashboardId || null;
    initializationRef.current.filterHash = filterHash;
    
    console.log('Starting dashboard initialization for ID:', tileDashboardId);
    
    const dashboardFilters = tileDashboardFilters || {}
    let newDashboardMetadata: DashboardMetadata | null = null
    let loadFromContext = false

    if (tileDashboardId) {
      const dashboardDetails = await fetchDashboardDetails(tileDashboardId, core40SDK, extensionSDK, dashboardFilters, tileHostData);
      const { description, queries, prompt } = dashboardDetails;
      setDashboardMetadata({ dashboardFilters, dashboardId: tileDashboardId, queries, description, prompt });
      newDashboardMetadata = { dashboardFilters, dashboardId: tileDashboardId, queries, description, prompt };
    }
    
    const marketDashboardId = newDashboardMetadata && newDashboardMetadata.description ? newDashboardMetadata.description.split('Dashboard:')[1] : '';
    let marketDashboard: DashboardMetadata | null = null;
    let marketData: any = {};
    
    if (marketDashboardId) {
      setIsLoading(true); // Set loading state to true
      marketDashboard = await fetchDashboardDetails(marketDashboardId, core40SDK, extensionSDK, dashboardFilters, tileHostData);
      if (marketDashboard && marketDashboard.queries.length > 0) marketData = await fetchQueryData(marketDashboard.queries, core40SDK);
    }

    if (newDashboardMetadata && newDashboardMetadata.queries.length > 0) {
      // Check if we're already fetching data for these queries to prevent duplicates
      const queryKey = JSON.stringify(newDashboardMetadata.queries.map(q => q.queryBody));
      
      let results;
      if (queryFetchRef.current.has(queryKey)) {
        console.log('Query data fetch already in progress, waiting for completion...');
        results = await queryFetchRef.current.get(queryKey);
      } else {
        console.log('Starting new query data fetch...');
        const fetchPromise = fetchQueryData(newDashboardMetadata.queries, core40SDK);
        queryFetchRef.current.set(queryKey, fetchPromise);
        
        try {
          results = await fetchPromise;
        } finally {
          queryFetchRef.current.delete(queryKey);
        }
      }

      if (results.length > 0 && (newDashboardMetadata?.prompt || prompt)) {
        try {
          setIsLoading(true); // Set loading state to true
          
          // Check if we have a token before proceeding
          if (!oauthToken) {
            setIsLoading(false);
            initializationRef.current.isInitializing = false;
            console.log('No OAuth token available, cannot generate content');
            return;
          }
          
          const newSummary = await generateArbitraryResponse(
            results, 
            extensionSDK, 
            '', // No restful service needed anymore 
            setFormattedData, 
            newDashboardMetadata?.prompt || prompt || '', 
            newDashboardMetadata, 
            marketData || {}
          )
          setIsLoading(false); // Set loading state to false
        } catch (error) {
          setIsLoading(false); // Set loading state to false in case of error
          initializationRef.current.isInitializing = false;
          console.error('Error generating summaries and suggestions:', error);
          return;
        }
      }
    } else if (newDashboardMetadata) {
      setIsLoading(true); // Set loading state to true
      
      // Same here - just check for token
      if (!oauthToken) {
        setIsLoading(false);
        initializationRef.current.isInitializing = false;
        return;
      }
      
      const newSummary = await generateArbitraryResponse(
        [], 
        extensionSDK, 
        '', // No restful service needed anymore
        setFormattedData, 
        newDashboardMetadata?.prompt || prompt || '', 
        newDashboardMetadata, 
        marketData || {}
      )
      setIsLoading(false); // Set loading state to false
    }
    
    // Mark as completed
    initializationRef.current.isInitializing = false;
    initializationRef.current.hasInitialized = true;
    console.log('Dashboard initialization completed for ID:', tileDashboardId);
  }, [tileDashboardId, extensionSDK, core40SDK, prompt, setFormattedData, tileDashboardFilters, tileHostData, oauthToken, isAuthenticating]);

  // This useEffect only runs when the dashboard ID changes or OAuth completes
  useEffect(() => {
    // Reset initialization state when dashboard ID or filters change
    const filterHash = JSON.stringify(tileDashboardFilters || {});
    if (initializationRef.current.dashboardId !== tileDashboardId || 
        initializationRef.current.filterHash !== filterHash) {
      console.log('Dashboard ID or filters changed, resetting initialization state');
      initializationRef.current.hasInitialized = false;
      initializationRef.current.isInitializing = false;
      initializationRef.current.filterHash = null;
      // Clear any pending query fetches
      queryFetchRef.current.clear();
    }
    
    // Only run initialization when we have a dashboard ID, not authenticating, and have an OAuth token
    if (tileDashboardId && !isAuthenticating && oauthToken) {
      initializeDashboard();
    }
  }, [tileDashboardId, tileDashboardFilters, isAuthenticating, oauthToken, initializeDashboard]);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDashboardMetadata((prev: DashboardMetadata) => ({ ...prev, prompt: temporaryPrompt }));
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
        
        <button 
          onClick={() => setIsSettingsOpen(true)} 
          style={{ 
            marginLeft: dashboardMetadata.prompt ? 'auto' : '1rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ⚙️ Settings
        </button>
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
      
      {/* Temporarily disabled due to compilation issues
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
