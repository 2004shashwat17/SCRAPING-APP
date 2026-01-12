# ML Service (Flask)

A minimal Flask-based ML service to accept a CSV path and return a simple prediction result.

## Endpoint

POST /predict
Body (JSON):
{
  "csv_path": "scraper_output/user_123/facebook_integrated_output.csv",
  "userId": "user_123"
}

Optional: set `X-ML-TOKEN` header if `ML_TOKEN` env var is configured.

## Run locally

1. Create a virtualenv and install requirements:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the service:

```bash
export FLASK_ENV=development
export ML_TOKEN=super-secret   # optional
python app.py
```

The service listens on port 5000 by default.

## Example request

```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -H "X-ML-TOKEN: super-secret" \
  -d '{"csv_path":"scraper_output/test_user_123/facebook_integrated_output.csv","userId":"test_user_123"}'
```

## Notes
- This is a scaffold. Replace `model.py` with a real ML model later.
- For production, deploy the service behind authentication and TLS.

## Deployment & security

- Run the service in Docker (see `Dockerfile`) and place it on an internal network (e.g., `ml-service:5000`) so only backend/scraper can reach it.
- Use a secret header `X-ML-TOKEN` (set `ML_TOKEN` env var) or other auth to prevent unauthorized access.
- For large CSVs prefer uploading artifacts to object storage (S3/GCS) and passing an object path instead of raw file paths.
