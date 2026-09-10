#!/bin/bash
# Security audit script for QuantScreen
# Runs all security checks and reports findings

set -e

echo "========================================="
echo "🔒 QuantScreen Security Audit"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Dependencies audit (server)
echo "📦 [1/5] Auditing server dependencies..."
cd ../server
npm audit --json > ../infrastructure/reports/server-audit.json 2>&1 || true
if grep -q '"critical":' ../infrastructure/reports/server-audit.json; then
    echo -e "${RED}⚠️  Critical vulnerabilities found in server!${NC}"
else
    echo -e "${GREEN}✅ Server dependencies OK${NC}"
fi

# 2. Dependencies audit (web)
echo "📦 [2/5] Auditing web dependencies..."
cd ../web
npm audit --json > ../infrastructure/reports/web-audit.json 2>&1 || true
if grep -q '"critical":' ../infrastructure/reports/web-audit.json; then
    echo -e "${RED}⚠️  Critical vulnerabilities found in web!${NC}"
else
    echo -e "${GREEN}✅ Web dependencies OK${NC}"
fi

# 3. Secrets scanning with gitleaks
echo "🔑 [3/5] Scanning for hardcoded secrets..."
cd ..
if command -v gitleaks &> /dev/null; then
    gitleaks detect --source . --config .gitleaks.toml --report-format json --report-path infrastructure/reports/gitleaks-report.json || true
    if [ -f infrastructure/reports/gitleaks-report.json ]; then
        FOUND=$(jq '. | length' infrastructure/reports/gitleaks-report.json 2>/dev/null || echo "0")
        if [ "$FOUND" -gt 0 ]; then
            echo -e "${RED}⚠️  Found $FOUND secrets! Check infrastructure/reports/gitleaks-report.json${NC}"
        else
            echo -e "${GREEN}✅ No secrets found${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  gitleaks not installed. Install with: brew install gitleaks (macOS) or https://github.com/gitleaks/gitleaks${NC}"
fi

# 4. Check environment variables
echo "🔐 [4/5] Checking environment variables..."
if [ -f server/.env ]; then
    if grep -q "CHANGE_ME" server/.env; then
        echo -e "${RED}⚠️  .env contains placeholder values! Replace CHANGE_ME${NC}"
    else
        echo -e "${GREEN}✅ .env looks good${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  server/.env not found${NC}"
fi

# 5. Check for hardcoded secrets in code
echo "🔍 [5/5] Scanning code for secrets..."
grep -r --include="*.ts" --include="*.js" --include="*.env" \
  -E "(password|secret|key|token|api[_-]?key)[[:space:]]*=[[:space:]]*['\"][^'\"]{16,}['\"]" \
  server/src web/src 2>/dev/null | grep -v "CHANGE_ME" | grep -v ".env.example" | grep -v "node_modules" || echo -e "${GREEN}✅ No obvious hardcoded secrets${NC}"

echo ""
echo "========================================="
echo "✅ Audit complete. Reports saved to infrastructure/reports/"
echo "========================================="