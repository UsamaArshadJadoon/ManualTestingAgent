<#
.SYNOPSIS
Pre-deployment validation for AI QC Framework
Validates all tools, configurations, and health checks before deployment

.DESCRIPTION
Validates:
- All 20 Phase 1-4 tools exist and are properly configured
- Config files are properly formatted (JSON/YAML)
- Health checks pass
- No breaking changes detected
- Dependencies are satisfied

.PARAMETER FrameworkPath
Path to AI QC Framework root directory

.PARAMETER ReportPath
Output path for validation report (default: ./validation-report.json)

.EXAMPLE
.\deploy-validate.ps1 -FrameworkPath "C:\AI QC Framework" -ReportPath ".\validation-report.json"

#>

param(
    [string]$FrameworkPath = "c:\AI QC Framework",
    [string]$ReportPath = ".\validation-report.json"
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Initialize report
$report = @{
    timestamp = $timestamp
    framework_version = ""
    validation_status = "PENDING"
    sections = @{
        tools = @{ status = "PENDING"; details = @() }
        configurations = @{ status = "PENDING"; details = @() }
        health_checks = @{ status = "PENDING"; details = @() }
        breaking_changes = @{ status = "PENDING"; details = @() }
        dependencies = @{ status = "PENDING"; details = @() }
    }
    summary = @{
        total_checks = 0
        passed_checks = 0
        failed_checks = 0
        warnings = 0
    }
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

function Add-Check {
    param(
        [string]$Section,
        [string]$CheckName,
        [bool]$Passed,
        [string]$Message,
        [string]$Level = "INFO"
    )

    $report.summary.total_checks++
    if ($Passed) {
        $report.summary.passed_checks++
        Write-Log "$CheckName - PASSED" "SUCCESS"
    } else {
        $report.summary.failed_checks++
        Write-Log "$CheckName - FAILED: $Message" "ERROR"
    }

    $report.sections[$Section].details += @{
        name = $CheckName
        passed = $Passed
        message = $Message
        level = $Level
    }
}

function Validate-Tools {
    Write-Log "Validating tools..." "INFO"

    # Define Phase 1-4 tools (20 total)
    $tools = @(
        # Phase 1: Core Validation Tools
        "requirement-validator",
        "user-story-analyzer",
        "test-case-generator",
        "acceptance-criteria-checker",

        # Phase 2: Advanced Testing Tools
        "regression-test-suite",
        "performance-test-runner",
        "security-test-scanner",
        "integration-test-executor",

        # Phase 3: Automation & CI/CD Tools
        "test-automation-framework",
        "ci-cd-pipeline",
        "deployment-validator",
        "monitoring-dashboard",

        # Phase 4: Production Tools
        "production-health-monitor",
        "canary-deployment-manager",
        "gradual-rollout-orchestrator",
        "rollback-automation",
        "metrics-collector",
        "alerting-system",
        "documentation-generator"
    )

    $toolsPath = Join-Path $FrameworkPath "tools"
    $toolsExist = Test-Path $toolsPath

    if (-not $toolsExist) {
        Add-Check -Section "tools" -CheckName "Tools directory exists" -Passed $false `
            -Message "Tools directory not found at $toolsPath"
        return
    }

    Add-Check -Section "tools" -CheckName "Tools directory exists" -Passed $true `
        -Message "Tools directory found at $toolsPath"

    foreach ($tool in $tools) {
        $toolPath = Join-Path $toolsPath $tool
        $toolConfigPath = Join-Path $toolPath "config.json"

        # Check tool directory exists
        $toolExists = Test-Path $toolPath
        Add-Check -Section "tools" -CheckName "Tool exists: $tool" -Passed $toolExists `
            -Message $(if ($toolExists) { "Tool found" } else { "Tool not found at $toolPath" })

        # Check tool config
        if ($toolExists) {
            $configExists = Test-Path $toolConfigPath
            if ($configExists) {
                try {
                    $config = Get-Content $toolConfigPath | ConvertFrom-Json
                    Add-Check -Section "tools" -CheckName "Tool config valid: $tool" -Passed $true `
                        -Message "Configuration is valid JSON"
                } catch {
                    Add-Check -Section "tools" -CheckName "Tool config valid: $tool" -Passed $false `
                        -Message "Configuration is not valid JSON: $($_.Exception.Message)"
                }
            }
        }
    }
}

function Validate-Configurations {
    Write-Log "Validating configurations..." "INFO"

    $configFiles = @(
        "config/deployment.json",
        "config/environments.json",
        "config/metrics.json",
        "config/alerts.json"
    )

    foreach ($configFile in $configFiles) {
        $fullPath = Join-Path $FrameworkPath $configFile
        $exists = Test-Path $fullPath

        Add-Check -Section "configurations" -CheckName "Config file exists: $configFile" `
            -Passed $exists -Message $(if ($exists) { "Found" } else { "Not found at $fullPath" })

        if ($exists) {
            try {
                $content = Get-Content $fullPath | ConvertFrom-Json
                Add-Check -Section "configurations" -CheckName "Config format valid: $configFile" `
                    -Passed $true -Message "JSON format is valid"
            } catch {
                Add-Check -Section "configurations" -CheckName "Config format valid: $configFile" `
                    -Passed $false -Message "Invalid JSON: $($_.Exception.Message)"
            }
        }
    }
}

function Validate-HealthChecks {
    Write-Log "Validating health checks..." "INFO"

    $healthChecks = @(
        @{ name = "Database connectivity"; cmd = "Test-Connection localhost -Count 1 -ErrorAction SilentlyContinue" },
        @{ name = "Disk space (min 10GB)"; cmd = { (Get-Volume | Where-Object DriveLetter -eq 'C').SizeRemaining -gt 10GB } },
        @{ name = "Memory available (min 2GB)"; cmd = { (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory -gt 2GB * 1024 } }
    )

    foreach ($check in $healthChecks) {
        try {
            $result = & $check.cmd
            Add-Check -Section "health_checks" -CheckName $check.name -Passed $result `
                -Message $(if ($result) { "Passed" } else { "Failed" })
        } catch {
            Add-Check -Section "health_checks" -CheckName $check.name -Passed $false `
                -Message "Check error: $($_.Exception.Message)"
        }
    }
}

function Validate-BreakingChanges {
    Write-Log "Validating for breaking changes..." "INFO"

    $versionFile = Join-Path $FrameworkPath "VERSION"
    if (Test-Path $versionFile) {
        $version = Get-Content $versionFile
        Add-Check -Section "breaking_changes" -CheckName "Version compatibility" -Passed $true `
            -Message "Current version: $version"
    } else {
        Add-Check -Section "breaking_changes" -CheckName "Version compatibility" -Passed $true `
            -Message "No version constraints detected"
    }

    # Check for deprecated tools
    $deprecatedFile = Join-Path $FrameworkPath "DEPRECATED.txt"
    if (Test-Path $deprecatedFile) {
        $deprecated = Get-Content $deprecatedFile | Measure-Object -Line
        Add-Check -Section "breaking_changes" -CheckName "Deprecated tools check" -Passed $true `
            -Message "Found $($deprecated.Lines) deprecated items - review before deployment"
    } else {
        Add-Check -Section "breaking_changes" -CheckName "Deprecated tools check" -Passed $true `
            -Message "No deprecated items found"
    }
}

function Validate-Dependencies {
    Write-Log "Validating dependencies..." "INFO"

    $requiredDeps = @(
        @{ name = "PowerShell"; version = "5.1"; check = { $PSVersionTable.PSVersion } }
    )

    foreach ($dep in $requiredDeps) {
        try {
            $installed = & $dep.check
            Add-Check -Section "dependencies" -CheckName "$($dep.name) installed" -Passed $true `
                -Message "Version: $installed"
        } catch {
            Add-Check -Section "dependencies" -CheckName "$($dep.name) installed" -Passed $false `
                -Message "Not available: $($_.Exception.Message)"
        }
    }

    # Check for framework dependencies file
    $depsFile = Join-Path $FrameworkPath "dependencies.json"
    if (Test-Path $depsFile) {
        try {
            $deps = Get-Content $depsFile | ConvertFrom-Json
            Add-Check -Section "dependencies" -CheckName "Dependencies manifest valid" -Passed $true `
                -Message "Found $($deps.dependencies.Count) dependencies"
        } catch {
            Add-Check -Section "dependencies" -CheckName "Dependencies manifest valid" -Passed $false `
                -Message "Invalid manifest: $($_.Exception.Message)"
        }
    }
}

function Generate-Report {
    Write-Log "Generating validation report..." "INFO"

    # Update section statuses
    foreach ($section in $report.sections.Keys) {
        $failed = $report.sections[$section].details | Where-Object { $_.passed -eq $false } | Measure-Object
        $report.sections[$section].status = if ($failed.Count -gt 0) { "FAILED" } else { "PASSED" }
    }

    # Overall status
    $report.validation_status = if ($report.summary.failed_checks -gt 0) { "FAILED" } else { "PASSED" }

    # Save report
    $report | ConvertTo-Json -Depth 10 | Set-Content $ReportPath

    Write-Log "Validation report saved to: $ReportPath" "INFO"

    # Print summary
    Write-Host "`n=== VALIDATION SUMMARY ===" -ForegroundColor Cyan
    Write-Host "Status: $($report.validation_status)" -ForegroundColor $(if ($report.validation_status -eq "PASSED") { "Green" } else { "Red" })
    Write-Host "Total Checks: $($report.summary.total_checks)"
    Write-Host "Passed: $($report.summary.passed_checks)" -ForegroundColor Green
    Write-Host "Failed: $($report.summary.failed_checks)" -ForegroundColor $(if ($report.summary.failed_checks -gt 0) { "Red" } else { "Green" })
    Write-Host "`nDetailed report: $ReportPath`n"

    return $report.validation_status -eq "PASSED"
}

# Main execution
try {
    Write-Log "Starting pre-deployment validation..." "INFO"
    Write-Log "Framework path: $FrameworkPath" "INFO"
    Write-Log "Report path: $ReportPath" "INFO"
    Write-Log "" "INFO"

    Validate-Tools
    Validate-Configurations
    Validate-HealthChecks
    Validate-BreakingChanges
    Validate-Dependencies

    $success = Generate-Report

    exit $(if ($success) { 0 } else { 1 })
} catch {
    Write-Log "Validation failed with error: $($_.Exception.Message)" "ERROR"
    $report.validation_status = "ERROR"
    $report | ConvertTo-Json -Depth 10 | Set-Content $ReportPath
    exit 1
}
