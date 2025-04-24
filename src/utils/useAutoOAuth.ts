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
  // Store client ID in state rather than localStorage
  const [clientId, setClientId] = useState<string | null>(null);

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

    if (!clientId) {
      console.error('Google OAuth client ID is missing. Please configure it in settings.');
      return;
    }

    // Mark that we've attempted auth for this session
    authAttemptedRef.current = true;
    setIsAuthenticating(true);
    
    // Save current URL to redirect back after auth
    localStorage.setItem('pre_auth_url', window.location.href);
    
    try {
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
  }, [extensionSDK, handleAuthSuccess, isAuthenticating, isTokenValid, clientId]);

  // Load settings first, then check authentication status
  useEffect(() => {
    const loadSettingsAndCheckAuth = async () => {
      try {
        // Get settings from user attributes, not localStorage
        const extensionId = extensionSDK?.lookerHostData?.extensionId;
        if (extensionId) {
          const model_application = extensionId.replace(/::/g, '_').replace(/-/g, '_').toLowerCase();
          const attrName = `${model_application}_google_oauth_client_id`;
          
          const userId = (await core40SDK.ok(core40SDK.me())).id;
          const userAttrs = await core40SDK.ok(
            core40SDK.user_attribute_user_values({
              user_id: userId,
              fields: "name, value",
              all_values: true
            })
          );
          
          const clientIdAttr = userAttrs.find((attr: any) => 
            attr.name.toLowerCase() === attrName.toLowerCase()
          );
          
          if (clientIdAttr && clientIdAttr.value) {
            setClientId(clientIdAttr.value);
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
      
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
  }, [settingsLoaded, triggerAuth, isTokenValid, initiateAuth, clientId]);

  return { isAuthenticating, oauthToken, initiateAuth, handleAuthSuccess, clientId };
};
