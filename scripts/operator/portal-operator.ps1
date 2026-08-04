#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Stage,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ManifestPath,

    [AllowNull()]
    [AllowEmptyString()]
    [string]$ReferenceRunId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$runContext = $null
$manifestImport = $null
$resultStage = 'SelfTest'
$stageCleanupFinalized = $false
$lastCleanup = $null
$stageInvocationStarted = $false
$referenceRunIdProvided = $PSBoundParameters.ContainsKey('ReferenceRunId')

function New-PortalSkippedCleanup {
    return [pscustomobject][ordered]@{ status = 'skipped'; ownedProcessCount = [int]0; terminatedProcessCount = [int]0; remainingOwnedProcessCount = [int]0 }
}

function New-PortalConservativeCleanup {
    return [pscustomobject][ordered]@{ status = 'failed'; ownedProcessCount = [int]1; terminatedProcessCount = [int]0; remainingOwnedProcessCount = [int]1 }
}

function Complete-PortalSkippedRun {
    param([Parameter(Mandatory = $true)]$RunContext)
    $report = Complete-OperatorProcessRun -RunContext $RunContext
    return [pscustomobject][ordered]@{ status = [string]$report.status; ownedProcessCount = [int]$report.ownedProcessCount; terminatedProcessCount = [int]$report.terminatedProcessCount; remainingOwnedProcessCount = [int]$report.remainingOwnedProcessCount }
}

function Write-PortalResultAndExit {
    param(
        [Parameter(Mandatory = $true)]$RunContext,
        [Parameter(Mandatory = $true)][string]$ResultStage,
        [Parameter(Mandatory = $true)][ValidateSet('passed','failed','blocked','error')][string]$Status,
        [Parameter(Mandatory = $true)][ValidateSet(0,10,20,30,40)][int]$ExitCode,
        [Parameter(Mandatory = $true)]$Cleanup,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Checks,
        [Parameter(Mandatory = $true)][string[]]$Messages,
        [AllowNull()]$ManifestImport,
        [ValidateSet('none','invocation','internal')][string]$ErrorKind = 'none',
        [AllowNull()][string]$ReasonCode,
        [switch]$ClassifyStageOutcome
    )
    $bindingResult = $null
    if ($ClassifyStageOutcome) {
        $currentState = [pscustomobject][ordered]@{ status=$Status; exitCode=[int]$ExitCode; errorKind=$ErrorKind; reasonCode=$ReasonCode }
        try { $bindingResult = Test-OperatorBoundManifestBinding -ManifestImport $ManifestImport }
        catch { $bindingResult = $null }
        $mergedState = Merge-OperatorFinalManifestBindingState -CurrentState $currentState -BindingResult $bindingResult
        if ([string]$mergedState.reasonCode -cne [string]$ReasonCode) { $Messages = @([string]$mergedState.reasonCode) }
        $Status = [string]$mergedState.status
        $ExitCode = [int]$mergedState.exitCode
        $ErrorKind = [string]$mergedState.errorKind
        $ReasonCode = [string]$mergedState.reasonCode
        if ($Status -ceq 'blocked') { [Console]::Error.WriteLine('Portal operator invocation was blocked.') }
        elseif ($Status -ceq 'error') {
            if ($ExitCode -eq 40 -or $ErrorKind -ceq 'internal') { [Console]::Error.WriteLine('Portal operator encountered an internal error.') }
            elseif ($ReasonCode -ceq 'manifest-hash-mismatch') { [Console]::Error.WriteLine('Portal operator manifest is missing or invalid.') }
            elseif ($null -ne $ReasonCode -and $ReasonCode.StartsWith('reference-', [StringComparison]::Ordinal)) { [Console]::Error.WriteLine('Portal operator reference run is invalid.') }
            else { [Console]::Error.WriteLine('Portal operator invocation is invalid.') }
        }
    }
    $parameters = @{
        RunId = [string]$RunContext.RunId; Stage = $ResultStage; Status = $Status; ExitCode = $ExitCode
        StartedAtUtc = [DateTime]$RunContext.StartedAtUtc; FinishedAtUtc = [DateTime]::UtcNow; RunDirectory = [string]$RunContext.RunDirectory
        Messages = @($Messages); Checks = @($Checks); CleanupStatus = [string]$Cleanup.status
        OwnedProcessCount = [int]$Cleanup.ownedProcessCount; TerminatedProcessCount = [int]$Cleanup.terminatedProcessCount; RemainingOwnedProcessCount = [int]$Cleanup.remainingOwnedProcessCount
    }
    if ($null -ne $ManifestImport -and $ManifestImport -is [pscustomobject] -and $null -ne $ManifestImport.PSObject.Properties['Manifest'] -and $ManifestImport.Manifest -is [pscustomobject] -and
        $null -ne $ManifestImport.Manifest.PSObject.Properties['moduleId'] -and $ManifestImport.Manifest.moduleId -is [string] -and
        $null -ne $ManifestImport.Manifest.PSObject.Properties['revision'] -and $ManifestImport.Manifest.revision -is [string] -and
        $null -ne $ManifestImport.PSObject.Properties['Sha256'] -and $ManifestImport.Sha256 -is [string]) {
        $parameters.ModuleId = [string]$ManifestImport.Manifest.moduleId
        $parameters.Revision = [string]$ManifestImport.Manifest.revision
        $parameters.ManifestSha256 = [string]$ManifestImport.Sha256
    }
    $result = New-OperatorResult @parameters
    Write-OperatorFinalReport -RunDirectory ([string]$RunContext.RunDirectory) -Result $result
    exit $ExitCode
}

try {
    $moduleRoot = [IO.Path]::Combine($PSScriptRoot, 'modules')
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Core.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Manifest.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Git.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Environment.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Security.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Reporting.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Process.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($PSScriptRoot, 'checks', 'M000.R1.Checks.psm1')) -Force -ErrorAction Stop
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, 'Operator.Orchestration.psm1')) -Force -ErrorAction Stop
    [void](Register-M000R1Checks)

    $referenceParameter = Test-OperatorReferenceRunIdParameter -Stage $Stage -ReferenceRunIdProvided $referenceRunIdProvided -ReferenceRunId $ReferenceRunId
    $isLocalStage = Test-OperatorLocalStage -Stage $Stage
    $isDeploymentStage = Test-OperatorDeploymentStage -Stage $Stage
    $invocationStage = if ($isLocalStage -or $isDeploymentStage) { $Stage } else { 'INVALID' }
    if ($invocationStage -cne 'INVALID') { $resultStage = $invocationStage }

    $runContext = New-OperatorRunContext
    Initialize-OperatorProcessRunReports -RunContext $runContext
    Write-OperatorInvocationReport -RunDirectory $runContext.RunDirectory -Stage $invocationStage -ManifestPath '<redacted>' -OperatorVersion (Get-OperatorFrameworkVersion)

    if (-not $isLocalStage -and -not $isDeploymentStage) {
        Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason 'Manifest was not evaluated because the invocation stage is invalid.'
        $cleanup = Complete-PortalSkippedRun -RunContext $runContext
        $lastCleanup = $cleanup
        $stageCleanupFinalized = $true
        [Console]::Error.WriteLine('Portal operator invocation is invalid.')
        Write-PortalResultAndExit -RunContext $runContext -ResultStage SelfTest -Status error -ExitCode 30 -Cleanup $cleanup -Checks @() -Messages @('invocation-invalid') -ManifestImport $null
    }

    if ($isDeploymentStage) {
        Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason 'Manifest was not evaluated because deployment stages are blocked.'
        $cleanup = Complete-PortalSkippedRun -RunContext $runContext
        $lastCleanup = $cleanup
        $stageCleanupFinalized = $true
        [Console]::Error.WriteLine('Portal operator invocation was blocked.')
        Write-PortalResultAndExit -RunContext $runContext -ResultStage $Stage -Status blocked -ExitCode 20 -Cleanup $cleanup -Checks @() -Messages @('deployment-stage-blocked') -ManifestImport $null
    }

    if ([string]$referenceParameter.status -ceq 'blocked') {
        Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason 'Manifest was not evaluated because reference input is blocked.'
        $cleanup = Complete-PortalSkippedRun -RunContext $runContext
        $lastCleanup = $cleanup
        $stageCleanupFinalized = $true
        [Console]::Error.WriteLine('Portal operator invocation was blocked.')
        Write-PortalResultAndExit -RunContext $runContext -ResultStage $Stage -Status blocked -ExitCode 20 -Cleanup $cleanup -Checks @() -Messages @([string]$referenceParameter.reasonCode) -ManifestImport $null
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
        Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason 'Manifest validation failed.' -RejectedSha256 'UNAVAILABLE'
        $cleanup = Complete-PortalSkippedRun -RunContext $runContext
        $lastCleanup = $cleanup
        $stageCleanupFinalized = $true
        [Console]::Error.WriteLine('Portal operator manifest is missing or invalid.')
        Write-PortalResultAndExit -RunContext $runContext -ResultStage $Stage -Status error -ExitCode 30 -Cleanup $cleanup -Checks @() -Messages @('manifest-invalid') -ManifestImport $null
    }

    Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $manifestImport
    $repositoryRoot = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', '..')).TrimEnd('\', '/')
    $stageParameters = @{
        Stage = $Stage
        ManifestImport = $manifestImport
        RunContext = $runContext
        RepositoryRoot = $repositoryRoot
        ReferenceRunIdProvided = $referenceRunIdProvided
    }
    if ($referenceRunIdProvided) { $stageParameters.ReferenceRunId = $ReferenceRunId }
    $stageInvocationStarted = $true
    $stageOutcome = Invoke-OperatorStage @stageParameters
    $lastCleanup = $stageOutcome.cleanup
    $stageCleanupFinalized = $true

    Write-PortalResultAndExit -RunContext $runContext -ResultStage $Stage -Status ([string]$stageOutcome.status) -ExitCode ([int]$stageOutcome.exitCode) -Cleanup $stageOutcome.cleanup -Checks @($stageOutcome.checks) -Messages @($stageOutcome.messages) -ManifestImport $manifestImport -ErrorKind ([string]$stageOutcome.errorKind) -ReasonCode ([string]$stageOutcome.reasonCode) -ClassifyStageOutcome
}
catch {
    if ($null -ne $runContext) {
        try {
            $cleanup = if ($stageCleanupFinalized -and $null -ne $lastCleanup) { $lastCleanup } elseif ($stageCleanupFinalized) { New-PortalSkippedCleanup } elseif ($stageInvocationStarted) { New-PortalConservativeCleanup } else { Complete-PortalSkippedRun -RunContext $runContext }
            $snapshotPath = [IO.Path]::Combine($runContext.RunDirectory, 'manifest.snapshot.json')
            if (-not [IO.File]::Exists($snapshotPath)) {
                Write-OperatorManifestReports -RunDirectory $runContext.RunDirectory -ManifestImport $null -RejectedReason 'Manifest processing did not complete because of an internal operator error.'
            }
            $finished = [DateTime]::UtcNow
            $fallbackStatus = if ($stageInvocationStarted -and [string]$cleanup.status -ceq 'failed') { 'blocked' } else { 'error' }
            $fallbackExitCode = if ($fallbackStatus -ceq 'blocked') { 20 } else { 40 }
            $fallbackMessage = if ($fallbackStatus -ceq 'blocked') { 'stage-cleanup-failed' } else { 'operator-internal-error' }
            $result = New-OperatorResult -RunId $runContext.RunId -Stage $resultStage -Status $fallbackStatus -ExitCode $fallbackExitCode -StartedAtUtc $runContext.StartedAtUtc -FinishedAtUtc $finished -RunDirectory $runContext.RunDirectory -Messages @($fallbackMessage) -CleanupStatus ([string]$cleanup.status) -OwnedProcessCount ([int]$cleanup.ownedProcessCount) -TerminatedProcessCount ([int]$cleanup.terminatedProcessCount) -RemainingOwnedProcessCount ([int]$cleanup.remainingOwnedProcessCount)
            Write-OperatorFinalReport -RunDirectory $runContext.RunDirectory -Result $result
            if ($fallbackStatus -ceq 'blocked') { [Console]::Error.WriteLine('Portal operator invocation was blocked.') } else { [Console]::Error.WriteLine('Portal operator encountered an internal error.') }
            exit $fallbackExitCode
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
