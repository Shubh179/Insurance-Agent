# Cloudflare Worker Deployment Script
# Run this after deploying your Cloudflare Worker

# Step 1: Set your Cloudflare Worker URL
$WORKER_URL = "https://mcp-persona.your-subdomain.workers.dev/mcp/persona"

# Step 2: Update Convex environment variable
Write-Host "Setting Cloudflare Worker URL in Convex..." -ForegroundColor Yellow
npx convex env set CLOUDFLARE_WORKER_URL $WORKER_URL --prod

# Step 3: Verify deployment
Write-Host "`nTesting endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://hushed-magpie-545.convex.site/mcp/persona" -Method POST -Body '{"user_id":"609ab060-cf41-4d83-a7fc-a4dab9aa22ad"}' -ContentType "application/json"
    Write-Host "✓ Success!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "✗ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
