#!/usr/bin/env bash
set -euo pipefail

# azure_blob_setup.sh <RESOURCE_GROUP> <STORAGE_ACCOUNT_NAME> <CONTAINER_NAME>
RG=${1:-myResourceGroup}
SA=${2:-scraperstorageacct}
CONTAINER=${3:-scraper-output}
LOCATION=${4:-eastus}

echo "Creating resource group $RG (if missing)"
az group create -n "$RG" -l "$LOCATION"

echo "Creating storage account $SA"
az storage account create -n "$SA" -g "$RG" --sku Standard_LRS --location "$LOCATION"

echo "Getting storage connection string"
CONN=$(az storage account show-connection-string -n "$SA" -g "$RG" -o tsv)

echo "Creating blob container $CONTAINER"
az storage container create --name "$CONTAINER" --connection-string "$CONN"

echo "Save connection string somewhere secure. Example usage: export AZURE_STORAGE_CONNECTION_STRING=\"$CONN\""
