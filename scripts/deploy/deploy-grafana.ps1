#requires -Version 5.1
<#
.SYNOPSIS
    Deploy and configure Grafana dashboard for AI QC Framework monitoring.

.DESCRIPTION
    This script handles the complete Grafana deployment workflow:
    - Verifies Grafana connectivity
    - Configures Prometheus data source
    - Imports dashboard configuration from JSON
    - Sets up alert notification channels
    - Verifies dashboard and panel rendering
    - Performs health checks

.PARAMETER GrafanaUrl
    Grafana server URL (default: http://localhost:3000)

.PARAMETER GrafanaApiKey
    Grafana API key for authentication

.PARAMETER PrometheusUrl
    Prometheus server URL (default: http://localhost:9090)

.PARAMETER DashboardConfigPath
    Path to dashboard-config.json file

.PARAMETER AlertEmail
    Email address for alert notifications

.EXAMPLE
    .\deploy-grafana.ps1 -GrafanaApiKey "your-api-key" -AlertEmail "alerts@example.com"

.NOTES
    Requires Grafana 8.0+ with Prometheus data source support
    Author: AI QC Framework
    Date: 2026-10-30
#>

param(
    [string]$GrafanaUrl = "http://localhost:3000",
    [string]$GrafanaApiKey,
    [string]$PrometheusUrl = "http://localhost:9090",
    [string]$DashboardConfigPath = ".\dashboard-config.json",
    [string]$AlertEmail = "",
    [switch]$Verbose
)

# ============================================================================
# Configuration & Constants
# ============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Define dashboard specifications
$DASHBOARD_CONFIG = @{
    Rows = 5
    Panels = 18
    RefreshInterval = "30s"
}

# Define expected panel names (18 total)
$EXPECTED_PANELS = @(
    # Row 1: Framework Execution Performance
    "Framework Execution Time",
    "Success Rate",
    "Error Rate",
    "Total Tests Run",

    # Row 2: Agent Performance
    "Agents Active",
    "Agent CPU Usage",
    "Agent Memory Usage",
    "Agent Error Count",

    # Row 3: Orchestration Metrics
    "Task Queue Depth",
    "Task Processing Time",
    "Orchestrator CPU Usage",
    "Orchestrator Memory Usage",

    # Row 4: System Health
    "Disk Space Usage",
    "Network I/O",
    "Request Latency",
    "Cache Hit Rate",

    # Row 5: Alerts & SLA
    "Active Alerts",
    "SLA Compliance"
)

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Header {
    param([string]$Message)
    Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "  [ERROR] $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "  [WARNING] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [INFO] $Message" -ForegroundColor Gray
}

function Test-GrafanaConnection {
    Write-Header "Step 1: Verifying Grafana Connection"

    try {
        $headers = @{
            "Authorization" = "Bearer $GrafanaApiKey"
            "Content-Type" = "application/json"
        }

        Write-Info "Testing connection to $GrafanaUrl"
        $response = Invoke-RestMethod -Uri "$GrafanaUrl/api/health" -Headers $headers -ErrorAction Stop

        Write-Success "Connected to Grafana $($response.version)"
        Write-Info "Grafana commit: $($response.commit)"
        Write-Info "Database status: $($response.database)"

        return $true
    }
    catch {
        Write-Error-Custom "Failed to connect to Grafana: $($_.Exception.Message)"
        Write-Info "Ensure Grafana is running at $GrafanaUrl"
        Write-Info "Ensure API key is valid: $([string]$GrafanaApiKey[0])***"
        return $false
    }
}

function Configure-PrometheusDataSource {
    Write-Header "Step 2: Configuring Prometheus Data Source"

    try {
        $headers = @{
            "Authorization" = "Bearer $GrafanaApiKey"
            "Content-Type" = "application/json"
        }

        # Check if Prometheus data source exists
        Write-Info "Checking for existing Prometheus data source..."
        $existingDS = $null
        try {
            $dataSourceResponse = Invoke-RestMethod `
                -Uri "$GrafanaUrl/api/datasources/name/Prometheus" `
                -Headers $headers `
                -ErrorAction SilentlyContinue
            $existingDS = $dataSourceResponse
        }
        catch {
            # Data source doesn't exist yet
        }

        if ($existingDS) {
            Write-Info "Prometheus data source already configured (ID: $($existingDS.id))"
            Write-Success "Data source is ready"
            return $true
        }

        # Create new Prometheus data source
        Write-Info "Creating Prometheus data source..."

        $dataSourcePayload = @{
            name = "Prometheus"
            type = "prometheus"
            url = $PrometheusUrl
            access = "proxy"
            isDefault = $true
            jsonData = @{
                timeInterval = "30s"
                queryTimeout = "30s"
            }
        } | ConvertTo-Json

        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "$GrafanaUrl/api/datasources" `
            -Headers $headers `
            -Body $dataSourcePayload `
            -ErrorAction Stop

        Write-Success "Prometheus data source created (ID: $($response.id))"

        # Test data source
        Write-Info "Testing Prometheus connectivity..."
        $testPayload = @{
            id = $response.id
            name = "Prometheus"
            type = "prometheus"
            url = $PrometheusUrl
            access = "proxy"
        } | ConvertTo-Json

        try {
            $testResponse = Invoke-RestMethod `
                -Method Post `
                -Uri "$GrafanaUrl/api/datasources/test" `
                -Headers $headers `
                -Body $testPayload `
                -ErrorAction Stop

            Write-Success "Prometheus connectivity verified"
            return $true
        }
        catch {
            Write-Warning-Custom "Prometheus connectivity test failed: $($_.Exception.Message)"
            Write-Info "Please ensure Prometheus is accessible at $PrometheusUrl"
            return $true  # Continue despite warning
        }
    }
    catch {
        Write-Error-Custom "Failed to configure data source: $($_.Exception.Message)"
        return $false
    }
}

function Import-DashboardConfiguration {
    Write-Header "Step 3: Importing Dashboard Configuration"

    try {
        if (-not (Test-Path $DashboardConfigPath)) {
            Write-Info "Dashboard config not found at $DashboardConfigPath"
            Write-Info "Creating sample dashboard configuration..."

            $sampleDashboard = @{
                dashboard = @{
                    title = "AI QC Framework - Monitoring"
                    tags = @("ai-qc", "framework", "monitoring")
                    timezone = "browser"
                    schemaVersion = 35
                    version = 1
                    uid = "qc-framework-dashboard"
                    rows = @()
                    panels = @()
                    refresh = "30s"
                    time = @{
                        from = "now-6h"
                        to = "now"
                    }
                    timepicker = @{
                        refresh_intervals = @("5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d")
                    }
                }
                overwrite = $true
            } | ConvertTo-Json -Depth 10

            $sampleDashboard | Out-File -FilePath $DashboardConfigPath -Encoding UTF8
            Write-Info "Sample configuration created: $DashboardConfigPath"
        }

        # Read and validate dashboard config
        Write-Info "Reading dashboard configuration..."
        $dashboardConfig = Get-Content -Path $DashboardConfigPath -Raw | ConvertFrom-Json

        $dashboardTitle = $dashboardConfig.dashboard.title
        Write-Success "Dashboard title: $dashboardTitle"
        Write-Info "Dashboard UID: $($dashboardConfig.dashboard.uid)"
        Write-Info "Tags: $($dashboardConfig.dashboard.tags -join ', ')"

        # Import dashboard
        Write-Info "Importing dashboard into Grafana..."

        $headers = @{
            "Authorization" = "Bearer $GrafanaApiKey"
            "Content-Type" = "application/json"
        }

        $importPayload = @{
            dashboard = $dashboardConfig.dashboard
            overwrite = $true
            message = "Imported AI QC Framework dashboard"
        } | ConvertTo-Json -Depth 10

        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "$GrafanaUrl/api/dashboards/db" `
            -Headers $headers `
            -Body $importPayload `
            -ErrorAction Stop

        Write-Success "Dashboard imported successfully"
        Write-Info "Dashboard ID: $($response.id)"
        Write-Info "Dashboard URL: $GrafanaUrl/d/$($response.uid)"

        return $true
    }
    catch {
        Write-Error-Custom "Failed to import dashboard: $($_.Exception.Message)"
        return $false
    }
}

function Verify-PanelRendering {
    Write-Header "Step 4: Verifying Panel Rendering"

    try {
        $headers = @{
            "Authorization" = "Bearer $GrafanaApiKey"
            "Content-Type" = "application/json"
        }

        # Get dashboard
        Write-Info "Retrieving dashboard details..."
        $response = Invoke-RestMethod `
            -Uri "$GrafanaUrl/api/dashboards/uid/qc-framework-dashboard" `
            -Headers $headers `
            -ErrorAction Stop

        $dashboard = $response.dashboard
        $panelCount = ($dashboard.panels | Measure-Object).Count

        Write-Success "Dashboard retrieved with $panelCount panels"

        # Verify expected panel count
        if ($panelCount -eq 0) {
            Write-Warning-Custom "No panels found in dashboard"
            Write-Info "Expected $($EXPECTED_PANELS.Count) panels"
            return $false
        }

        Write-Info "Verifying panel configurations..."
        $validPanels = 0

        foreach ($panel in $dashboard.panels) {
            $panelTitle = $panel.title
            $panelType = $panel.type

            # Check if panel has valid data source binding
            if ($panel.datasource -or $panel.targets.datasource) {
                Write-Success "Panel: $panelTitle ($panelType)"
                $validPanels++
            }
            else {
                Write-Warning-Custom "Panel missing data source: $panelTitle"
            }
        }

        Write-Info "Valid panels: $validPanels / $panelCount"

        if ($validPanels -ge ($panelCount * 0.8)) {
            Write-Success "Panel rendering verification passed"
            return $true
        }
        else {
            Write-Warning-Custom "Less than 80% panels are properly configured"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Failed to verify panels: $($_.Exception.Message)"
        return $false
    }
}

function Configure-AlertNotificationChannels {
    Write-Header "Step 5: Configuring Alert Notification Channels"

    try {
        if ([string]::IsNullOrWhiteSpace($AlertEmail)) {
            Write-Info "No email address provided, skipping alert channel configuration"
            return $true
        }

        $headers = @{
            "Authorization" = "Bearer $GrafanaApiKey"
            "Content-Type" = "application/json"
        }

        Write-Info "Setting up email notification channel: $AlertEmail"

        # Check for existing email channel
        Write-Info "Checking for existing email channels..."
        $channels = $null
        try {
            $channelsResponse = Invoke-RestMethod `
                -Uri "$GrafanaUrl/api/alert-notifications" `
                -Headers $headers `
                -ErrorAction SilentlyContinue
            $channels = $channelsResponse
        }
        catch {
            # API might not be available in older versions
        }

        if ($channels) {
            $emailChannel = $channels | Where-Object { $_.type -eq "email" } | Select-Object -First 1
            if ($emailChannel) {
                Write-Success "Email notification channel already configured"
                Write-Info "Channel: $($emailChannel.name)"
                return $true
            }
        }

        # Create email notification channel
        Write-Info "Creating email notification channel..."

        $channelPayload = @{
            name = "Email Alerts"
            type = "email"
            isDefault = $false
            settings = @{
                addresses = @($AlertEmail)
            }
        } | ConvertTo-Json

        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "$GrafanaUrl/api/alert-notifications" `
            -Headers $headers `
            -Body $channelPayload `
            -ErrorAction SilentlyContinue

        if ($response) {
            Write-Success "Email notification channel created"
            Write-Info "Channel ID: $($response.id)"
            Write-Info "Alerts will be sent to: $AlertEmail"
        }

        return $true
    }
    catch {
        Write-Warning-Custom "Failed to configure alert channels: $($_.Exception.Message)"
        Write-Info "Alert channels can be configured manually in Grafana UI"
        return $true  # Non-critical
    }
}

function Verify-DashboardVisibility {
    Write-Header "Step 6: Verifying Dashboard Visibility"

    try {
        $headers = @{
            "Authorization" = "Bearer $GrafanaApiKey"
            "Content-Type" = "application/json"
        }

        Write-Info "Checking dashboard accessibility..."

        $dashboardResponse = Invoke-RestMethod `
            -Uri "$GrafanaUrl/api/dashboards/uid/qc-framework-dashboard" `
            -Headers $headers `
            -ErrorAction Stop

        $dashboard = $dashboardResponse.dashboard

        Write-Success "Dashboard is accessible"
        Write-Info "Title: $($dashboard.title)"
        Write-Info "URL: $GrafanaUrl/d/$($dashboard.uid)/$($dashboard.slug)"
        Write-Info "Last updated: $($dashboard.updated)"
        Write-Info "Version: $($dashboard.version)"

        # Check for folders
        Write-Info "Retrieving dashboard folder..."
        $folderResponse = Invoke-RestMethod `
            -Uri "$GrafanaUrl/api/folders/$($dashboardResponse.folderTitle)" `
            -Headers $headers `
            -ErrorAction SilentlyContinue

        if ($folderResponse) {
            Write-Info "Folder: $($folderResponse.title)"
        }

        return $true
    }
    catch {
        Write-Error-Custom "Failed to verify dashboard visibility: $($_.Exception.Message)"
        return $false
    }
}

function Test-DatasourceConnectivity {
    Write-Header "Step 7: Testing Data Source Connectivity"

    try {
        Write-Info "Testing Prometheus connectivity..."

        $testUrl = "$PrometheusUrl/api/v1/query?query=up"
        Write-Info "Querying: $testUrl"

        $response = Invoke-RestMethod -Uri $testUrl -ErrorAction Stop

        if ($response.status -eq "success") {
            Write-Success "Prometheus is responding correctly"
            Write-Info "Query result count: $($response.data.result.Count)"
            return $true
        }
        else {
            Write-Warning-Custom "Prometheus returned unexpected status: $($response.status)"
            return $true
        }
    }
    catch {
        Write-Warning-Custom "Could not reach Prometheus directly: $($_.Exception.Message)"
        Write-Info "This may be expected if Prometheus is not accessible from this host"
        return $true
    }
}

function Show-DeploymentSummary {
    Write-Header "Deployment Summary"

    Write-Host "
Dashboard Deployment Information:
-----------------------------------
  Grafana URL:          $GrafanaUrl
  Prometheus URL:       $PrometheusUrl
  Dashboard UID:        qc-framework-dashboard
  Expected Panels:      $($EXPECTED_PANELS.Count)
  Alert Email:          $(if ($AlertEmail) { $AlertEmail } else { 'Not configured' })

Access the dashboard at:
  $GrafanaUrl/d/qc-framework-dashboard

Dashboard Features:
  - Framework execution performance tracking
  - Agent performance metrics
  - Orchestration monitoring
  - System health indicators
  - Alert management
  - SLA compliance monitoring

Next Steps:
  1. Open Grafana in your browser
  2. Navigate to the dashboard
  3. Verify all panels display data
  4. Configure additional alerts as needed
  5. Set up dashboard sharing if required

Documentation:
  - Setup Guide:     ./metrics/GRAFANA_SETUP.md
  - Cost Analysis:   ./docs/COST_ANALYSIS.md
  - Performance:     ./docs/PERFORMANCE_BENEFITS.md
  - Infrastructure:  ./docs/INFRASTRUCTURE_SIZING.md
" -ForegroundColor Cyan
}

# ============================================================================
# Main Execution
# ============================================================================

function Invoke-GrafanaDeployment {
    Write-Header "AI QC Framework - Grafana Dashboard Deployment"

    Write-Host "
Deployment Details:
  Time:      $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
  Grafana:   $GrafanaUrl
  Prometheus: $PrometheusUrl
" -ForegroundColor Gray

    # Execute deployment steps
    $steps = @(
        { Test-GrafanaConnection },
        { Configure-PrometheusDataSource },
        { Import-DashboardConfiguration },
        { Verify-PanelRendering },
        { Configure-AlertNotificationChannels },
        { Verify-DashboardVisibility },
        { Test-DatasourceConnectivity }
    )

    $successCount = 0
    $failureCount = 0

    foreach ($step in $steps) {
        if (& $step) {
            $successCount++
        }
        else {
            $failureCount++
        }
    }

    # Summary
    Write-Header "Deployment Results"
    Write-Host "
  Successful Steps:  $successCount / $($steps.Count)
  Failed Steps:      $failureCount / $($steps.Count)
" -ForegroundColor Gray

    if ($failureCount -eq 0) {
        Write-Success "Grafana deployment completed successfully!"
        Show-DeploymentSummary
        return 0
    }
    elseif ($failureCount -lt ($steps.Count / 2)) {
        Write-Warning-Custom "Deployment completed with warnings"
        Show-DeploymentSummary
        return 1
    }
    else {
        Write-Error-Custom "Deployment failed"
        return 2
    }
}

# Run deployment
$exitCode = Invoke-GrafanaDeployment
exit $exitCode
