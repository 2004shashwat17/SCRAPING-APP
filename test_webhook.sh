#!/bin/bash
# Test script to simulate backend calling webhook

WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:3001/webhook/start-scraping}"
ML_SERVICE_URL="${ML_SERVICE_URL:-http://localhost:5000/predict}"

# Test data
USER_ID="test_user_123"
ACCESS_TOKEN="test_token_EAABsbCS1iHgBO7vL9U3qE8NMrZBsLCl3D"
USERNAME="test_user"

echo "🧪 Testing Webhook Server"
echo "=========================="
echo ""
echo "Sending test request to: $WEBHOOK_URL"
echo "User ID: $USER_ID"
echo "Username: $USERNAME"
echo ""

# Send POST request
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"accessToken\": \"$ACCESS_TOKEN\",
    \"username\": \"$USERNAME\"
  }"

echo ""
echo ""
echo "✅ Test request sent!"
echo "Check the webhook server console for output."

# Optional: call ML service directly (set RUN_ML=1 to enable)
CSV_PATH="scraper_output/${USER_ID}/facebook_integrated_output.csv"
if [ "$RUN_ML" = "1" ]; then
  echo "🔁 Calling ML service at: $ML_SERVICE_URL"
  curl -X POST "$ML_SERVICE_URL" \
    -H "Content-Type: application/json" \
    -d "{\"csv_path\": \"$CSV_PATH\", \"userId\": \"$USER_ID\"}"
  echo ""
fi
