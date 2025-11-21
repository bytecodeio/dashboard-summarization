# Looker Dashboard Summarization

A Looker extension that provides AI-powered conversational analysis of dashboard data using Google Vertex AI.

![dashboard summarization demo](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzRrZ200dnB3YWg1Y3AwazVjdm44ZWx3dWZjZ2NtcGVieWZuY3VmNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/kIXodRHInpIds8KPvC/giphy.gif)

## Features

- **Multi-turn Conversations**: Ask follow-up questions about your dashboard data
- **Contextual Analysis**: AI maintains conversation history for intelligent responses
- **No User OAuth Required**: Backend service handles all authentication
- **Export Integrations**: Share insights to Slack and Google Chat
- **Real-time Insights**: Instant analysis of dashboard queries and data

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Looker         │         │  Backend Service │         │  Vertex AI      │
│  Extension      │────────▶│  (Cloud Run)     │────────▶│  (Gemini)       │
│  (React/TS)     │         │  (Node.js)       │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

**Key Benefits:**
- ✅ Simplified user experience - no OAuth flow for end users
- ✅ Centralized authentication - backend uses service account IAM
- ✅ Better security - API credentials never exposed to frontend
- ✅ Easy provisioning - no per-user Vertex AI access needed

## Prerequisites

- Google Cloud Project with Vertex AI API enabled
- Looker instance (22.0+)
- Node.js 18+ and npm
- gcloud CLI authenticated to your GCP project

## Setup

### 1. Deploy Backend Service

The backend service is a Cloud Run application that handles Vertex AI authentication and API calls.

#### Quick Deploy

From the `restful-service` directory:

```bash
cd restful-service
bash deploy.sh
```

The script will:
1. Build a Docker container
2. Deploy to Cloud Run
3. Configure environment variables
4. Output your service URL

#### Manual Deploy

If you prefer manual deployment:

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Build the container
cd restful-service/src
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/dashboard-summarization-backend

# Deploy to Cloud Run
gcloud run deploy dashboard-summarization-backend \
  --image gcr.io/YOUR_PROJECT_ID/dashboard-summarization-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PROJECT=YOUR_PROJECT_ID,REGION=us-central1,MODEL=gemini-2.0-flash-exp \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0

# Get your service URL
gcloud run services describe dashboard-summarization-backend \
  --region us-central1 \
  --format 'value(status.url)'
```

**Required IAM Permissions:**

The Cloud Run service account needs:
- `roles/aiplatform.user` - To call Vertex AI APIs

```bash
# Grant permissions to the default Compute Engine service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

#### Backend Endpoints

- **POST `/generate`** - Main AI generation endpoint
  - Request: `{ prompt, dashboardContext, queryData, additionalData, conversationHistory }`
  - Response: `{ response: "AI generated text" }`

- **GET `/health`** - Health check endpoint
  - Response: `{ status: "ok" }`

### 2. Configure Frontend Extension

#### Environment Variables

Create/update `.env` in the project root:

```bash
BACKEND_SERVICE_URL=https://your-service-url.run.app/generate
```

**Important:** This URL is compiled into your extension bundle, so you need to rebuild after changing it.

#### Build the Extension

```bash
# Install dependencies
npm install

# Development build (with source maps)
npm run develop

# Production build (minified)
npm run build
```

The build creates `dist/dashboard_summarization.js` which you'll deploy to Looker.

### 3. Deploy to Looker

#### Create Extension in Looker

1. **Create project directory** in your Looker instance:
   ```
   your_project/
   ├── manifest.lkml
   └── dashboard_summarization.js
   ```

2. **Add `manifest.lkml`**:
   ```lkml
   project_name: "dashboard-summarization"

   application: dashboard_summarization {
     label: "Dashboard Summarization"
     url: "https://localhost:8080/bundle.js"  # For development
     # url: "https://your-looker-instance/extensions/dashboard_summarization::dashboard_summarization/dashboard_summarization.js"  # For production

     entitlements: {
       core_api_methods: ["me", "user_roles", "run_inline_query", "dashboard", "dashboard_elements", "query", "lookml_model_explore"]
       use_form_submit: yes
       use_embeds: yes
       external_api_urls: ["https://your-backend-service.run.app"]
     }
   }
   ```

3. **Copy the bundle**: Upload `dist/dashboard_summarization.js` to your Looker project

4. **Configure permissions** in Looker Admin:
   - Admins can access Settings to configure backend URL
   - All users can use the extension (no additional setup needed)

#### Using the Extension

1. **Admin Configuration** (one-time):
   - Open the extension
   - Click ⚙️ Settings
   - Enter backend service URL
   - Test connection
   - Save

2. **For End Users**:
   - Open any dashboard
   - Extension automatically loads
   - Ask questions about the dashboard
   - Follow up with additional questions
   - Export insights to Slack/Google Chat (optional)

## Development

### Local Development

**Backend:**
```bash
cd restful-service/src
npm install
npm run start
# Server runs at http://localhost:8080
```

**Frontend:**
```bash
npm install
npm run develop
# Extension runs at https://localhost:8080
```

Update `manifest.lkml` to point to `https://localhost:8080/bundle.js` for local development.

### Project Structure

```
dashboard-summarization/
├── src/                          # Frontend source
│   ├── components/              # React components
│   │   ├── DashboardSummarization.tsx
│   │   └── SettingsModal.tsx
│   ├── contexts/                # React contexts
│   │   ├── SettingsContext.tsx  # Backend URL configuration
│   │   └── SummaryDataContext.ts
│   ├── utils/                   # Utilities
│   │   ├── generateArbitraryResponse.ts  # Backend API calls
│   │   └── fetchDashboardDetails.ts
│   └── types.ts                 # TypeScript types
├── restful-service/             # Backend service
│   ├── src/
│   │   ├── index.js            # Express server
│   │   ├── Dockerfile
│   │   └── package.json
│   └── deploy.sh               # Deployment script
├── manifest.lkml               # Looker extension config
├── .env                        # Environment variables
└── package.json                # Frontend dependencies
```

### Key Configuration Files

**Frontend `.env`:**
```bash
BACKEND_SERVICE_URL=https://your-service.run.app/generate
```

**Backend environment variables** (set in Cloud Run):
```bash
PROJECT=your-gcp-project-id
REGION=us-central1
MODEL=gemini-2.0-flash-exp
PORT=8080
```

## Technologies

### Frontend
- React 18
- TypeScript
- Looker Extension SDK
- Webpack 5

### Backend
- Node.js 18
- Express.js
- Google Cloud Vertex AI SDK
- Docker

### Infrastructure
- Google Cloud Run
- Google Cloud Build
- Vertex AI (Gemini models)

## Troubleshooting

### "Backend service not configured"

**Problem:** Extension shows error about missing backend URL

**Solution:**
1. Check `.env` has correct `BACKEND_SERVICE_URL`
2. Rebuild extension: `npm run build`
3. Re-upload `dist/dashboard_summarization.js` to Looker

### "Failed to generate response"

**Problem:** Backend service returns errors

**Solution:**
1. Check Cloud Run logs: `gcloud run services logs read dashboard-summarization-backend --region us-central1`
2. Verify service account has `roles/aiplatform.user` permission
3. Test health endpoint: `curl https://your-service.run.app/health`

### CORS Errors

**Problem:** Browser console shows CORS errors

**Solution:** Backend includes CORS middleware. If issues persist:
1. Verify `manifest.lkml` includes your backend URL in `external_api_urls`
2. Check Cloud Run allows unauthenticated requests
3. Ensure Looker's `fetchProxy` is being used (not direct `fetch`)

### Extension Won't Load

**Problem:** Extension shows blank screen or errors

**Solution:**
1. Check browser console for errors
2. Verify `manifest.lkml` URL points to correct bundle
3. For development, ensure webpack dev server is running
4. For production, verify bundle was uploaded to Looker project

## Migration from OAuth Version

If migrating from the previous OAuth-based version:

1. Deploy new backend service (see above)
2. Update `.env` with new backend URL
3. Rebuild frontend: `npm run build`
4. Re-upload to Looker
5. Old OAuth settings will be ignored automatically

See `MIGRATION_NOTES.md` for detailed migration guide.

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review Cloud Run logs
- Verify IAM permissions
- Test backend endpoints directly

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please submit pull requests or open issues on GitHub.
