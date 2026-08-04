#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Stage,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ManifestPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$runContext = $null
$manifestImport = $null
$resultStage = 'SelfTest'

try {
    $moduleRoot = [IO.Path]::Combine($PSScriptRoot, 'modules')
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Core.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Manifest.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Reporting.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Git.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Environment.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Security.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Process.psm1')) -Force -ErrorAction Stop

    $runContext = New-OperatorRunContext
    Initialize-OperatorProcessRunReports -RunContext $runContext
    $isLocalStage = Test-OperatorLocalStage -Stage $Stage
    $isDeploymentStage = Test-OperatorDeploymentStage -Stage $Stage
    $invocationStage = if ($isLocalStage -or $isDeploymentStage) { $Stage } else { 'INVALID' }
    if ($invocationStage -cne 'INVALID') { $resultStage = $invocationStage }
    Write-OperatorInvocationReport -RunDirectory $runContext.RunDirectory -Stage $invocationStage -ManifestPath '<redacted>' -OperatorVersion (Get-OperatorFrameworkVersion)

    if (-not $isLocalStage -and -not $isDeploymentStage) {
        Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason 'Manifest was not evaluated because the invocation stage is invalid.'
        $finished = [DateTime]::UtcNow
        $result = New-OperatorResult -RunId $runContext.RunId -Stage 'SelfTest' -Status error -ExitCode 30 -StartedAtUtc $runContext.StartedAtUtc -FinishedAtUtc $finished -RunDirectory $runContext.RunDirectory -Messages @('The invocation stage is invalid.')
        Write-OperatorFinalReport -RunDirectory $runContext.RunDirectory -Result $result
        exit 30
    }

    if ($isDeploymentStage) {
        Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason 'Manifest was not evaluated because deployment stages are blocked in package C.'
        $finished = [DateTime]::UtcNow
        $result = New-OperatorResult -RunId $runContext.RunId -Stage $Stage -Status blocked -ExitCode 20 -StartedAtUtc $runContext.StartedAtUtc -FinishedAtUtc $finished -RunDirectory $runContext.RunDirectory -Messages @('Die vollständige Check-Orchestrierung, M000-Checks und Abnahme folgen in M000-R1-D.')
        Write-OperatorFinalReport -RunDirectory $runContext.RunDirectory -Result $result
        exit 20
    }

    try {
        $manifestImport = Import-OperatorManifest -ManifestPath $ManifestPath
    }
    catch {
        $classifiedException = $_.Exception
        while ($null -ne $classifiedException) {
            if ($classifiedException.Data.Contains('OperatorErrorKind') -and [string]$classifiedException.Data['OperatorErrorKind'] -ceq 'TrustedSchema') {
                throw
            }
            $classifiedException = $classifiedException.InnerException
        }
        $rejectedHash = 'UNAVAILABLE'
        $rejectedReason = 'Manifest is unavailable.'
        try {
            $candidate = Get-Item -LiteralPath $ManifestPath -ErrorAction Stop
            if (-not $candidate.PSIsContainer) {
                $rejectedReason = 'Manifest validation failed.'
                if ([int64]$candidate.Length -le (Get-OperatorMaximumManifestBytes)) {
                    $rejectedHash = Get-OperatorFileSha256 -LiteralPath $candidate.FullName
                }
            }
        }
        catch {
            $rejectedHash = 'UNAVAILABLE'
            $rejectedReason = 'Manifest is unavailable.'
        }
        Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason $rejectedReason -RejectedSha256 $rejectedHash
        $finished = [DateTime]::UtcNow
        $result = New-OperatorResult -RunId $runContext.RunId -Stage $Stage -Status error -ExitCode 30 -StartedAtUtc $runContext.StartedAtUtc -FinishedAtUtc $finished -RunDirectory $runContext.RunDirectory -Messages @('The manifest is missing or invalid.')
        Write-OperatorFinalReport -RunDirectory $runContext.RunDirectory -Result $result
        exit 30
    }

    Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $manifestImport
    $finished = [DateTime]::UtcNow
    $result = New-OperatorResult -RunId $runContext.RunId -Stage $Stage -Status blocked -ExitCode 20 -StartedAtUtc $runContext.StartedAtUtc -FinishedAtUtc $finished -RunDirectory $runContext.RunDirectory -Messages @('Die vollständige Check-Orchestrierung, M000-Checks und Abnahme folgen in M000-R1-D.') -ModuleId ([string]$manifestImport.Manifest.moduleId) -Revision ([string]$manifestImport.Manifest.revision) -ManifestSha256 ([string]$manifestImport.Sha256)
    Write-OperatorFinalReport -RunDirectory $runContext.RunDirectory -Result $result
    exit 20
}
catch {
    if ($null -ne $runContext) {
        try {
            $snapshotPath = [IO.Path]::Combine($runContext.RunDirectory, 'manifest.snapshot.json')
            if (-not [IO.File]::Exists($snapshotPath)) {
                Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason 'Manifest processing did not complete because of an internal operator error.'
            }
            $finished = [DateTime]::UtcNow
            $result = New-OperatorResult -RunId $runContext.RunId -Stage $resultStage -Status error -ExitCode 40 -StartedAtUtc $runContext.StartedAtUtc -FinishedAtUtc $finished -RunDirectory $runContext.RunDirectory -Messages @('An internal operator error occurred.')
            Write-OperatorFinalReport -RunDirectory $runContext.RunDirectory -Result $result
            exit 40
        }
        catch {
            try {
                Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($runContext.RunDirectory, 'fatal.txt')) -Text ("Internal operator failure. A validated result.json could not be written." + [Environment]::NewLine)
            }
            catch {
                [Console]::Error.WriteLine(
                    'Portal operator fatal fallback report could not be written.'
                )
            }
        }
    }
    [Console]::Error.WriteLine('Portal operator encountered an internal error.')
    exit 40
}
