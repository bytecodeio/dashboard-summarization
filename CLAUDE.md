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

This is a **Looker Extension** that provides AI-powered conversational dashboard analysis using Google Vertex AI. The application supports multi-turn conversations where users can ask follow-up questions and have contextual discussions about dashboard data. The application has a multi-tier architecture:

### Frontend (React/TypeScript)
- **Main App**: `src/App.tsx` - Root component with context providers
- **Core Component**: `src/components/DashboardSummarization.tsx` - Primary conversational dashboard interface
- **Context Management**: 
  - `src/contexts/SettingsContext.tsx` - Vertex AI configuration and authentication
  - `src/contexts/SummaryDataContext.ts` - Dashboard data and conversation history state
- **Key Utilities**:
  - `src/utils/fetchDashboardDetails.ts` - Dashboard metadata extraction
  - `src/utils/fetchQueryData.ts` - Query execution and data fetching
  - `src/utils/generateArbitraryResponse.ts` - Vertex AI integration with conversation context
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
4. **Data Flow**: Dashboard queries → Looker API → Vertex AI (with conversation context) → Multi-turn conversational responses

## Important Implementation Details

### Context Architecture
The application uses React Context for state management:
- **SettingsContext**: Handles Vertex AI configuration, OAuth tokens, and persistence
- **SummaryDataContext**: Manages dashboard data, conversation history, and UI state
  - `conversationHistory: ConversationExchange[]` - Array of user prompts and AI responses
  - Session-based conversation state (no persistence between page reloads)
  - Automatic conversation context management for AI requests

### Authentication Flow
- Uses `useAutoOAuth` hook for Google OAuth integration
- Settings are persisted in Looker extension context (preferred) or user attributes (fallback)
- Admin access required for settings configuration

### Data Processing
- Fetches dashboard metadata and query results from Looker API
- Processes data through Vertex AI using configured model (default: gemini-2.0-flash)
- Supports custom prompts and dashboard descriptions for context

### Conversation Features
- **Multi-turn Conversations**: Users can ask follow-up questions that reference previous responses
- **Context Management**: AI receives conversation history (last 5 exchanges) for contextual responses
- **Accordion UI**: Previous responses are collapsible to focus on current exchange
- **Clear Conversation**: Users can reset conversation history with "Clear Chat" button
- **Dynamic Prompts**: Placeholder text changes based on conversation state
- **Session-based**: Conversations reset on page reload (no persistence)

### Extension Deployment
- Development: Uses localhost URL in manifest.lkml
- Production: Build creates bundle.js that gets uploaded to Looker project
- Requires proper entitlements in manifest.lkml for API access

## TypeScript Types

Key types are defined in `src/types.ts`:
- **VertexSettings**: Vertex AI configuration structure
- **DashboardMetadata**: Dashboard and query metadata
- **Query**: Individual query structure with body and metadata
- **ConversationExchange**: Individual conversation exchange with userPrompt, aiResponse, and timestamp
- **SummaryDataContextType**: Context state interface managing conversation history instead of single response

## Conversation Implementation Details

### State Management
- **Session-only Storage**: Conversations exist only in React state, no localStorage or backend persistence
- **Context Window**: AI receives up to 5 most recent exchanges for context while maintaining reasonable token limits
- **Memory Management**: Uses React useRef to prevent infinite loops in useEffect dependencies

### UI/UX Patterns
- **Latest First**: Most recent exchange displayed prominently at top
- **Collapsible History**: Previous exchanges hidden behind expandable accordion
- **Visual Hierarchy**: Recent responses darker text, previous responses slightly faded
- **Clear Functionality**: Red "Clear Chat" button appears when conversation history exists

### Integration Updates
- **Slack Export**: Modified to send latest conversation exchange instead of single response
- **Google Chat Export**: Maintains compatibility with conversation format
- **Caching Strategy**: Dashboard and query data cached, but AI responses could be cached by prompt+context hash

### Context Preservation
- **Dashboard State**: Original dashboard metadata, query results, and filters preserved throughout conversation
- **Smart Context**: AI prompts include dashboard context + recent conversation history
- **Context Limits**: Automatic truncation to last 5 exchanges prevents token overflow