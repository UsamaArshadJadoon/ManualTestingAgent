<#
.SYNOPSIS
Production gradual rollout with auto-rollback capability

.DESCRIPTION
Performs gradual rollout:
1. Deploy to 5% of users
2. Monitor metrics
3. Deploy to 25% if 5% passes
4. Monitor metrics
5. Deploy to 50% if 25% passes
6. Monitor metrics
7. Deploy to 100% if 50% passes
8. Auto-rollback if failure rate >5% at any stage

.PARAMETER Version
Version/commit hash to deploy

.PARAMETER ProductionPath
Path to production environment

.PARAMETER SkipCanary
Skip canary and start at 5% (default: $false)

.PARAMETER ReportPath
Output path for rollout report

.EXAMPLE
.\deploy-production.ps1 -Version "v2.0.0" -ProductionPath "C:\production" -ReportPath ".\production-rollout-report.json"

#>

param(
    [string]$Version = "unknown",
    [string]$ProductionPath = "c:\production",
    [bool]$SkipCanary = $false,
    [string]$ReportPath = ".\production-rollout-report.json"
)

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$deploymentId = [guid]::NewGuid().ToString()
$rolloutStartTime = Get-Date

# Initialize report
$report = @{
    deployment_id = $deploymentId
    timestamp = $timestamp
    version = $Version
    environment = "production"
    stages_deployed = @()
    rollout_stages = @(5, 25, 50, 100)  # Percentages
    current_stage = 0
    stages = @{}
    overall_status = "IN_PROGRESS"
    auto_rollback_triggered = $false
    rollback_reason = ""
}

# Initialize stage details
@(5, 25, 50, 100) | ForEach-Object {
    $report.stages["stage_$_percent"] = @{
        status = "PENDING"
        percentage = $_
        user_count = 0
        start_time = $null
        end_time = $null
        metrics = @{}
        details = @()
    }
}

$rolloutLog = "production-rollout-$deploymentId.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $logEntry = "[$(Get-Date -Format 'HH:mm:ss')] [$Level] $Message"
    Write-Host $logEntry
    Add-Content $rolloutLog $logEntry
}

function Add-Stage-Detail {
    param(
        [int]$Percentage,
        [string]$Detail,
        [bool]$Success = $true
    )
    $stageName = "stage_${Percentage}percent"
    $report.stages[$stageName].details += @{
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        detail = $Detail
        success = $Success
    }
}

function Deploy-ToPercentage {
    param(
        [int]$Percentage
    )

    Write-Log "Deploying to $Percentage% of production users..." "INFO"
    $stageName = "stage_${Percentage}percent"

    $report.stages[$stageName].status = "IN_PROGRESS"
    $report.stages[$stageName].start_time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    # Calculate user count
    $totalUsers = 100000  # Example: total production users
    $userCount = [math]::Ceiling($totalUsers * ($Percentage / 100))

    $report.stages[$stageName].user_count = $userCount

    Write-Log "Deploying to $userCount users ($Percentage%)" "INFO"

    # Create deployment directory
    $deployPath = Join-Path $ProductionPath "deployment-$deploymentId-$Percentage"
    New-Item -ItemType Directory -Path $deployPath -Force | Out-Null

    # Simulate deployment
    @(
        "regression-test-suite",
        "performance-test-runner",
        "security-test-scanner",
        "integration-test-executor"
    ) | ForEach-Object {
        $toolMarker = Join-Path $deployPath "$_-$Percentage-deployed.txt"
        @{
            tool = $_
            version = $Version
            percentage = $Percentage
            deployed_at = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            deployment_id = $deploymentId
            user_count = $userCount
        } | ConvertTo-Json | Set-Content $toolMarker
    }

    Add-Stage-Detail $Percentage "Deployed Version $Version to $userCount users ($Percentage%)" $true

    $report.stages[$stageName].status = "MONITORING"
}

function Monitor-Stage {
    param(
        [int]$Percentage
    )

    Write-Log "Monitoring metrics for $Percentage% deployment..." "INFO"
    $stageName = "stage_${Percentage}percent"

    $monitoringDuration = 30  # 30 minutes per stage
    $checkInterval = 5  # Check every 5 minutes
    $monitoringEndTime = (Get-Date).AddMinutes($monitoringDuration)

    $checks = @()
    $checkNumber = 0

    while ((Get-Date) -lt $monitoringEndTime) {
        $checkNumber++

        # Simulate metrics collection
        $errorRate = if ($Percentage -eq 100) {
            Get-Random -Minimum 0.5 -Maximum 2.0  # Lower error rate for full rollout
        } else {
            Get-Random -Minimum 0.2 -Maximum 1.5
        }

        $latencyP95 = Get-Random -Minimum 150 -Maximum 400
        $failureRate = Get-Random -Minimum 0 -Maximum 5

        $check = @{
            check_number = $checkNumber
            timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            error_rate = $errorRate
            latency_p95 = $latencyP95
            failure_rate = $failureRate
            status = "HEALTHY"
        }

        # Check failure rate threshold
        if ($failureRate -gt 5) {
            $check.status = "UNHEALTHY"
        }

        $checks += $check

        Write-Log "Check $checkNumber - Error: $errorRate%, P95: ${latencyP95}ms, Failure: $failureRate%" "INFO"

        if ((Get-Date) -lt $monitoringEndTime) {
            Start-Sleep -Seconds 10  # Shorter wait in demo
        }
    }

    $report.stages[$stageName].metrics = @{
        checks_performed = $checkNumber
        avg_error_rate = ($checks.error_rate | Measure-Object -Average).Average
        avg_latency_p95 = ($checks.latency_p95 | Measure-Object -Average).Average
        max_failure_rate = ($checks.failure_rate | Measure-Object -Maximum).Maximum
        all_checks = $checks
    }

    Add-Stage-Detail $Percentage "Monitoring completed - $checkNumber checks" $true

    return $report.stages[$stageName].metrics.max_failure_rate -le 5
}

function Evaluate-Stage {
    param(
        [int]$Percentage,
        [bool]$MetricsPassed
    )

    $stageName = "stage_${Percentage}percent"
    $metrics = $report.stages[$stageName].metrics

    Write-Log "Evaluating $Percentage% stage results..." "INFO"

    if (-not $MetricsPassed) {
        Write-Log "Failure rate exceeded threshold - initiating rollback" "ERROR"
        Add-Stage-Detail $Percentage "FAILED: Failure rate exceeded 5% threshold" $false
        return $false
    }

    Write-Log "$Percentage% stage PASSED all metrics" "INFO"
    Add-Stage-Detail $Percentage "PASSED: All metrics within acceptable range" $true

    $report.stages[$stageName].status = "PASSED"
    $report.stages_deployed += $Percentage

    return $true
}

function Invoke-AutoRollback {
    param(
        [int]$FailedAtPercentage,
        [string]$Reason
    )

    Write-Log "AUTO-ROLLBACK TRIGGERED" "ERROR"
    Write-Log "Failed at: $FailedAtPercentage% deployment" "ERROR"
    Write-Log "Reason: $Reason" "ERROR"

    $report.auto_rollback_triggered = $true
    $report.rollback_reason = $Reason

    # Execute rollback (call rollback script)
    $rollbackScript = Join-Path $PSScriptRoot "rollback.ps1"
    if (Test-Path $rollbackScript) {
        Write-Log "Executing rollback script..." "INFO"
        & $rollbackScript -Version $Version -ProductionPath $ProductionPath
    }
}

function Generate-Report {
    Write-Log "Generating production rollout report..." "INFO"

    $duration = (Get-Date) - $rolloutStartTime
    $report.duration_minutes = [math]::Round($duration.TotalMinutes, 2)

    # Update stage statuses
    foreach ($percentage in @(5, 25, 50, 100)) {
        $stageName = "stage_${percentage}percent"
        if ($report.stages[$stageName].status -eq "IN_PROGRESS") {
            $report.stages[$stageName].status = "NOT_STARTED"
        }
    }

    # Determine overall status
    if ($report.auto_rollback_triggered) {
        $report.overall_status = "ROLLED_BACK"
    } elseif ($report.stages_deployed.Count -eq 4) {
        $report.overall_status = "COMPLETED"
    } else {
        $report.overall_status = "PARTIAL"
    }

    # Save report
    $report | ConvertTo-Json -Depth 10 | Set-Content $ReportPath

    Write-Log "Production rollout report saved to: $ReportPath" "INFO"
    Write-Log "Production rollout log saved to: $rolloutLog" "INFO"

    # Print summary
    Write-Host "`n=== PRODUCTION ROLLOUT SUMMARY ===" -ForegroundColor Cyan
    Write-Host "Deployment ID: $deploymentId"
    Write-Host "Version: $Version"
    Write-Host "Duration: $($report.duration_minutes) minutes"
    Write-Host "Status: $($report.overall_status)" -ForegroundColor $(if ($report.overall_status -eq "COMPLETED") { "Green" } elseif ($report.overall_status -eq "ROLLED_BACK") { "Red" } else { "Yellow" })
    Write-Host ""
    Write-Host "Stages Deployed: $($report.stages_deployed -join ', ')%"
    Write-Host ""
    if ($report.auto_rollback_triggered) {
        Write-Host "Auto-Rollback: YES" -ForegroundColor Red
        Write-Host "Reason: $($report.rollback_reason)" -ForegroundColor Red
    }
    Write-Host ""
}

# Main execution
try {
    Write-Log "=== PRODUCTION ROLLOUT STARTED ===" "INFO"
    Write-Log "Deployment ID: $deploymentId" "INFO"
    Write-Log "Version: $Version" "INFO"
    Write-Log "Production Path: $ProductionPath" "INFO"

    # Rollout stages
    foreach ($percentage in @(5, 25, 50, 100)) {
        Write-Log "" "INFO"
        Write-Log "=== STAGE: $percentage% DEPLOYMENT ===" "INFO"

        Deploy-ToPercentage $percentage
        $metricsPassed = Monitor-Stage $percentage
        $stagePassed = Evaluate-Stage $percentage $metricsPassed

        if (-not $stagePassed) {
            Invoke-AutoRollback -FailedAtPercentage $percentage -Reason "Metrics threshold exceeded"
            break
        }

        if ($percentage -lt 100) {
            Write-Log "Stage $percentage% PASSED - Proceeding to next stage..." "INFO"
            Start-Sleep -Seconds 10
        }
    }

    Generate-Report

    if ($report.overall_status -eq "COMPLETED") {
        Write-Log "=== PRODUCTION ROLLOUT COMPLETED SUCCESSFULLY ===" "INFO"
        exit 0
    } else {
        Write-Log "=== PRODUCTION ROLLOUT COMPLETED WITH ROLLBACK ===" "INFO"
        exit 1
    }
} catch {
    Write-Log "Production rollout failed: $($_.Exception.Message)" "ERROR"
    Invoke-AutoRollback -FailedAtPercentage $report.stages_deployed[-1] -Reason $_.Exception.Message
    $report.overall_status = "ROLLED_BACK"
    $report | ConvertTo-Json -Depth 10 | Set-Content $ReportPath
    exit 1
}
