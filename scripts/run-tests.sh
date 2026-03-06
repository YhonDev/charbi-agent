#!/bin/bash
################################################################################
# 🧪 Charbi Test Runner
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

run_unit_tests() {
    log_info "Running unit tests..."
    python3 -m pytest tests/unit/ \
        -v \
        --tb=short \
        --cov=src \
        --cov-report=html:tests/coverage/html \
        --cov-report=xml:tests/coverage/xml/coverage.xml \
        --cov-fail-under=70 \
        -m unit \
        "$@"
}

run_integration_tests() {
    log_info "Running integration tests..."
    python3 -m pytest tests/integration/ \
        -v \
        --tb=short \
        -m integration \
        "$@"
}

run_e2e_tests() {
    log_info "Running E2E tests..."
    python3 -m pytest tests/e2e/ \
        -v \
        --tb=short \
        -m e2e \
        "$@"
}

run_all_tests() {
    log_info "Running all tests..."
    python3 -m pytest tests/ \
        -v \
        --tb=short \
        --cov=src \
        --cov-report=html:tests/coverage/html \
        --cov-report=xml:tests/coverage/xml/coverage.xml \
        --cov-report=json:tests/coverage/json/coverage.json \
        --cov-fail-under=80 \
        "$@"
}

run_quick_tests() {
    log_info "Running quick tests..."
    python3 -m pytest tests/unit/ \
        -v \
        --tb=short \
        -m "not slow" \
        "$@"
}

show_coverage() {
    log_info "Opening coverage report..."
    if [ -f "tests/coverage/html/index.html" ]; then
        open tests/coverage/html/index.html 2>/dev/null || \
        xdg-open tests/coverage/html/index.html 2>/dev/null || \
        log_warning "Cannot open coverage report"
    else
        log_error "Coverage report not found"
    fi
}

clean_test_artifacts() {
    log_info "Cleaning test artifacts..."
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
    rm -rf tests/coverage/html/* 2>/dev/null || true
    log_success "Test artifacts cleaned"
}

show_help() {
    cat << EOF
🧪 Charbi Test Runner

Usage: $0 [command] [options]

Commands:
    unit          Run unit tests only
    integration   Run integration tests only
    e2e           Run E2E tests only
    all           Run all tests (default)
    quick         Run quick tests (no coverage)
    coverage      Open coverage report
    clean         Clean test artifacts
    help          Show this help

Examples:
    $0 unit
    $0 integration -k test_taskgraph
    $0 all --no-cov
    $0 quick -x

EOF
}

main() {
    case "${1:-all}" in
        unit) shift; run_unit_tests "$@" ;;
        integration) shift; run_integration_tests "$@" ;;
        e2e) shift; run_e2e_tests "$@" ;;
        all) shift; run_all_tests "$@" ;;
        quick) shift; run_quick_tests "$@" ;;
        coverage) show_coverage ;;
        clean) clean_test_artifacts ;;
        help|--help|-h) show_help ;;
        *) log_error "Unknown command: $1"; show_help; exit 1 ;;
    esac
}

main "$@"
