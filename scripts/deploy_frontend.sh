#!/usr/bin/env bash
# scripts/deploy_frontend.sh — build + deploy frontend to Cloudflare Pages.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../frontend"
yarn deploy
