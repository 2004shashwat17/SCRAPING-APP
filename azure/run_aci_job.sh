#!/usr/bin/env bash
set -euo pipefail

# run_aci_job.sh <RESOURCE_GROUP> <JOB_ID> <FBID> <ACCESS_TOKEN>
RG=${1:-}
JOB_ID=${2:-job-$(date +%s)}
FBID=${3:-123456789}
ACCESS_TOKEN=${4:-""}

if [ -z "$RG" ]; then
  echo "Usage: $0 <RESOURCE_GROUP> <JOB_ID> <FBID> <ACCESS_TOKEN>" >&2
  exit 2
fi

CONTAINER_NAME="scraper-${JOB_ID}"
IMAGE="shashwats500/facebook-scraper"

echo "Starting ACI job: $CONTAINER_NAME in rg=$RG"

# Create a temporary container instance (runs and exits)
az container create \
  --resource-group "$RG" \
  --name "$CONTAINER_NAME" \
  --image "$IMAGE" \
  --restart-policy Never \
  --environment-variables "ACCESS_TOKEN=$ACCESS_TOKEN" "FBID=$FBID" \
  --cpu 1 --memory 1.5 \
  --query '{name:name, provisioningState:provisioningState}' -o table

echo "ACI container started. Check logs with: az container logs -g $RG -n $CONTAINER_NAME"
