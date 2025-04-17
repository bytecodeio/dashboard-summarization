import React, { useEffect } from 'react';
import { useAutoOAuth } from './useAutoOAuth';

// This component handles the OAuth callback from Google
export const OAuthCallback: React.FC = () => {
  const { handleAuthSuccess } = useAutoOAuth(true);
  
  useEffect(() => {
    // Parse hash fragment to get the access token
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    
    if (accessToken && expiresIn) {
      // Save the token and redirect back
      handleAuthSuccess(accessToken, parseInt(expiresIn));
    } else {
      // Handle error
      console.error('OAuth callback error: No token received');
      // Redirect to home
      window.location.href = '/';
    }
  }, [handleAuthSuccess]);
  
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <div>Processing authentication...</div>
      <div className="spinner" style={{ margin: '20px auto' }}></div>
    </div>
  );
};

export default OAuthCallback;
