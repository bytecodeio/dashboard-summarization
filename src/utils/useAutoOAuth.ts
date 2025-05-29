import { useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';

export const useAutoOAuth = (triggerAuth: boolean = false) => {
  const { extensionSDK, core40SDK } = useContext(ExtensionContext);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  // Use state instead of localStorage for token storage
  const [oauthToken, setOauthToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  
  // Use a ref to track if we've attempted auth in this session
  const authAttemptedRef = useRef<boolean>(false);
  // Track if settings have been loaded
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  // Track if SDK is ready
  const [sdkReady, setSdkReady] = useState<boolean>(false);
  // Store client ID in state rather than localStorage
  const [clientId, setClientId] = useState<string | null>(null);
  // Store pre-auth URL in state
  const [preAuthUrl, setPreAuthUrl] = useState<string>('');

  // Check if token is valid
  const isTokenValid = useCallback(() => {
    if (!oauthToken || !tokenExpiry) return false;
    
    // Check if token is expired
    const isExpired = tokenExpiry < Date.now();
    return !isExpired;
  }, [oauthToken, tokenExpiry]);

  // Handle successful authentication
  const handleAuthSuccess = useCallback((token: string, expiresIn: number) => {
    setOauthToken(token);
    
    // Set expiry time (current time + expiry seconds)
    const expiryTime = Date.now() + (expiresIn * 1000);
    setTokenExpiry(expiryTime);
    
    setIsAuthenticating(false);
    
    // Redirect back to the original page if coming from callback
    if (window.location.pathname.includes('oauth-callback')) {
      window.location.href = preAuthUrl || '/';
    }
  }, [preAuthUrl]);

  // Initiate OAuth flow
  const initiateAuth = useCallback(async () => {
    // Skip if already authenticating
    if (isAuthenticating) {
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
          scope: 'https://www.googleapis.com/auth/cloud-platform',
          response_type: 'token',
        }
      );
      
      const { access_token, expires_in } = response;
      if (access_token && expires_in) {
        console.log('OAuth authentication successful');
        handleAuthSuccess(access_token, expires_in);
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
    }
  }, [extensionSDK, handleAuthSuccess, isAuthenticating, clientId, sdkReady]);

  // Check if SDK is ready and load settings
  useEffect(() => {
    const checkSDKAndLoadSettings = async () => {
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
        
        // Get settings from user attributes, not localStorage
        const extensionId = extensionSDK?.lookerHostData?.extensionId;
        if (extensionId) {
          const model_application = extensionId.replace(/::/g, '_').replace(/-/g, '_').toLowerCase();
          const attrName = `${model_application}_google_oauth_client_id`;
          
          const user = await core40SDK.ok(core40SDK.me());
          const userId = user.id;
          
          if (userId) {
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
        }
      } catch (error) {
        console.error('Error checking SDK readiness or loading settings:', error);
        setSdkReady(false);
      }
      
      setSettingsLoaded(true);
    };
    
    checkSDKAndLoadSettings();
  }, [core40SDK, extensionSDK]);

  // Once settings are loaded and SDK is ready, decide if we need to authenticate
  useEffect(() => {
    if (!settingsLoaded || !sdkReady) {
      console.log(`Waiting for prerequisites - settingsLoaded: ${settingsLoaded}, sdkReady: ${sdkReady}`);
      return;
    }
    
    const checkAndAuthenticate = async () => {
      // Check if token exists and is valid
      if (isTokenValid()) {
        console.log('Valid OAuth token exists, no need to authenticate');
        return;
      }
      
      // Reset auth attempted flag if token is invalid/missing
      if (!isTokenValid()) {
        authAttemptedRef.current = false;
      }
      
      // Trigger auth if:
      // 1. triggerAuth is true and we haven't attempted yet, OR
      // 2. We have a clientId and no valid token and haven't attempted yet
      if (!authAttemptedRef.current && triggerAuth && clientId) {
        console.log('Triggering OAuth authentication (trigger mode)...');
        await initiateAuth();
      } else if (!authAttemptedRef.current && clientId && !isTokenValid()) {
        console.log('No valid token found, triggering OAuth authentication...');
        await initiateAuth();
      } else if (triggerAuth && !clientId) {
        console.log('OAuth client ID is missing. Please configure it in settings.');
      }
    };
    
    checkAndAuthenticate();
  }, [settingsLoaded, sdkReady, triggerAuth, isTokenValid, initiateAuth, clientId]);

  return { isAuthenticating, oauthToken, initiateAuth, handleAuthSuccess, clientId, sdkReady, settingsLoaded };
};
