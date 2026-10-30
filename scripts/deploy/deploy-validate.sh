#!/bin/bash

#################################################################################
# Pre-deployment Validation Script
# Validates all Phase 1-4 tools and configurations before deployment
#################################################################################

set -e

FRAMEWORK_PATH="${1:-.}"
REPORT_PATH="${2:-.}/validation-report.json"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Initialize report structure
cat > "$REPORT_PATH" << 'EOF'
{
  "timestamp": "",
  "framework_version": "",
  "validation_status": "PENDING",
  "sections": {
    "tools": {"status": "PENDING", "details": []},
    "configurations": {"status": "PENDING", "details": []},
    "health_checks": {"status": "PENDING", "details": []},
    "breaking_changes": {"status": "PENDING", "details": []},
    "dependencies": {"status": "PENDING", "details": []}
  },
  "summary": {
    "total_checks": 0,
    "passed_checks": 0,
    "failed_checks": 0,
    "warnings": 0
  }
}
EOF

log_file="validation-$(date +%s).log"

function write_log() {
    local message=$1
    local level=${2:-INFO}
    local timestamp=$(date '+%H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$log_file"
}

function validate_tools() {
    write_log "Validating tools..." "INFO"

    # Define Phase 1-4 tools (20 total)
    local tools=(
        # Phase 1: Core Validation Tools
        "requirement-validator"
        "user-story-analyzer"
        "test-case-generator"
        "acceptance-criteria-checker"

        # Phase 2: Advanced Testing Tools
        "regression-test-suite"
        "performance-test-runner"
        "security-test-scanner"
        "integration-test-executor"

        # Phase 3: Automation & CI/CD Tools
        "test-automation-framework"
        "ci-cd-pipeline"
        "deployment-validator"
        "monitoring-dashboard"

        # Phase 4: Production Tools
        "production-health-monitor"
        "canary-deployment-manager"
        "gradual-rollout-orchestrator"
        "rollback-automation"
        "metrics-collector"
        "alerting-system"
        "documentation-generator"
    )

    local tools_path="$FRAMEWORK_PATH/tools"

    if [ ! -d "$tools_path" ]; then
        write_log "Tools directory not found at $tools_path" "ERROR"
        return 1
    fi

    write_log "Tools directory found at $tools_path" "SUCCESS"

    for tool in "${tools[@]}"; do
        local tool_path="$tools_path/$tool"
        local tool_config="$tool_path/config.json"

        if [ ! -d "$tool_path" ]; then
            write_log "Tool not found: $tool" "ERROR"
            continue
        fi

        write_log "Tool found: $tool" "SUCCESS"

        # Check tool config
        if [ -f "$tool_config" ]; then
            if python3 -m json.tool "$tool_config" > /dev/null 2>&1; then
                write_log "Tool config valid: $tool" "SUCCESS"
            else
                write_log "Tool config invalid JSON: $tool" "ERROR"
            fi
        fi
    done
}

function validate_configurations() {
    write_log "Validating configurations..." "INFO"

    local config_files=(
        "config/deployment.json"
        "config/environments.json"
        "config/metrics.json"
        "config/alerts.json"
    )

    for config_file in "${config_files[@]}"; do
        local full_path="$FRAMEWORK_PATH/$config_file"

        if [ ! -f "$full_path" ]; then
            write_log "Config file not found: $config_file" "WARNING"
            continue
        fi

        write_log "Config file found: $config_file" "SUCCESS"

        if python3 -m json.tool "$full_path" > /dev/null 2>&1; then
            write_log "Config format valid: $config_file" "SUCCESS"
        else
            write_log "Config format invalid: $config_file" "ERROR"
        fi
    done
}

function validate_health_checks() {
    write_log "Validating health checks..." "INFO"

    # Check disk space (min 10GB)
    local available_space=$(df "$FRAMEWORK_PATH" | awk 'NR==2 {print $4}')
    local required_space=$((10 * 1024 * 1024))  # 10GB in KB

    if [ "$available_space" -gt "$required_space" ]; then
        write_log "Disk space check PASSED: ${available_space}KB available" "SUCCESS"
    else
        write_log "Disk space check FAILED: ${available_space}KB < ${required_space}KB" "ERROR"
    fi

    # Check memory
    if [ -f /proc/meminfo ]; then
        local available_mem=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        local required_mem=$((2 * 1024 * 1024))  # 2GB in KB

        if [ "$available_mem" -gt "$required_mem" ]; then
            write_log "Memory check PASSED: ${available_mem}KB available" "SUCCESS"
        else
            write_log "Memory check FAILED: ${available_mem}KB < ${required_mem}KB" "ERROR"
        fi
    fi
}

function validate_breaking_changes() {
    write_log "Validating for breaking changes..." "INFO"

    local version_file="$FRAMEWORK_PATH/VERSION"
    if [ -f "$version_file" ]; then
        local version=$(cat "$version_file")
        write_log "Current version: $version" "INFO"
    else
        write_log "No version constraints detected" "INFO"
    fi

    # Check for deprecated items
    local deprecated_file="$FRAMEWORK_PATH/DEPRECATED.txt"
    if [ -f "$deprecated_file" ]; then
        local deprecated_count=$(wc -l < "$deprecated_file")
        write_log "Found $deprecated_count deprecated items - review before deployment" "WARNING"
    else
        write_log "No deprecated items found" "SUCCESS"
    fi
}

function validate_dependencies() {
    write_log "Validating dependencies..." "INFO"

    # Check bash version
    write_log "Bash version: $BASH_VERSION" "INFO"

    # Check for jq (JSON parser)
    if command -v jq &> /dev/null; then
        write_log "jq installed: $(jq --version)" "SUCCESS"
    else
        write_log "jq not installed (optional)" "WARNING"
    fi

    # Check for git
    if command -v git &> /dev/null; then
        write_log "git installed: $(git --version)" "SUCCESS"
    else
        write_log "git not found (optional)" "WARNING"
    fi

    # Check dependencies file
    local deps_file="$FRAMEWORK_PATH/dependencies.json"
    if [ -f "$deps_file" ]; then
        if python3 -m json.tool "$deps_file" > /dev/null 2>&1; then
            local dep_count=$(python3 -c "import json; print(len(json.load(open('$deps_file')).get('dependencies', [])))" 2>/dev/null || echo "0")
            write_log "Dependencies manifest valid: $dep_count dependencies" "SUCCESS"
        else
            write_log "Dependencies manifest invalid" "ERROR"
        fi
    fi
}

function main() {
    echo -e "${CYAN}=== VALIDATION STARTED ===${NC}"
    write_log "Starting pre-deployment validation..." "INFO"
    write_log "Framework path: $FRAMEWORK_PATH" "INFO"
    write_log "Report path: $REPORT_PATH" "INFO"
    echo ""

    validate_tools
    validate_configurations
    validate_health_checks
    validate_breaking_changes
    validate_dependencies

    echo ""
    echo -e "${CYAN}=== VALIDATION SUMMARY ===${NC}"
    write_log "Validation completed" "INFO"
    write_log "Log file: $log_file" "INFO"
    write_log "Report file: $REPORT_PATH" "INFO"
    echo ""
}

main "$@"
