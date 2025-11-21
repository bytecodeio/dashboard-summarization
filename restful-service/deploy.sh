#!/bin/bash

# Deploy Dashboard Summarization Backend to Cloud Run
# This script deploys the backend service to GCP Cloud Run

set -e

# Configuration
PROJECT_ID="explore-assistant-cf-mis"
REGION="us-central1"
SERVICE_NAME="dashboard-summarization-backend"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "========================================"
echo "Deploying Dashboard Summarization Backend"
echo "========================================"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Deployment cancelled."
    exit 1
fi

# Set the project
echo "Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Build the Docker image using Cloud Build
echo ""
echo "Building Docker image..."
cd src
gcloud builds submit --tag ${IMAGE_NAME}

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --set-env-vars PROJECT=${PROJECT_ID},REGION=${REGION},MODEL=gemini-2.0-flash-exp \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0

# Get the service URL
echo ""
echo "Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "========================================"
echo "Service URL: ${SERVICE_URL}"
echo "Health Check: ${SERVICE_URL}/health"
echo "Generate Endpoint: ${SERVICE_URL}/generate"
echo "========================================"
echo ""
echo "Update your frontend .env file with:"
echo "BACKEND_SERVICE_URL=${SERVICE_URL}/generate"
echo ""
