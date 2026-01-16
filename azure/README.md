# Azure deployment helpers for SCRAPING-APP

This folder contains quick scripts to deploy and run your Docker-based scraper on Azure.

Two approaches are provided:

- ACI (Azure Container Instances) — quick POC and on-demand runs
- Container Apps (recommended for production) — managed, autoscaling job support

Prerequisites
-------------
- Install Azure CLI (az) and sign in: `az login`
- Install the Container Apps extension: `az extension add --name containerapp --upgrade`
- Have an Azure subscription you can use and resource group rights
- The Docker image is on Docker Hub: `shashwats500/facebook-scraper`

Quick POC with ACI
------------------
Run `./run_aci_job.sh <RESOURCE_GROUP> <JOB_ID> <FBID> <ACCESS_TOKEN>`

Example:
```
./run_aci_job.sh my-rg job-001 123456789 FAKE_TOKEN
```

This will create an Azure Container Instance that runs the `facebook-scraper` image with the provided env vars and a `--restart-policy Never`.

Container Apps (production path)
--------------------------------
Use `deploy_containerapp_job.sh` to create a Container Apps environment and a job that references your Docker Hub image.

You can then call `az containerapp job run --name <job> --resource-group <rg> --job-name <job>` to trigger runs, or the script provides a helper.

Security note
-------------
- DO NOT store secrets directly in scripts. Use Azure Key Vault and reference them via Container Apps secrets or pass them at runtime via `az containerapp job run --set-env`.

Next steps / Integration
-----------------------
1. After you validate runs, integrate your backend `/api/scraper/run` to call `az containerapp job run` (or use Azure SDK) and poll job status or use callbacks.
2. Store CSV outputs in Azure Blob Storage; your scraper image should upload to a blob path like `scraper-output/<userId>/`.

If you want, I can run through these steps in your Azure subscription or provide a GitHub Actions workflow to call the scripts automatically on job requests.
