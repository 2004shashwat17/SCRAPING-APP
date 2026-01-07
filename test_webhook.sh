#!/bin/bash
# Test script to simulate backend calling webhook

WEBHOOK_URL="http://localhost:3001/webhook/start-scraping"

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
