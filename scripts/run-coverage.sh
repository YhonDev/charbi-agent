#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "📊 Generating coverage reports..."
pytest tests/ --cov=src --cov-report=html:tests/coverage/html
