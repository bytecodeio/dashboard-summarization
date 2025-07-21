import { useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { useSettings } from '../contexts/SettingsContext';

export const useAutoOAuth = (triggerAuth: boolean = false) => {
  const { extensionSDK, core40SDK } = useContext(ExtensionContext);
  const { settings } = useSettings();
  
  // Local React state
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  
  // Use a ref to track if we've attempted auth on this mount
  const hasAttemptedOAuth = useRef<boolean>(false);
  const mountTime = useRef<number>(Date.now());
  // Track if settings have been loaded
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  // Track if SDK is ready
  const [sdkReady, setSdkReady] = useState<boolean>(false);

  // Get client ID from settings context
  const clientId = settings.googleOAuthClientId;

  // Handle successful authentication
  const handleAuthSuccess = useCallback((token: string, expiresIn: number) => {
    setIdToken(token);
    
    // Set expiry time (current time + expiry seconds)
    const expiryTime = Date.now() + (expiresIn * 1000);
    setTokenExpiry(expiryTime);
    
    setIsAuthenticating(false);
    
    console.log('Authentication successful, token stored');
  }, []);

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
  useEffect(() => {
    const doAutoOAuth = async () => {
      if (!settingsLoaded || !sdkReady) {
        console.log(`Waiting for prerequisites - settingsLoaded: ${settingsLoaded}, sdkReady: ${sdkReady}`);
        return;
      }
      
      // Skip if we've already attempted successfully
      if (hasAttemptedOAuth.current) {
        console.log('OAuth already attempted on this mount, skipping');
        return;
      }
      
      // Skip if already authenticating to avoid duplicate OAuth flows
      if (isAuthenticating) {
        console.log('OAuth already in progress, skipping duplicate request');
        return;
      }

      // Must have client ID to proceed
      if (!clientId) {
        console.log('No Google Client ID configured, skipping OAuth');
        return;
      }

      // Check if token exists and is valid
      const hasValidToken = idToken && tokenExpiry && tokenExpiry > Date.now();
      
      if (hasValidToken) {
        console.log('Valid ID token exists, no need to authenticate');
        return;
      }

      // Determine if we should authenticate
      const needsNewToken = !idToken;
      const shouldAuthenticate = (triggerAuth || needsNewToken) && !hasAttemptedOAuth.current;
      
      if (!shouldAuthenticate) {
        return;
      }

      try {
        console.log('Starting automatic OAuth flow');
        setIsAuthenticating(true);
        hasAttemptedOAuth.current = true;

        // Add timeout like the working example
        const oauthPromise = extensionSDK.oauth2Authenticate(
          'https://accounts.google.com/o/oauth2/v2/auth',
          {
            client_id: clientId,
            scope: 'openid email profile',
            response_type: 'id_token',
            nonce: Math.random().toString(36).substring(2, 15), // Required for ID token
          }
        );

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OAuth timeout after 30 seconds')), 30000);
        });

        const response = await Promise.race([oauthPromise, timeoutPromise]) as any;

        console.log('OAuth authentication completed, response received');
        const { id_token } = response;
        if (id_token) {
          console.log('Received new ID token, length:', id_token.length);
          // For ID tokens, we can decode the JWT to get expiration
          try {
            const payload = JSON.parse(atob(id_token.split('.')[1]));
            const expiresAtSeconds = payload.exp;
            const expiresInSeconds = expiresAtSeconds - Math.floor(Date.now() / 1000);
            handleAuthSuccess(id_token, expiresInSeconds);
            console.log('ID token automatically obtained');
          } catch (error) {
            console.warn('Could not decode ID token expiration, using default:', error);
            handleAuthSuccess(id_token, 3600);
          }
        } else {
          console.log('No ID token received from OAuth flow');
          throw new Error('No ID token received from OAuth flow');
        }
      } catch (error) {
        console.error('Automatic OAuth authentication failed:', error);
        setIsAuthenticating(false);
        // Don't reset hasAttemptedOAuth to allow manual retry
      } finally {
        setIsAuthenticating(false);
      }
    };

    doAutoOAuth();
  }, [settingsLoaded, sdkReady, triggerAuth, clientId, idToken, tokenExpiry, extensionSDK, handleAuthSuccess, isAuthenticating]);

  return { isAuthenticating, idToken, handleAuthSuccess, clientId, sdkReady, settingsLoaded };
};
