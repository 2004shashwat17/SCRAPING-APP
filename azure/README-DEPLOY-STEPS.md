## Quick Deploy Steps (POC)

1) Login to Azure CLI

```bash
az login
az account set --subscription <YOUR_SUBSCRIPTION_ID>
```

2) Create Blob Storage for outputs

```bash
./azure/azure_blob_setup.sh my-rg mysamplestorageacct scraper-output
export AZURE_STORAGE_CONNECTION_STRING="$(az storage account show-connection-string -n mysamplestorageacct -g my-rg -o tsv)"
```

3) Run quick ACI job (POC)

```bash
./azure/run_aci_job.sh my-rg job-001 123456789 FAKE_TOKEN
az container logs -g my-rg -n scraper-job-001
```

4) Provision Container Apps env + job (production path)

```bash
./azure/deploy_containerapp_job.sh my-rg scraper-env scraper-job eastus
# Run a job (set env vars when running)
az containerapp job run --resource-group my-rg --name scraper-job --set-env ACCESS_TOKEN="<token>" FBID="123456789"
```

5) Integration notes

- When a job runs, configure the container to upload 0_<fbid>.csv to the Blob container `scraper-output/<userId>/`.
- Your backend can call the Container Apps job run API to start runs and poll status via `az containerapp job show` or use the REST API.
