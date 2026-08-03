Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:FrameworkVersion = '1.0.0'
$script:LocalStages = @('SelfTest', 'Preflight', 'LocalVerify', 'LocalFreeze')
$script:DeploymentStages = @('DevDeploy', 'DevVerify', 'ProdPreflight', 'ProdDeploy', 'ProdVerify')
$script:RegistrationIdPattern = '^[a-z0-9]+(?:[.-][a-z0-9]+)*$'
$script:CheckRegistry = @{}

function Get-OperatorFrameworkVersion {
    return $script:FrameworkVersion
}

function Get-OperatorTimeoutProfiles {
    return [pscustomobject][ordered]@{
        short = 15
        standard = 60
        long = 300
    }
}

function Test-OperatorLocalStage {
    param([Parameter(Mandatory = $true)][string]$Stage)
    return ($script:LocalStages -ccontains $Stage)
}

function Test-OperatorDeploymentStage {
    param([Parameter(Mandatory = $true)][string]$Stage)
    return ($script:DeploymentStages -ccontains $Stage)
}

function New-OperatorRunId {
    $timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ', [Globalization.CultureInfo]::InvariantCulture)
    $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 12).ToLowerInvariant()
    return "$timestamp-$suffix"
}

function New-OperatorRunContext {
    $localAppData = [string][Environment]::GetEnvironmentVariable('LOCALAPPDATA')
    if ([string]::IsNullOrWhiteSpace($localAppData)) {
        throw 'LOCALAPPDATA is unavailable; the operator run root cannot be created.'
    }

    $runRoot = [IO.Path]::Combine($localAppData, 'Plaerrdeifl', 'PortalOperator', 'runs')
    [IO.Directory]::CreateDirectory($runRoot) | Out-Null

    for ($attempt = 1; $attempt -le 10; $attempt++) {
        $runId = New-OperatorRunId
        $runDirectory = [IO.Path]::Combine($runRoot, $runId)
        try {
            New-Item -Path $runDirectory -ItemType Directory -ErrorAction Stop | Out-Null
            return [pscustomobject][ordered]@{
                RunId = $runId
                RunRoot = $runRoot
                RunDirectory = $runDirectory
                StartedAtUtc = [DateTime]::UtcNow
            }
        }
        catch [System.IO.IOException] {
            if ($attempt -eq 10) {
                throw 'Unable to create a unique operator run directory after ten attempts.'
            }
        }
    }

    throw 'Unable to create an operator run context.'
}

function Copy-OperatorRegistration {
    param([Parameter(Mandatory = $true)]$Registration)
    return [pscustomobject][ordered]@{
        CheckId = [string]$Registration.CheckId
        TargetId = [string]$Registration.TargetId
        AllowedStages = @($Registration.AllowedStages)
        Handler = [scriptblock]$Registration.Handler
    }
}

function Register-OperatorCheck {
    param(
        [Parameter(Mandatory = $true)][string]$CheckId,
        [Parameter(Mandatory = $true)][string]$TargetId,
        [Parameter(Mandatory = $true)][string[]]$AllowedStages,
        [Parameter(Mandatory = $true)][scriptblock]$Handler
    )

    if (-not [regex]::IsMatch($CheckId, $script:RegistrationIdPattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw "Invalid CheckId '$CheckId'." }
    if (-not [regex]::IsMatch($TargetId, $script:RegistrationIdPattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw "Invalid TargetId '$TargetId'." }
    if ($null -eq $AllowedStages -or $AllowedStages.Count -eq 0) { throw 'AllowedStages must not be empty.' }
    foreach ($stage in $AllowedStages) {
        if ($script:LocalStages -cnotcontains $stage) { throw "Stage '$stage' is not permitted in a check registration." }
    }

    $key = "$CheckId`n$TargetId"
    if ($script:CheckRegistry.ContainsKey($key)) { throw "Check registration '$CheckId/$TargetId' already exists." }
    $script:CheckRegistry[$key] = [pscustomobject][ordered]@{
        CheckId = $CheckId
        TargetId = $TargetId
        AllowedStages = @($AllowedStages)
        Handler = $Handler
    }
    return Copy-OperatorRegistration -Registration $script:CheckRegistry[$key]
}

function Get-OperatorCheckRegistration {
    param(
        [Parameter(Mandatory = $true)][string]$CheckId,
        [Parameter(Mandatory = $true)][string]$TargetId
    )
    $key = "$CheckId`n$TargetId"
    if (-not $script:CheckRegistry.ContainsKey($key)) { return $null }
    return Copy-OperatorRegistration -Registration $script:CheckRegistry[$key]
}

function Get-OperatorCheckRegistrySnapshot {
    $copy = @()
    foreach ($key in ($script:CheckRegistry.Keys | Sort-Object)) {
        $copy += Copy-OperatorRegistration -Registration $script:CheckRegistry[$key]
    }
    return ,$copy
}

Export-ModuleMember -Function @(
    'Get-OperatorFrameworkVersion',
    'Get-OperatorTimeoutProfiles',
    'Test-OperatorLocalStage',
    'Test-OperatorDeploymentStage',
    'New-OperatorRunId',
    'New-OperatorRunContext',
    'Register-OperatorCheck',
    'Get-OperatorCheckRegistration',
    'Get-OperatorCheckRegistrySnapshot'
)
