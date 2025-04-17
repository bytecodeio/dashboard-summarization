import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { loadUserSettings } from './loadUserSettings';

export const useAutoOAuth = (triggerAuth: boolean = false) => {
  const { extensionSDK, core40SDK } = useContext(ExtensionContext);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [oauthToken, setOauthToken] = useState<string | null>(
    localStorage.getItem('vertex_oauth_token')
  );
  // Use a ref to track if we've attempted auth in this session
  const authAttemptedRef = useRef<boolean>(false);
  // Track if settings have been loaded
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);

  // Check if token is valid
  const isTokenValid = useCallback(() => {
    const token = localStorage.getItem('vertex_oauth_token');
    if (!token) return false;
    
    const tokenExpiry = localStorage.getItem('vertex_token_expiry');
    if (!tokenExpiry) return false;
    
    // Check if token is expired
    const isExpired = parseInt(tokenExpiry) < Date.now();
    return !isExpired;
  }, []);

  // Handle successful authentication
  const handleAuthSuccess = useCallback((token: string, expiresIn: number) => {
    localStorage.setItem('vertex_oauth_token', token);
    
    // Set expiry time (current time + expiry seconds)
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem('vertex_token_expiry', expiryTime.toString());
    
    setOauthToken(token);
    setIsAuthenticating(false);
    
    // Redirect back to the original page if coming from callback
    if (window.location.pathname.includes('oauth-callback')) {
      window.location.href = localStorage.getItem('pre_auth_url') || '/';
    }
  }, []);

  // Initiate OAuth flow
  const initiateAuth = useCallback(async () => {
    // Skip if already authenticating or if we've already attempted auth
    if (isAuthenticating || authAttemptedRef.current) {
      console.log('OAuth flow already in progress or previously attempted, skipping duplicate request');
      return;
    }

    // Double-check if token is valid before proceeding
    if (isTokenValid()) {
      console.log('Valid token found, skipping authentication');
      return;
    }

    // Mark that we've attempted auth for this session
    authAttemptedRef.current = true;
    setIsAuthenticating(true);
    
    // Save current URL to redirect back after auth
    localStorage.setItem('pre_auth_url', window.location.href);
    
    try {
      // Get client ID from localStorage where loadUserSettings would have stored it
      const clientId = localStorage.getItem('google_oauth_client_id');
      
      if (!clientId) {
        console.error('Google OAuth client ID is missing. Please configure it in settings.');
        setIsAuthenticating(false);
        return;
      }
      
      // Use extension SDK's OAuth capabilities
      const response = await extensionSDK.oauth2Authenticate(
        'https://accounts.google.com/o/oauth2/v2/auth',
        {
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/cloud-platform',
          response_type: 'token',
        }
      );
      
      const { access_token, expires_in } = response;
      if (access_token && expires_in) {
        handleAuthSuccess(access_token, expires_in);
      } else {
        console.error('Failed to get access token');
        setIsAuthenticating(false);
      }
    } catch (error) {
      console.error('OAuth authentication failed:', error);
      setIsAuthenticating(false);
    }
  }, [extensionSDK, handleAuthSuccess, isAuthenticating, isTokenValid]);

  // Load settings first, then check authentication status
  useEffect(() => {
    const loadSettingsAndCheckAuth = async () => {
      // First load settings to ensure we have client ID
      await loadUserSettings(core40SDK, extensionSDK);
      setSettingsLoaded(true);
    };
    
    loadSettingsAndCheckAuth();
  }, [core40SDK, extensionSDK]);

  // Once settings are loaded, decide if we need to authenticate
  useEffect(() => {
    if (!settingsLoaded) return;
    
    const checkAndAuthenticate = async () => {
      // Check if token exists and is valid
      if (isTokenValid()) {
        console.log('Valid OAuth token exists, no need to authenticate');
        return;
      }
      
      // Get client ID to check if it's configured
      const clientId = localStorage.getItem('google_oauth_client_id');
      
      // Only attempt auth once and only if we have a clientID and need a token
      if (!authAttemptedRef.current && 
          ((triggerAuth && clientId) || (clientId && !isTokenValid()))) {
        // Add a small delay to prevent immediate popup
        setTimeout(() => {
          initiateAuth();
        }, 500);
      }
    };
    
    checkAndAuthenticate();
  }, [settingsLoaded, triggerAuth, isTokenValid, initiateAuth]);

  return { isAuthenticating, oauthToken, initiateAuth, handleAuthSuccess };
};
