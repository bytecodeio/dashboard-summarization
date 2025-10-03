import { useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useSettings } from '../contexts/SettingsContext';

// Constants for retry logic
const MAX_AUTH_RETRIES = 2; // Maximum number of retries after initial attempt
const RETRY_DELAY_BASE = 2000; // Base delay in ms (will be multiplied by 2^retryCount)
const MAX_RETRY_DELAY = 30000; // Maximum retry delay in ms

export const useAutoOAuth = (triggerAuth: boolean = false) => {
  const { extensionSDK, core40SDK } = useContext(ExtensionContext);
  const { settings } = useSettings(); // Use the settings context
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  // Use state instead of localStorage for token storage
  const [oauthToken, setOauthToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  // Track auth errors to implement backoff
  const [authErrorCount, setAuthErrorCount] = useState<number>(0);
  const [nextRetryTime, setNextRetryTime] = useState<number | null>(null);
  
  // Use a ref to track if we've attempted auth in this session
  const authAttemptedRef = useRef<boolean>(false);
  // Track if settings have been loaded
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  // Track if SDK is ready
  const [sdkReady, setSdkReady] = useState<boolean>(false);
  // Store pre-auth URL in state
  const [preAuthUrl, setPreAuthUrl] = useState<string>('');

  // Get client ID from settings context
  const clientId = settings.googleOAuthClientId;

  // Check if token is valid
  const isTokenValid = useCallback(() => {
    if (!oauthToken || !tokenExpiry) return false;
    
    // Check if token is expired
    const isExpired = tokenExpiry < Date.now();
    return !isExpired;
  }, [oauthToken, tokenExpiry]);

  // Handle successful authentication
  const handleAuthSuccess = useCallback((token: string) => {
    setOauthToken(token);
    
    // Set expiry time (current time + expiry seconds)
    const expiryTime = Date.now() + (1000 * 1000);
    setTokenExpiry(expiryTime);
    
    setIsAuthenticating(false);
    
    // Redirect back to the original page if coming from callback
    if (window.location.pathname.includes('oauth-callback')) {
      window.location.href = preAuthUrl || '/';
    }
  }, [preAuthUrl]);

  // Use a ref to prevent multiple concurrent auth attempts
  const authInProgressRef = useRef<boolean>(false);
  
  // Initiate OAuth flow
  const initiateAuth = useCallback(async () => {
    // Skip if already authenticating or auth in progress
    if (isAuthenticating || authInProgressRef.current) {
      console.log('OAuth flow already in progress, skipping duplicate request');
      return;
    }

    if (!sdkReady) {
      console.log('SDK not ready yet, cannot initiate OAuth');
      return;
    }

    if (!clientId) {
      console.error('Google OAuth client ID is missing. Please configure it in settings.');
      return;
    }

    // Mark that we've attempted auth for this session
    authAttemptedRef.current = true;
    authInProgressRef.current = true;
    setIsAuthenticating(true);
    
    // Save current URL to redirect back after auth
    setPreAuthUrl(window.location.href);
    
    try {
      console.log('Starting OAuth authentication flow with client ID:', clientId.substring(0, 10) + '...');
      // Use extension SDK's OAuth capabilities
      const response = await extensionSDK.oauth2Authenticate(
        'https://accounts.google.com/o/oauth2/v2/auth',
        {
          client_id: clientId,
          scope: 'openid email profile',
          response_type: 'id_token',
          nonce: Math.random().toString(36).substring(2, 15), // Required for ID token
        }
      );
      
      const { id_token } = response;
      if (id_token ) {
        console.log('OAuth authentication successful');
        handleAuthSuccess(id_token);
      } else {
        console.error('Failed to get access token from OAuth response');
        setIsAuthenticating(false);
        // Reset auth attempted flag on failure so it can be tried again
        authAttemptedRef.current = false;
      }
    } catch (error) {
      console.error('OAuth authentication failed:', error);
      setIsAuthenticating(false);
      // Reset auth attempted flag on failure so it can be tried again
      authAttemptedRef.current = false;
    } finally {
      authInProgressRef.current = false;
    }
  }, [extensionSDK, handleAuthSuccess, isAuthenticating, clientId, sdkReady]);

  // Check if SDK is ready
  useEffect(() => {
    const checkSDKReadiness = async () => {
      // Check if SDK is ready by verifying we have core40SDK and extensionSDK
      if (!core40SDK || !extensionSDK) {
        console.log('SDK not yet available, waiting...');
        return;
      }
      
      try {
        // Test SDK readiness by making a simple API call
        await core40SDK.ok(core40SDK.me());
        setSdkReady(true);
        console.log('SDK is ready');
      } catch (error) {
        console.error('Error checking SDK readiness:', error);
        setSdkReady(false);
      }
      
      setSettingsLoaded(true);
    };
    
    checkSDKReadiness();
  }, [core40SDK, extensionSDK]);

  // Once settings are loaded and SDK is ready, decide if we need to authenticate
  // Using a more focused approach with fewer conditions to prevent loops
  useEffect(() => {
    // Early return if prerequisites aren't ready
    if (!settingsLoaded || !sdkReady || !clientId || authInProgressRef.current || isAuthenticating) {
      return;
    }
    
    // Check if we're in backoff period after errors
    if (nextRetryTime !== null && Date.now() < nextRetryTime) {
      // Still in backoff period, don't retry yet
      return;
    }
    
    // Check if we've exceeded max retries
    if (authErrorCount > MAX_AUTH_RETRIES) {
      console.log(`Exceeded maximum auth retry attempts (${MAX_AUTH_RETRIES}). Not attempting again.`);
      return;
    }
    
    // Only proceed if we need auth and haven't already tried or if explicitly requested
    if ((!authAttemptedRef.current && !isTokenValid()) || (triggerAuth && !isTokenValid())) {
      console.log('Authentication needed, initiating OAuth flow');
      // Use timeout to break potential circular dependencies
      const timeoutId = setTimeout(() => {
        initiateAuth();
      }, 10);
      
      return () => clearTimeout(timeoutId); // Clean up timeout on effect cleanup
    }
  }, [settingsLoaded, sdkReady, triggerAuth, isTokenValid, initiateAuth, clientId, isAuthenticating, nextRetryTime, authErrorCount]);

  // Add reset function to allow manual reset of auth state
  const resetAuthState = useCallback(() => {
    setAuthErrorCount(0);
    setNextRetryTime(null);
    authAttemptedRef.current = false;
    authInProgressRef.current = false;
  }, []);
  
  return { 
    isAuthenticating, 
    oauthToken, 
    initiateAuth, 
    handleAuthSuccess, 
    clientId, 
    sdkReady, 
    settingsLoaded,
    resetAuthState,
    authErrorCount
  };
};
