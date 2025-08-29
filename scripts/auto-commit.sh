#!/bin/bash
set -e

echo "🤖 Auto-committing Claude changes..."

# Add all changes
git add -A

# Regenerate contracts if schemas changed
if git diff --cached --name-only | grep -qE "packages/contracts/.*schemas|openapi\.ts"; then
  echo "📋 Regenerating contracts..."
  cd packages/contracts && npm run contracts:gen && git add openapi.json && cd ../..
fi

# Validation gates
echo "🔍 Validating..."

# Run TypeScript compilation check
if command -v npx &> /dev/null && [ -f "apps/api/tsconfig.json" ]; then
  echo "Running TypeScript check..."
  cd apps/api && npx tsc --noEmit && cd ../..
fi

# Run tests if test command exists
if [ -f "apps/api/package.json" ] && grep -q '"test"' apps/api/package.json; then
  echo "Running tests..."
  cd apps/api && npm test && cd ../..
fi

# Get commit message from argument or use default
if [ -n "$1" ]; then
  commit_msg="$1"
else
  commit_msg="feat: rebuild API with simplified MVP structure following CLAUDE.md guidelines"
fi

# Commit
git commit -m "$commit_msg

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "✅ Committed: $(git log -1 --oneline)"

# Optional auto-push
[ "$AUTO_PUSH" = "true" ] && git push origin $(git branch --show-current)