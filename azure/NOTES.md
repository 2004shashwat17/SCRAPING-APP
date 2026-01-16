Notes / Next Steps
------------------

- The scripts are POC-level helpers. For production, move configs to IaC (Bicep/Terraform) and use Key Vault for secrets.
- Integrate backend to call `az containerapp job run` or ACI commands (use a service principal and Azure SDK rather than shelling out in production).
- Add monitoring via Application Insights and configure alerts for failures, long running jobs, and cost thresholds.
