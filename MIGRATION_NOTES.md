# Migration to Backend Service Architecture

## Overview

This branch (`backend-passthrough-service`) refactors the application to use a **backend service** instead of direct OAuth authentication and Vertex AI calls. This simplifies the user experience by removing the need for individual user OAuth provisioning.

## Key Changes

### 1. **Removed OAuth Authentication**
- ❌ Removed `useAutoOAuth` hook usage
- ❌ Removed Google OAuth Client ID configuration
- ❌ Removed OAuth token handling throughout the application
- ❌ Removed all Vertex AI project/location/model settings from frontend

### 2. **New Backend Service Integration**
- ✅ Single backend service URL configuration
- ✅ Backend handles Vertex AI authentication using service account IAM
- ✅ Simplified settings modal with only backend URL
- ✅ No user-level OAuth required

### 3. **Simplified Settings**

**Before:**
```typescript
interface VertexSettings {
  vertexProject: string;
  vertexLocation: string;
  vertexModel: string;
  googleOAuthClientId: string;
  cloudEndpoint: string;
}
```

**After:**
```typescript
interface VertexSettings {
  backendServiceUrl: string;
}
```

### 4. **Modified Files**

| File | Changes |
|------|---------|
| `src/utils/generateArbitraryResponse.ts` | Removed OAuth token parameter, removed Vertex AI direct calls, added backend service HTTP request |
| `src/types.ts` | Simplified `VertexSettings` to only include `backendServiceUrl` |
| `src/contexts/SettingsContext.tsx` | Removed OAuth-related settings storage |
| `src/components/SettingsModal.tsx` | Removed OAuth UI, simplified to single backend URL input |
| `src/components/DashboardSummarization.tsx` | Removed `useAutoOAuth` hook, removed OAuth error handling, simplified AI request flow |
| `.env` | Updated to use `BACKEND_SERVICE_URL` instead of old variables |

## Backend Service Requirements

The backend service must implement the following endpoint:

### POST `/generate` (or your configured endpoint)

**Request Body:**
```json
{
  "prompt": "User's question",
  "dashboardContext": { /* Dashboard metadata */ },
  "queryData": [ /* Query results */ ],
  "additionalData": { /* Additional context */ },
  "conversationHistory": [
    {
      "userPrompt": "Previous question",
      "aiResponse": "Previous response",
      "timestamp": 1234567890
    }
  ]
}
```

**Response:**
```json
{
  "response": "AI-generated response text"
}
```

### GET `/health` (for connection testing)

**Response:**
```json
{
  "status": "ok"
}
```

## Configuration Steps

### For Administrators:

1. **Deploy Backend Service**
   - Deploy the backend service to Cloud Run (or similar)
   - Ensure the service has proper IAM permissions to call Vertex AI
   - Configure the service account with `roles/aiplatform.user` role

2. **Configure Backend URL in Looker Extension**
   - Open the Dashboard Summarization extension
   - Click ⚙️ Settings (admin only)
   - Enter the backend service URL (e.g., `https://your-service.run.app/generate`)
   - Click "Test Connection" to verify
   - Click "Save Settings"

3. **Environment Variables**
   - Update `.env` file with your backend service URL:
     ```
     BACKEND_SERVICE_URL=https://your-backend-service.run.app/generate
     ```

### For Users:

**No configuration needed!** Users can immediately start using the extension without any OAuth setup.

## Migration Path

If you're migrating from the OAuth version:

1. **Checkout this branch:**
   ```bash
   git checkout backend-passthrough-service
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Update environment variables:**
   ```bash
   # Edit .env file with your backend service URL
   ```

4. **Build and deploy:**
   ```bash
   npm run build
   ```

5. **Clear old settings (admin):**
   - Old OAuth settings are ignored
   - Simply configure the new backend service URL in settings modal

## Benefits

✅ **Simplified User Experience:** No OAuth flow for users
✅ **Centralized Authentication:** Backend service uses single IAM account
✅ **Easier Provisioning:** No per-user Vertex AI access needed
✅ **Better Security:** API credentials never exposed to frontend
✅ **Reduced Complexity:** ~271 lines of code removed

## Backend Service Implementation

Reference implementation for the backend service is available in `restful-service/src/`. You'll need to modify it to:

1. Accept the new request format (with conversation history)
2. Format prompts to include conversation context
3. Return responses in the expected format

Example modification:
```javascript
app.post('/generate', async (req, res) => {
  const { prompt, dashboardContext, queryData, additionalData, conversationHistory } = req.body;

  // Build context-aware prompt
  const fullPrompt = buildPromptWithHistory(
    prompt,
    dashboardContext,
    queryData,
    additionalData,
    conversationHistory
  );

  // Call Vertex AI
  const response = await generativeModel.generateContent(fullPrompt);

  res.json({ response: response.text });
});
```

## Rollback

To rollback to the OAuth version:

```bash
git checkout shared_cloud_backend2
```

## Support

For issues or questions, contact your administrator or check the project documentation.
