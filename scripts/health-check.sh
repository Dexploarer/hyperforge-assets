#!/bin/bash
# Health Check Script for Asset-Forge CDN
# Usage: ./scripts/health-check.sh [BASE_URL]

set -e

# Default to production URL if not provided
BASE_URL="${1:-https://cdn-production-4e4b.up.railway.app}"

echo "=============================================="
echo "Asset-Forge CDN Health Check"
echo "=============================================="
echo "Target: $BASE_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3

    echo -n "Testing $description... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>&1)

    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $response)"
        return 1
    fi
}

# Function to check endpoint with auth
check_endpoint_auth() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    local api_key=$4

    echo -n "Testing $description... "

    if [ -z "$api_key" ]; then
        echo -e "${YELLOW}⊘ SKIP${NC} (No API key provided)"
        return 0
    fi

    response=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $api_key" "$BASE_URL$endpoint" 2>&1)

    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $response)"
        return 1
    fi
}

# Track failures
failures=0

echo "📊 Basic Endpoints"
echo "---"
check_endpoint "/api/health" "200" "Health check endpoint" || ((failures++))
check_endpoint "/favicon.ico" "204" "Favicon endpoint" || ((failures++))
echo ""

echo "📚 API Documentation"
echo "---"
check_endpoint "/swagger" "200" "Swagger API docs" || ((failures++))
echo ""

echo "📁 Asset Endpoints (Public)"
echo "---"
check_endpoint "/api/assets" "200" "Assets listing" || ((failures++))
check_endpoint "/api/auth/status" "200" "Auth status" || ((failures++))
echo ""

echo "🔐 Protected Endpoints (Require Auth)"
echo "---"
# These should return 401 without auth
check_endpoint "/api/upload" "401" "Upload endpoint (no auth)" || ((failures++))
check_endpoint "/api/delete/test.glb" "401" "Delete endpoint (no auth)" || ((failures++))
echo ""

# Test with API key if provided
if [ -n "$CDN_API_KEY" ]; then
    echo "🔑 Authenticated Endpoints"
    echo "---"
    check_endpoint_auth "/api/files" "200" "Files listing (with auth)" "$CDN_API_KEY" || ((failures++))
    echo ""
fi

echo "📦 Static File Serving"
echo "---"
# These will return 404 if no files exist, which is okay
# We're mainly checking the server is responding
echo -n "Testing /models/ route... "
models_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/models/test.glb" 2>&1)
if [ "$models_response" = "404" ] || [ "$models_response" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Route exists, HTTP $models_response)"
else
    echo -e "${RED}✗ FAIL${NC} (Unexpected response: $models_response)"
    ((failures++))
fi

echo -n "Testing /emotes/ route... "
emotes_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/emotes/test.glb" 2>&1)
if [ "$emotes_response" = "404" ] || [ "$emotes_response" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Route exists, HTTP $emotes_response)"
else
    echo -e "${RED}✗ FAIL${NC} (Unexpected response: $emotes_response)"
    ((failures++))
fi

echo -n "Testing /music/ route... "
music_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/music/test.mp3" 2>&1)
if [ "$music_response" = "404" ] || [ "$music_response" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Route exists, HTTP $music_response)"
else
    echo -e "${RED}✗ FAIL${NC} (Unexpected response: $music_response)"
    ((failures++))
fi
echo ""

echo "🎛️ Dashboard"
echo "---"
# Dashboard login should be accessible
check_endpoint "/dashboard/login" "200" "Dashboard login page" || ((failures++))
echo ""

echo "=============================================="
if [ $failures -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo "=============================================="
    exit 0
else
    echo -e "${RED}✗ $failures check(s) failed${NC}"
    echo "=============================================="
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Check Railway deployment logs"
    echo "2. Verify environment variables are set"
    echo "3. Ensure Railway volume is mounted"
    echo "4. Check if service is running in Railway dashboard"
    echo ""
    exit 1
fi
