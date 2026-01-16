#!/usr/bin/env bash
set -euo pipefail

# deploy_containerapp_job.sh <RESOURCE_GROUP> <ENV_NAME> <JOB_NAME> [LOCATION]
RG=${1:-myResourceGroup}
ENV_NAME=${2:-scraper-env}
JOB_NAME=${3:-scraper-job}
LOCATION=${4:-eastus}

echo "Creating resource group: $RG (location=$LOCATION)"
az group create -n "$RG" -l "$LOCATION"

echo "Creating Container Apps environment: $ENV_NAME"
az containerapp env create -g "$RG" -n "$ENV_NAME" --location "$LOCATION"

echo "Creating Container App Job: $JOB_NAME"
az containerapp job create \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --name "$JOB_NAME" \
  --container-name "scraper" \
  --image "shashwats500/facebook-scraper" \
  --cpu 1 --memory 1.5 \
  --restart-policy Never \
  --replicas 1 \
  --max-retries 1

echo "Container Apps job $JOB_NAME created. Run it with:\n az containerapp job run -g $RG --name $JOB_NAME --set-env ACCESS_TOKEN=<token> FBID=<fbid>"
