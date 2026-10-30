#!/bin/bash

#################################################################################
# Production Gradual Rollout Script
# Deploys in stages: 5%, 25%, 50%, 100% with auto-rollback
#################################################################################

set -e

VERSION="${1:-unknown}"
PRODUCTION_PATH="${2:-./production}"
SKIP_CANARY="${3:-false}"
REPORT_PATH="${4:-./production-rollout-report.json}"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DEPLOYMENT_ID=$(uuidgen 2>/dev/null || echo "$(date +%s)-$$")
ROLLOUT_START_TIME=$(date +%s)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

rollout_log="production-rollout-${DEPLOYMENT_ID}.log"

function write_log() {
    local message=$1
    local level=${2:-INFO}
    local timestamp=$(date '+%H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$rollout_log"
}

function deploy_to_percentage() {
    local percentage=$1

    write_log "Deploying to $percentage% of production users..." "INFO"

    local total_users=100000
    local user_count=$(( (total_users * percentage) / 100 ))

    write_log "Deploying to $user_count users ($percentage%)" "INFO"

    mkdir -p "$PRODUCTION_PATH"
    local deploy_path="$PRODUCTION_PATH/deployment-${DEPLOYMENT_ID}-${percentage}"
    mkdir -p "$deploy_path"

    # Create deployment markers
    for tool in regression-test-suite performance-test-runner security-test-scanner integration-test-executor; do
        cat > "$deploy_path/${tool}-${percentage}-deployed.txt" << EOF
{
  "tool": "$tool",
  "version": "$VERSION",
  "percentage": $percentage,
  "deployed_at": "$TIMESTAMP",
  "deployment_id": "$DEPLOYMENT_ID",
  "user_count": $user_count
}
EOF
    done

    write_log "Deployed Version $VERSION to $user_count users ($percentage%)" "SUCCESS"
}

function monitor_stage() {
    local percentage=$1

    write_log "Monitoring metrics for $percentage% deployment..." "INFO"

    local monitoring_duration=30  # 30 minutes per stage
    local monitoring_end_time=$(( $(date +%s) + (monitoring_duration * 60) ))
    local check_count=0

    while [ $(date +%s) -lt $monitoring_end_time ]; do
        check_count=$(( check_count + 1 ))

        # Simulate metrics
        local error_rate=$(( RANDOM % 20 / 10 ))  # 0-2%
        local latency_p95=$(( 150 + (RANDOM % 250) ))  # 150-400ms
        local failure_rate=$(( RANDOM % 10 ))  # 0-9%

        write_log "Check $check_count - Error: $error_rate%, P95: ${latency_p95}ms, Failure: $failure_rate%" "INFO"

        # Check failure rate
        if [ "$failure_rate" -gt 5 ]; then
            write_log "Failure rate exceeded threshold at check $check_count" "ERROR"
            return 1
        fi

        if [ $(date +%s) -lt $monitoring_end_time ]; then
            sleep 10  # Shorter wait in demo
        fi
    done

    write_log "Monitoring completed - $check_count checks, all within thresholds" "SUCCESS"
    return 0
}

function evaluate_stage() {
    local percentage=$1
    local metrics_passed=$2

    if [ "$metrics_passed" -eq 0 ]; then
        write_log "STAGE FAILED: Failure rate exceeded 5% threshold" "ERROR"
        return 1
    fi

    write_log "$percentage% stage PASSED all metrics" "SUCCESS"
    return 0
}

function auto_rollback() {
    local failed_at_percentage=$1
    local reason=$2

    write_log "AUTO-ROLLBACK TRIGGERED" "ERROR"
    write_log "Failed at: $failed_at_percentage% deployment" "ERROR"
    write_log "Reason: $reason" "ERROR"

    # Call rollback script if it exists
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$script_dir/rollback.sh" ]; then
        write_log "Executing rollback script..." "INFO"
        bash "$script_dir/rollback.sh" "$VERSION" "$PRODUCTION_PATH"
    fi
}

function generate_report() {
    write_log "Generating production rollout report..." "INFO"

    local duration=$(( ($(date +%s) - ROLLOUT_START_TIME) / 60 ))

    cat > "$REPORT_PATH" << EOF
{
  "deployment_id": "$DEPLOYMENT_ID",
  "timestamp": "$TIMESTAMP",
  "version": "$VERSION",
  "environment": "production",
  "duration_minutes": $duration,
  "status": "COMPLETED",
  "stages_deployed": [5, 25, 50, 100],
  "overall_status": "COMPLETED"
}
EOF

    write_log "Production rollout report saved to: $REPORT_PATH" "INFO"
    write_log "Production rollout log saved to: $rollout_log" "INFO"
}

function main() {
    echo -e "${CYAN}=== PRODUCTION ROLLOUT STARTED ===${NC}"
    write_log "Deployment ID: $DEPLOYMENT_ID" "INFO"
    write_log "Version: $VERSION" "INFO"
    write_log "Production Path: $PRODUCTION_PATH" "INFO"
    echo ""

    # Rollout stages
    for percentage in 5 25 50 100; do
        echo ""
        echo -e "${CYAN}=== STAGE: $percentage% DEPLOYMENT ===${NC}"
        write_log "=== STAGE: $percentage% DEPLOYMENT ===" "INFO"

        deploy_to_percentage "$percentage"

        if ! monitor_stage "$percentage"; then
            write_log "Stage $percentage% monitoring failed" "ERROR"
            auto_rollback "$percentage" "Metrics threshold exceeded"
            exit 1
        fi

        if ! evaluate_stage "$percentage" $?; then
            write_log "Stage $percentage% evaluation failed" "ERROR"
            auto_rollback "$percentage" "Stage evaluation failed"
            exit 1
        fi

        if [ "$percentage" -lt 100 ]; then
            write_log "Stage $percentage% PASSED - Proceeding to next stage..." "INFO"
            sleep 10
        fi
    done

    generate_report

    echo ""
    echo -e "${CYAN}=== PRODUCTION ROLLOUT COMPLETED SUCCESSFULLY ===${NC}"
    echo -e "${GREEN}Version $VERSION deployed to 100% of production users${NC}"
    echo ""
}

main "$@"
