# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend Development
- `npm install` or `yarn install` - Install dependencies
- `npm run develop` or `yarn develop` - Start development server on localhost:8080
- `npm run build` or `yarn build` - Create production build in dist/
- `npm run clean` or `yarn clean` - Clean dist directory
- `npm run analyze` - Analyze bundle size with webpack-bundle-analyzer

### Backend Service
- Navigate to `restful-service/src/` for the Cloud Run service
- `npm install` - Install backend dependencies  
- `npm run start` - Start backend development server on localhost:5000

## Architecture Overview

This is a **Looker Extension** that provides AI-powered dashboard summarization using Google Vertex AI. The application has a multi-tier architecture:

### Frontend (React/TypeScript)
- **Main App**: `src/App.tsx` - Root component with context providers
- **Core Component**: `src/components/DashboardSummarization.tsx` - Primary dashboard analysis interface
- **Context Management**: 
  - `src/contexts/SettingsContext.tsx` - Vertex AI configuration and authentication
  - `src/contexts/SummaryDataContext.ts` - Dashboard data and summary state
- **Key Utilities**:
  - `src/utils/fetchDashboardDetails.ts` - Dashboard metadata extraction
  - `src/utils/fetchQueryData.ts` - Query execution and data fetching
  - `src/utils/generateArbitraryResponse.ts` - Vertex AI integration
  - `src/utils/useAutoOAuth.ts` - Google OAuth handling

### Backend Service
- **Location**: `restful-service/src/`
- **Purpose**: Cloud Run service for Vertex AI processing
- **Infrastructure**: Terraform deployment scripts in `restful-service/terraform/`

### Integration Points
- **Looker SDK**: Uses `@looker/extension-sdk-react` for dashboard access
- **Vertex AI**: Direct OAuth integration for AI processing
- **Export Integrations**: Slack and Google Chat OAuth for sharing summaries

## Key Configuration Files

- **manifest.lkml**: Looker extension configuration with API permissions
- **package.json**: Frontend dependencies and scripts
- **.env**: Environment variables (SLACK_CLIENT_ID, RESTFUL_SERVICE, etc.)
- **webpack.config.js**: Base webpack configuration
- **webpack.develop.js**: Development webpack configuration  
- **webpack.prod.js**: Production webpack configuration

## Development Workflow

1. **Local Development**: Extension runs on localhost:8080 and connects to deployed Looker instance
2. **Authentication**: Requires Google OAuth setup for Vertex AI access
3. **Settings**: Admin/developer users can configure Vertex AI settings via settings modal
4. **Data Flow**: Dashboard queries → Looker API → Vertex AI → Formatted summary

## Important Implementation Details

### Context Architecture
The application uses React Context for state management:
- **SettingsContext**: Handles Vertex AI configuration, OAuth tokens, and persistence
- **SummaryDataContext**: Manages dashboard data, summaries, and UI state

### Authentication Flow
- Uses `useAutoOAuth` hook for Google OAuth integration
- Settings are persisted in Looker extension context (preferred) or user attributes (fallback)
- Admin access required for settings configuration

### Data Processing
- Fetches dashboard metadata and query results from Looker API
- Processes data through Vertex AI using configured model (default: gemini-2.0-flash)
- Supports custom prompts and dashboard descriptions for context

### Extension Deployment
- Development: Uses localhost URL in manifest.lkml
- Production: Build creates bundle.js that gets uploaded to Looker project
- Requires proper entitlements in manifest.lkml for API access

## TypeScript Types

Key types are defined in `src/types.ts`:
- **VertexSettings**: Vertex AI configuration structure
- **DashboardMetadata**: Dashboard and query metadata
- **Query**: Individual query structure with body and metadata
- **SummaryDataContextType**: Context state interface