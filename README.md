# Looker Dashboard Summarization

This is an extension or plugin for Looker that integrates LLM's hosted on Vertex AI into a dashboard summarization experience.

> **Branch Notice**: This `shared_cloud_backend2` branch is optimized for sharing backend infrastructure with the [Looker Explore Assistant](https://github.com/looker-open-source/looker-explore-assistant). It supports both shared and standalone deployment options.

![explore assistant](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzRrZ200dnB3YWg1Y3AwazVjdm44ZWx3dWZjZ2NtcGVieWZuY3VmNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/kIXodRHInpIds8KPvC/giphy.gif)

## Description

The Dashboard Summarization extension can be broken down into 3 parts:

 1. **Summarization**
	 - Generates concise summaries on your dashboard's data
 2. **Prescription**
	 - Grounded in your dashboard's data, it can prescribe operational actions and point out outliers
 3. **Action**
	 - Leveraging Looker's API, insights can be exported into the business tools your organization uses

Additionally, the extension provides:

 - Google Chat Export (*Oauth integration to export the summary to Google Chat*)
 - Slack Export (*Oauth integration to export the summary to Slack in rich text*)

Upcoming capabilities on the roadmap:

 - Next Steps to Visualization
 - Google Slides Integration
 - Regenerate and Refine (*regenerate summary with custom input prompt*)

### Technologies Used
#### Frontend
- [React](https://reactjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Webpack](https://webpack.js.org/)

#### Looker
- [Looker Extension SDK](https://github.com/looker-open-source/sdk-codegen/tree/main/packages/extension-sdk-react)
- [Looker Query API](https://developers.looker.com/api/explorer/4.0/methods/Query)

#### Backend API
- [Google Cloud Platform](https://cloud.google.com/)
- [Vertex AI](https://cloud.google.com/vertex-ai)
- [Cloud Run](https://cloud.google.com/run?hl=en)

#### Export API's
- [Slack](https://api.slack.com/authentication/oauth-v2)
- [GChat](https://developers.google.com/chat/api/guides/auth/users)
- ---

## Setup

![simple-architecture](./src/assets/dashboard-summarization-architecture.png)

## Deployment Options

This dashboard-summarization extension supports two deployment architectures:

1. **Shared Backend with Explore Assistant** (Recommended) - Use the shared cloud backend from the explore-assistant project
2. **Standalone Backend** - Deploy your own dedicated backend service

### Option 1: Shared Backend with Explore Assistant (Recommended)

If you have the [Looker Explore Assistant](https://github.com/looker-open-source/looker-explore-assistant) deployed, you can share its backend infrastructure with the dashboard-summarization extension. This approach provides:

- **Cost Efficiency**: Single backend serves both applications
- **Unified Authentication**: One OAuth setup for both extensions  
- **Simplified Management**: Single deployment to maintain
- **Consistent Experience**: Same AI model and settings across both tools

#### Prerequisites
- Deployed Looker Explore Assistant with Cloud Run backend
- Google Cloud OAuth 2.0 credentials configured
- Admin access to both Looker extensions

#### Setup Instructions

1. **Get the Explore Assistant Backend URL**
   
   Find your deployed explore-assistant Cloud Run URL:
   ```bash
   gcloud run services list --filter="dashboard-summarization OR explore-assistant"
   ```
   
   The URL will look like: `https://your-service-name-xxxxxxxxxx-xx.a.run.app`

2. **Configure Dashboard Summarization Settings**
   
   In your Looker instance, open the Dashboard Summarization extension and click the Settings gear icon (admin access required):
   
   - **Cloud Endpoint**: Enter your explore-assistant backend URL
   - **Vertex Project**: Your Google Cloud Project ID
   - **Vertex Location**: Your Vertex AI region (e.g., `us-central1`)
   - **Vertex Model**: AI model name (e.g., `gemini-2.0-flash`)
   - **Google OAuth Client ID**: Your OAuth 2.0 client ID

3. **Verify OAuth Configuration**
   
   Ensure your OAuth client has the dashboard-summarization callback URL:
   - Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
   - Edit your OAuth 2.0 client
   - Add authorized redirect URI: `https://your-looker-instance.cloud.looker.com/extensions/dashboard-summarization/oauth-callback`

4. **Test the Integration**
   
   - Open a Looker dashboard
   - Launch the Dashboard Summarization extension
   - Verify OAuth authentication works
   - Test generating a dashboard summary

#### Shared Backend Benefits

- **Single Point of Maintenance**: Update AI models and settings in one place
- **Resource Optimization**: Shared compute resources and cost allocation
- **Consistent AI Behavior**: Same prompts and model configurations
- **Unified Monitoring**: Combined logging and metrics for both applications

---

### Option 2: Standalone Backend Deployment

If you prefer to deploy a dedicated backend for dashboard-summarization, follow these instructions:

### 1. Generative AI & Restful Server

This section describes how to set up the web server on Cloud Run powering the Generative AI and Restful integrations

#### Getting Started for Local Development

1. Clone or download a copy of this repository to your development machine.

   ```bash
   # cd ~/ Optional. your user directory is usually a good place to git clone to.
   git clone https://github.com/looker-open-source/dashboard-summarization.git
   ```

2. Navigate (`cd`) to the template directory on your system

   ```bash
   cd dashboard-summarization/restful-service/src
   ```

3. Install the dependencies with [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).

   ```bash
   npm install
   ```

   > You may need to update your Node version or use a [Node version manager](https://github.com/nvm-sh/nvm) to change your Node version.

4. Add a secret key for the server to operate securely.
   This hash can be created by any means, it is a secret used both in Looker and in the backend app.

   ```bash
   EXPORT GENAI_CLIENT_SECRET=<SOME SECRET KEY>
   ```

   The same secret key should be added as a Default Value in Looker as a User Attribute with a name of <model_name>_dashboard_summarization_genai_client_secret

4. Start the development server

   ```bash
   npm run start
   ```
	Your development server should be running at http://localhost:5000

#### Deployment

1. For deployment you will need to build the docker file and submit it to the [Artifact Registry](https://cloud.google.com/artifact-registry). You need to first create a repository. Update `location` to your deployment region, then run this command from root
	```bash
	gcloud artifacts repositories create dashboard-summarization-docker-repo  --repository-format=docker  --location=REGION
	```

2. Navigate to template directory
	```bash
	cd dashboard-summarization/restful-service/src
	```

3. Update cloudbuild.yaml
	```
	<YOUR_REGION> = Your deployment region
   <YOUR_PROJECT_ID> = Your GCP project ID
	```

4. Build Docker File and Submit to Artifact Registry, replacing the `REGION` variable with your deployment region.
*Skip this step if you already have a deployed image.* Please see the [official docs](https://cloud.google.com/build/docs/configuring-builds/create-basic-configuration) for creating the yaml file.
	```bash
	gcloud auth login && gcloud auth application-default login && gcloud builds submit --region=REGION --config cloudbuild.yaml
	```
	Save the returned docker image url. You can also get the docker image url from the Artifact Registry

5. Navigate (`cd`) to the terraform directory on your system
	```bash
	cd .. && cd terraform
	```
6. Replace defaults in the `variables.tf` file for project, region, docker url and service name.
	```
	project_id=<GCP project ID>
   deployment_region=<Your deployement region>
   docker_image=<The docker image url from step 5>
	```

7. Deploy resources. [*Ensure Application Default Credentials for GCP for Exported in your Environment first.*](https://cloud.google.com/docs/authentication/provide-credentials-adc#google-idp)

   ```terraform
   terraform init

   terraform plan

   terraform apply
   ```

8. Save Deployed Cloud Run URL Endpoint

#### Optional: Setup Log Sink to BQ for LLM Cost Estimation and Request Logging

This extension will make a call to Vertex for each query in the dashboard and one final call to format all the summaries. Each request is logged with billable characters that can be used to 
estimate and monitor costs. Please see [Google Cloud's docs](https://cloud.google.com/logging/docs/export/configure_export_v2#creating_sink) on setting up a log sink to BQ, using the below filter for Dashboard Summarization Logs (*change location and service name if those variables have been updated*):

```
resource.type = "cloud_run_revision"
resource.labels.service_name = "restful-service"
resource.labels.location = "us-central1"
 severity>=DEFAULT
jsonPayload.component="dashboard-summarization-logs"
```

### 2. Google Cloud OAuth Setup for Vertex AI

To enable authentication with Vertex AI (required for both shared and standalone backends), you need to set up OAuth credentials in Google Cloud:

> **Note**: If using the shared explore-assistant backend, you can reuse the existing OAuth configuration from that deployment.

1. **Create or Select a Google Cloud Project**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Use the same project as your explore-assistant (for shared backend) or create a new project for standalone deployment

2. **Enable Required APIs**
   - Navigate to "APIs & Services" > "Library"
   - Search for and enable the following APIs:
     - Vertex AI API
     - Cloud Resource Manager API

3. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Select the appropriate user type (Internal or External)
   - Fill in the required fields:
     - App name: "Dashboard Summarization"
     - User support email: Your email address
     - Developer contact information: Your email address
   - Add the following scopes:
     - `https://www.googleapis.com/auth/cloud-platform`
   - Save and continue

4. **Create OAuth Client ID**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" and select "OAuth client ID"
   - Application type: Web application
   - Name: "Dashboard Summarization Looker Extension"
   - Authorized JavaScript origins:
     - Add your Looker instance URL (e.g., `https://your-looker-instance.cloud.looker.com`)
   - Authorized redirect URIs:
     - Add your Looker instance URL followed by `/extensions/dashboard-summarization-extension/oauth-callback` 
     - Example: `https://your-looker-instance.cloud.looker.com/extensions/dashboard-summarization-extension/oauth-callback`
   - Click "Create"

5. **Copy the Client ID**
   - After creation, you'll see the Client ID displayed
   - Copy this value to use in the extension settings

6. **Configure the Extension Settings**
   - Launch the Dashboard Summarization extension in Looker
   - Click the "Settings" gear icon
   - Paste your Client ID in the "Google OAuth Client ID" field
   - Configure the Vertex AI project, location, and model settings
   - Click "Authenticate" to connect with your Google account

> **Note:** Ensure the Google Cloud account you use has appropriate permissions for Vertex AI. You may need to add appropriate IAM roles (like "Vertex AI User") to your account in the Google Cloud project.

### 3. Looker Extension Framework Setup


#### Getting Started for Local Development

1. Clone or download a copy of this repository to your development machine (if you haven't already).

   ```bash
   # cd ~/ Optional. your user directory is usually a good place to git clone to.
   git clone https://github.com/looker-open-source/dashboard-summarization.git
   ```

2. Navigate (`cd`) to the root directory in the cloned repo

3. Ensure All the Appropriate Environment Variables are set. Copy .env.example file and save as .env
*See Export Integration Steps below for Slack and Gchat Variables. These are optional, except RESTFUL_SERVICE*
```
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
CHANNEL_ID=
SPACE_ID=
RESTFUL_SERVICE=<Required: Cloud run endpoint url>
```

4. Install the dependencies with [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).

   ```bash
   npm install
   ```

   > You may need to update your Node version or use a [Node version manager](https://github.com/nvm-sh/nvm) to change your Node version.
   > If you get errors installing dependencies, you may try
   ```bash
   npm install --legacy-peer-deps
   ```

5. Start the development server

   ```bash
   npm run develop
   ```

   Great! Your extension is now running and serving the JavaScript at http://localhost:8080/bundle.js.

6. Now log in to Looker and create a new project.

   This is found under **Develop** => **Manage LookML Projects** => **New LookML Project**.

   You'll want to select "Blank Project" as your "Starting Point". You'll now have a new project with no files.

   1. In your copy of the extension project you have a `manifest.lkml` file.

   You can either drag & upload this file into your Looker project, or create a `manifest.lkml` with the same content. Change the `id`, `label`, or `url` as needed.

  

      project_name: "dashboard-summarization-extension"
        
        application: dashboard-summarization {
          label: "Dashboard Insights Powered by Vertex AI"
          # file: "bundle.js"
          url: "http://localhost:8080/bundle.js"
          mount_points: {
            dashboard_vis: yes
            dashboard_tile: yes
            standalone: yes
          }
          entitlements: {
            local_storage: yes
            use_form_submit: yes
            core_api_methods: ["run_inline_query","all_lookml_models","dashboard","dashboard_dashboard_elements"]
            external_api_urls: [
              "YOUR_BACKEND_URL",  # Replace with your explore-assistant or standalone backend URL
              "http://localhost:5000",  # For local development
              "http://localhost:3000",  # For local development  
              "https://*.googleapis.com",  # Required for Vertex AI API calls
              "https://slack.com/api/*",  # Optional: for Slack integration
              "https://slack.com/*"  # Optional: for Slack integration
            ]
            oauth2_urls: [
              "https://accounts.google.com/o/oauth2/v2/auth",
              "https://www.googleapis.com/auth/chat.spaces",
              "https://www.googleapis.com/auth/drive.metadata.readonly",
              "https://www.googleapis.com/auth/spreadsheets.readonly",
              "https://www.googleapis.com/auth/userinfo.profile",
              "https://www.googleapis.com/auth/chat.spaces.readonly",
              "https://www.googleapis.com/auth/chat.bot",
              "https://www.googleapis.com/auth/chat.messages",
              "https://www.googleapis.com/auth/chat.messages.create",
              "https://slack.com/oauth/v2/authorize"
            ]
          }
        }

7. Create a `model` LookML file in your project. The name doesn't matter. The model and connection won't be used, and in the future this step may be eliminated.

   - Add a connection in this model. It can be any connection, it doesn't matter which.
   - [Configure the model you created](https://docs.looker.com/data-modeling/getting-started/create-projects#configuring_a_model) so that it has access to some connection.

8. Connect your new project to Git. You can do this multiple ways:

   - Create a new repository on GitHub or a similar service, and follow the instructions to [connect your project to Git](https://docs.looker.com/data-modeling/getting-started/setting-up-git-connection)
   - A simpler but less powerful approach is to set up git with the "Bare" repository option which does not require connecting to an external Git Service.

9. Commit your changes and deploy your them to production through the Project UI.

10. Reload the page and click the `Browse` dropdown menu. You should see your extension in the list.
   - The extension will load the JavaScript from the `url` provided in the `application` definition. By default, this is https://localhost:8080/bundle.js. If you change the port your server runs on in the package.json, you will need to also update it in the manifest.lkml.

- Refreshing the extension page will bring in any new code changes from the extension template, although some changes will hot reload.


#### Deployment

The process above requires your local development server to be running to load the extension code. To allow other people to use the extension, a production build of the extension needs to be run. As the kitchensink uses code splitting to reduce the size of the initially loaded bundle, multiple JavaScript files are generated.

1. In your extension project directory on your development machine, build the extension by running the command `npm run build`.
2. Drag and drop the generated JavaScript file(bundle.js) contained in the `dist` directory into the Looker project interface.
3. Modify your `manifest.lkml` to use `file` instead of `url` and point it at the `bundle.js` file.

Note that the additional JavaScript files generated during the production build process do not have to be mentioned in the manifest. These files will be loaded dynamically by the extension as and when they are needed. Note that to utilize code splitting, the Looker server must be at version 7.21 or above.

---

## Switching Between Deployment Modes

You can switch between shared backend and standalone backend configurations without redeploying the extension:

### Switch to Shared Backend
1. Open the Dashboard Summarization extension in Looker
2. Click the Settings gear icon (requires admin access)
3. Configure the following settings:
   - **Cloud Endpoint**: Enter your explore-assistant backend URL (e.g., `https://your-explore-assistant-xxxxx-xx.a.run.app`)
   - **Vertex Project**: Your Google Cloud Project ID
   - **Vertex Location**: Your Vertex AI region
   - **Vertex Model**: AI model name
   - **Google OAuth Client ID**: Your OAuth client ID
4. Save settings and test authentication

### Switch to Standalone Backend
1. Deploy your own dashboard-summarization backend using the instructions in "Option 2: Standalone Backend Deployment"
2. Update the extension settings:
   - **Cloud Endpoint**: Enter your dedicated backend URL
   - Configure other Vertex AI settings as needed
3. Ensure your OAuth client includes the correct redirect URIs for both extensions

### Configuration Validation
- Test OAuth authentication works correctly
- Verify dashboard summaries generate successfully  
- Check that conversation history persists properly
- Monitor Cloud Run logs for any errors

> **Tip**: Settings are stored in the Looker extension context and persist across sessions. You can easily switch between backends for testing or migration purposes.

---

### 3. [Optional] Export Integration Setup

 #### Slack OAuth Setup 
 1. Follow the official Slack developer docs to setup an [OAuth Application](https://api.slack.com/authentication/oauth-v2)
 2. Acquire a `SLACK_CLIENT_ID`  and `SLACK_CLIENT_SECRET` from the OAuth app created in Step 1 and add them to the `.env` file.
 3. Attach the appropriate [User & Bot Scopes](https://api.slack.com/scopes) (recommended to at least have `channels:read` and `channels:write`)
 4. [Optional] if making Bot requests, add the bot to channels you want it accessing.

> To note, the Slack integration hardcodes a specific channel id in the code. These can be modified or an additional API request made to provide a channel selector experience.

#### Google Chat OAuth Setup
1. Follow the official Google Chat developer docs to setup an [OAuth Application](https://developers.google.com/chat/api/guides/auth)
2. Acquire a `GOOGLE_CLIENT_ID` from the OAuth app created in Step 1 and add them to the `.env` file.
3. Configure a [Google Chat Bot](https://developers.google.com/chat/quickstart/gcf-app) to send messages (*this bot is only used for message ownership and not used to call the Google Chat API*)
4. Add bot to specific Google Chat Spaces.

> To note, the Google Chat Integration hardcodes a specific space id in the code. These can be modified or an additional API request made to provide a space selector experience.

---

### Recommendations for fine tuning the model

This app uses a one shot prompt technique for fine tuning the LLM, meaning that all the metadata for the dashboard and request is contained in the prompt. To improve the accuracy, detail, and depth of the summaries and prescriptive steps returned by the LLM please pass as much context about the dashboard and the general recommendation themes in the prompt sent to the model. This can all be done through Looker as opposed to hard coded in the Cloud Run Service. Details below:
* Add dashboard details to each dashboard the extension is added to. This is used to inform the LLM of the general context of the report (see [these docs](https://cloud.google.com/looker/docs/editing-user-defined-dashboards#editing_dashboard_details) for more detail).
* Add notes to each tile on a dashboard. This is used to inform the LLM of the general context of each individual query on the dashboard. Use this to add small contextual notes the LLM should consider when generating the summary (see [these docs](https://cloud.google.com/looker/docs/editing-user-defined-dashboards#:~:text=Adding%20a%20tile%20note,use%20plain%20text%20or%20HTML.) for more details on adding tile notes).

---

## Troubleshooting

### Shared Backend Issues

**Authentication Errors**
- Verify OAuth client ID is correct in extension settings
- Ensure the redirect URI includes `/extensions/dashboard-summarization/oauth-callback` 
- Check that the same Google Cloud project is used for both extensions
- Confirm the user has Vertex AI permissions in the Google Cloud project

**Backend Connection Issues**
- Verify the Cloud Endpoint URL is correct and accessible
- Check that the explore-assistant backend is deployed and running
- Ensure Cloud Run service allows unauthenticated requests or has proper IAM configured
- Test the backend URL directly: `curl -X GET https://your-backend-url/health`

**Model Configuration Issues**
- Verify Vertex AI API is enabled in your Google Cloud project
- Check that the specified model (e.g., `gemini-2.0-flash`) is available in your region
- Ensure the Vertex AI location matches your Cloud Run deployment region
- Validate that your project has Vertex AI quotas and billing enabled

**Extension Settings Not Saving**
- Confirm you have admin access in Looker to modify extension settings
- Try refreshing the browser and reopening the settings modal
- Check browser developer console for any JavaScript errors
- Verify the extension has `local_storage` entitlements in the manifest

**Dashboard Summary Errors**
- Check that OAuth authentication completed successfully (green checkmark)
- Verify the dashboard has queries with data returned
- Ensure the conversation history isn't hitting token limits (clear chat if needed)
- Monitor Cloud Run logs for backend errors: `gcloud logs tail --service=your-service-name`

### Getting Help

- Check the [Looker Community](https://community.looker.com/) for common issues
- Review Cloud Run service logs for detailed error messages
- Enable debug mode in browser developer tools to see detailed request/response data
- For shared backend issues, also check the explore-assistant documentation and logs
