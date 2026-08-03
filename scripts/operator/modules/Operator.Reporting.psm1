Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$manifestModulePath = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, 'Operator.Manifest.psm1'))
Import-Module -Name $manifestModulePath -ErrorAction Stop
$environmentModulePath = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, 'Operator.Environment.psm1'))
Import-Module -Name $environmentModulePath -ErrorAction Stop

function Write-OperatorAtomicText {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text
    )
    $fullPath = [IO.Path]::GetFullPath($LiteralPath)
    $directory = [IO.Path]::GetDirectoryName($fullPath)
    if ([string]::IsNullOrWhiteSpace($directory) -or -not [IO.Directory]::Exists($directory)) {
        throw "Target directory for '$fullPath' does not exist."
    }
    $temporaryPath = [IO.Path]::Combine($directory, ('.' + [IO.Path]::GetFileName($fullPath) + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'))
    $encoding = New-Object Text.UTF8Encoding($false)
    try {
        [IO.File]::WriteAllText($temporaryPath, $Text, $encoding)
        if ([IO.File]::Exists($fullPath)) {
            [IO.File]::Replace($temporaryPath, $fullPath, $null)
        }
        else {
            [IO.File]::Move($temporaryPath, $fullPath)
        }
    }
    finally {
        if ([IO.File]::Exists($temporaryPath)) { [IO.File]::Delete($temporaryPath) }
    }
}

function ConvertTo-OperatorUtcTimestamp {
    param([Parameter(Mandatory = $true)][DateTime]$Value)
    return $Value.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
}

function Assert-OperatorClosedProperties {
    param(
        [Parameter(Mandatory = $true)]$InputObject,
        [Parameter(Mandatory = $true)][string[]]$PropertyNames,
        [Parameter(Mandatory = $true)][string]$ObjectName
    )
    if ($null -eq $InputObject) { throw "$ObjectName is missing." }
    $actualNames = @($InputObject.PSObject.Properties.Name)
    foreach ($name in $PropertyNames) {
        if ($actualNames -cnotcontains $name) { throw "$ObjectName is missing required property '$name'." }
    }
    foreach ($name in $actualNames) {
        if ($PropertyNames -cnotcontains $name) { throw "$ObjectName contains unsupported property '$name'." }
    }
}

function Assert-OperatorReportTimestamp {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string]$PropertyName
    )
    $parsed = [DateTime]::MinValue
    if (-not [DateTime]::TryParseExact($Value, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal, [ref]$parsed)) {
        throw "$PropertyName must be a canonical UTC timestamp."
    }
}

function Test-OperatorReportInteger {
    param([AllowNull()]$Value)
    return $Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or $Value -is [int64]
}

function Test-OperatorClosedReportObject {
    param(
        [AllowNull()]$InputObject,
        [Parameter(Mandatory = $true)][string[]]$PropertyNames
    )
    if ($null -eq $InputObject -or $InputObject -isnot [pscustomobject]) { return $false }
    $actualNames = @($InputObject.PSObject.Properties.Name)
    if ($actualNames.Count -ne $PropertyNames.Count) { return $false }
    foreach ($name in $PropertyNames) { if ($actualNames -cnotcontains $name) { return $false } }
    return $true
}

function Test-OperatorReportString {
    param([AllowNull()]$Value, [switch]$AllowEmpty)
    if ($Value -isnot [string]) { return $false }
    $text = [string]$Value
    if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace($text)) { return $false }
    return $text.IndexOf([char]0) -lt 0 -and $text.IndexOf("`r", [StringComparison]::Ordinal) -lt 0 -and $text.IndexOf("`n", [StringComparison]::Ordinal) -lt 0
}

function Test-OperatorReportTimestamp {
    param([AllowNull()]$Value)
    if (-not (Test-OperatorReportString -Value $Value)) { return $false }
    $parsed = [DateTime]::MinValue
    $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
    return [DateTime]::TryParseExact([string]$Value, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$parsed)
}

function Test-OperatorRepositorySnapshotReportContract {
    param([AllowNull()]$RepositorySnapshot)
    try {
        if (-not (Test-OperatorClosedReportObject -InputObject $RepositorySnapshot -PropertyNames @('schemaVersion', 'repositoryRoot', 'headSha', 'branch', 'upstream', 'remotes', 'workingTreeState', 'capturedAtUtc'))) { return $false }
        if (-not (Test-OperatorReportInteger -Value $RepositorySnapshot.schemaVersion) -or [int64]$RepositorySnapshot.schemaVersion -ne 1) { return $false }
        if (-not (Test-OperatorReportString -Value $RepositorySnapshot.repositoryRoot)) { return $false }
        if (-not [IO.Path]::IsPathRooted([string]$RepositorySnapshot.repositoryRoot)) { return $false }
        if (-not (Test-OperatorReportString -Value $RepositorySnapshot.headSha) -or -not [regex]::IsMatch([string]$RepositorySnapshot.headSha, '^[a-f0-9]{40}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $false }
        if (-not (Test-OperatorReportString -Value $RepositorySnapshot.branch)) { return $false }
        if ($null -ne $RepositorySnapshot.upstream -and -not (Test-OperatorReportString -Value $RepositorySnapshot.upstream -AllowEmpty)) { return $false }
        if (-not (Test-OperatorReportTimestamp -Value $RepositorySnapshot.capturedAtUtc)) { return $false }
        if ($null -eq $RepositorySnapshot.remotes -or $RepositorySnapshot.remotes -isnot [System.Array]) { return $false }
        $remotes = @($RepositorySnapshot.remotes)
        if ($remotes.Count -ne 2) { return $false }
        foreach ($remote in $remotes) {
            if (-not (Test-OperatorClosedReportObject -InputObject $remote -PropertyNames @('name', 'url'))) { return $false }
            if (-not (Test-OperatorReportString -Value $remote.name) -or -not (Test-OperatorReportString -Value $remote.url)) { return $false }
            $isOrigin = [string]$remote.name -ceq 'origin' -and [string]$remote.url -ceq 'https://github.com/Plaerrdeifl/portal.git'
            $isV4Dev = [string]$remote.name -ceq 'v4dev' -and [string]$remote.url -ceq 'https://github.com/Plaerrdeifl/portal-v4-dev.git'
            if (-not $isOrigin -and -not $isV4Dev) { return $false }
        }
        if (@($remotes | Where-Object { $_.name -is [string] -and [string]$_.name -ceq 'origin' }).Count -ne 1 -or @($remotes | Where-Object { $_.name -is [string] -and [string]$_.name -ceq 'v4dev' }).Count -ne 1) { return $false }
        if (-not (Test-OperatorClosedReportObject -InputObject $RepositorySnapshot.workingTreeState -PropertyNames @('isClean', 'entries'))) { return $false }
        $state = $RepositorySnapshot.workingTreeState
        if ($state.isClean -isnot [bool] -or $null -eq $state.entries -or $state.entries -isnot [System.Array]) { return $false }
        $entries = @($state.entries)
        foreach ($entry in $entries) {
            if (-not (Test-OperatorClosedReportObject -InputObject $entry -PropertyNames @('path', 'status', 'originalPath'))) { return $false }
            if (-not (Test-OperatorReportString -Value $entry.path) -or -not (Test-OperatorReportString -Value $entry.status) -or ([string]$entry.status).Length -ne 2) { return $false }
            if ($null -ne $entry.originalPath -and -not (Test-OperatorReportString -Value $entry.originalPath -AllowEmpty)) { return $false }
        }
        if ([bool]$state.isClean -ne ($entries.Count -eq 0)) { return $false }
        return $true
    }
    catch { return $false }
}

function Test-OperatorWorkingTreeFingerprintReportContract {
    param([AllowNull()]$WorkingTreeFingerprint)
    try {
        if (-not (Test-OperatorClosedReportObject -InputObject $WorkingTreeFingerprint -PropertyNames @('schemaVersion', 'algorithm', 'fingerprint', 'headSha', 'entryCount', 'createdAtUtc'))) { return $false }
        if (-not (Test-OperatorReportInteger -Value $WorkingTreeFingerprint.schemaVersion) -or [int64]$WorkingTreeFingerprint.schemaVersion -ne 1) { return $false }
        if (-not (Test-OperatorReportString -Value $WorkingTreeFingerprint.algorithm) -or [string]$WorkingTreeFingerprint.algorithm -cne 'SHA256') { return $false }
        if (-not (Test-OperatorReportString -Value $WorkingTreeFingerprint.fingerprint) -or -not [regex]::IsMatch([string]$WorkingTreeFingerprint.fingerprint, '^[a-f0-9]{64}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $false }
        if (-not (Test-OperatorReportString -Value $WorkingTreeFingerprint.headSha) -or -not [regex]::IsMatch([string]$WorkingTreeFingerprint.headSha, '^[a-f0-9]{40}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $false }
        if (-not (Test-OperatorReportInteger -Value $WorkingTreeFingerprint.entryCount) -or [int64]$WorkingTreeFingerprint.entryCount -lt 0) { return $false }
        if (-not (Test-OperatorReportTimestamp -Value $WorkingTreeFingerprint.createdAtUtc)) { return $false }
        return $true
    }
    catch { return $false }
}

function Write-OperatorEnvironmentReport {
    param(
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)]$EnvironmentSnapshot
    )
    $validation = Test-OperatorEnvironmentSnapshot -Snapshot $EnvironmentSnapshot
    if (-not $validation.isValid) { throw 'Environment snapshot semantic validation failed.' }
    $json = ConvertTo-Json -InputObject $EnvironmentSnapshot -Depth 16
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'environment.json')) -Text ($json + [Environment]::NewLine)
}

function Write-OperatorRepositorySnapshotReport {
    param(
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)]$RepositorySnapshot
    )
    if (-not (Test-OperatorRepositorySnapshotReportContract -RepositorySnapshot $RepositorySnapshot)) { throw 'Repository snapshot report input is invalid.' }
    $json = ConvertTo-Json -InputObject $RepositorySnapshot -Depth 16
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'repository-snapshot.json')) -Text ($json + [Environment]::NewLine)
}

function Write-OperatorWorkingTreeFingerprintReport {
    param(
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)]$WorkingTreeFingerprint
    )
    if (-not (Test-OperatorWorkingTreeFingerprintReportContract -WorkingTreeFingerprint $WorkingTreeFingerprint)) { throw 'Working-tree fingerprint report input is invalid.' }
    $json = ConvertTo-Json -InputObject $WorkingTreeFingerprint -Depth 8
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'working-tree-fingerprint.json')) -Text ($json + [Environment]::NewLine)
}

function New-OperatorResult {
    param(
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$Stage,
        [Parameter(Mandatory = $true)][ValidateSet('passed', 'failed', 'blocked', 'error')][string]$Status,
        [Parameter(Mandatory = $true)][ValidateSet(0, 10, 20, 30, 40)][int]$ExitCode,
        [Parameter(Mandatory = $true)][DateTime]$StartedAtUtc,
        [Parameter(Mandatory = $true)][DateTime]$FinishedAtUtc,
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [string[]]$Messages = @(),
        [object[]]$Checks = @(),
        [AllowNull()][string]$ModuleId,
        [AllowNull()][string]$Revision,
        [AllowNull()][string]$ManifestSha256,
        [ValidateSet('passed', 'failed', 'skipped')][string]$CleanupStatus = 'skipped',
        [int]$OwnedProcessCount = 0,
        [int]$TerminatedProcessCount = 0,
        [int]$RemainingOwnedProcessCount = 0
    )
    $duration = [Math]::Max(0, [int64][Math]::Round(($FinishedAtUtc.ToUniversalTime() - $StartedAtUtc.ToUniversalTime()).TotalMilliseconds))
    $result = [ordered]@{
        schemaVersion = 1
        operatorVersion = '1.0.0'
        runId = $RunId
        stage = $Stage
        status = $Status
        exitCode = $ExitCode
        startedAtUtc = ConvertTo-OperatorUtcTimestamp -Value $StartedAtUtc
        finishedAtUtc = ConvertTo-OperatorUtcTimestamp -Value $FinishedAtUtc
        durationMs = $duration
        runDirectory = $RunDirectory
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$ModuleId)) { $result.moduleId = $ModuleId }
    if (-not [string]::IsNullOrWhiteSpace([string]$Revision)) { $result.revision = $Revision }
    if (-not [string]::IsNullOrWhiteSpace([string]$ManifestSha256)) { $result.manifestSha256 = $ManifestSha256 }
    $result.checks = @($Checks)
    $result.messages = @($Messages)
    $result.cleanup = [ordered]@{
        status = $CleanupStatus
        ownedProcessCount = $OwnedProcessCount
        terminatedProcessCount = $TerminatedProcessCount
        remainingOwnedProcessCount = $RemainingOwnedProcessCount
    }
    return [pscustomobject]$result
}

function Test-OperatorResultSemantics {
    param([Parameter(Mandatory = $true)]$Result)
    $errors = New-Object 'Collections.Generic.List[string]'
    $schemaValidation = Test-OperatorJsonSchema -InputObject $Result -SchemaPath (Get-OperatorResultSchemaPath)
    foreach ($schemaError in @($schemaValidation.Errors)) { $errors.Add([string]$schemaError) }
    if (-not $schemaValidation.IsValid) {
        return [pscustomobject][ordered]@{ IsValid = $false; Errors = @($errors.ToArray()) }
    }

    $expectedExitCode = switch ([string]$Result.status) {
        'passed' { 0; break }
        'failed' { 10; break }
        'blocked' { 20; break }
        'error' { @((30), (40)); break }
    }
    if ($expectedExitCode -is [System.Array]) {
        if ($expectedExitCode -notcontains [int]$Result.exitCode) { $errors.Add('$.exitCode: error status requires exit code 30 or 40.') }
    }
    elseif ([int]$Result.exitCode -ne [int]$expectedExitCode) {
        $errors.Add("$.exitCode: status '$($Result.status)' requires exit code $expectedExitCode.")
    }

    $started = [DateTime]::MinValue
    $finished = [DateTime]::MinValue
    $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
    $startValid = [DateTime]::TryParseExact([string]$Result.startedAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$started)
    $finishValid = [DateTime]::TryParseExact([string]$Result.finishedAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$finished)
    if (-not $startValid -or -not $finishValid) {
        $errors.Add('$.startedAtUtc/finishedAtUtc: timestamps must be valid UTC instants.')
    }
    else {
        if ($finished -lt $started) { $errors.Add('$.finishedAtUtc: timestamp precedes startedAtUtc.') }
        $measured = [Math]::Max(0, [int64][Math]::Round(($finished - $started).TotalMilliseconds))
        if ([Math]::Abs([int64]$Result.durationMs - $measured) -gt 1000) { $errors.Add('$.durationMs: value is not plausible for the reported timestamps.') }
    }

    if ([string]$Result.status -eq 'passed') {
        foreach ($name in @('moduleId', 'revision', 'manifestSha256')) {
            if ($null -eq $Result.PSObject.Properties[$name]) { $errors.Add("$.${name}: property is required for passed results.") }
        }
        foreach ($check in @($Result.checks)) {
            if (@('passed', 'skipped') -notcontains [string]$check.status) { $errors.Add('$.checks: passed results may contain only passed or skipped checks.') }
        }
        if ([string]$Result.cleanup.status -ne 'passed') { $errors.Add('$.cleanup.status: passed results require passed cleanup.') }
        if ([int]$Result.cleanup.remainingOwnedProcessCount -ne 0) { $errors.Add('$.cleanup.remainingOwnedProcessCount: passed results require zero remaining owned processes.') }
    }

    return [pscustomobject][ordered]@{
        IsValid = ($errors.Count -eq 0)
        Errors = @($errors.ToArray())
    }
}

function Write-OperatorInvocationReport {
    param(
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)][string]$Stage,
        [Parameter(Mandatory = $true)][string]$ManifestPath,
        [Parameter(Mandatory = $true)][string]$OperatorVersion
    )
    $registeredStages = @('SelfTest', 'Preflight', 'LocalVerify', 'LocalFreeze', 'DevDeploy', 'DevVerify', 'ProdPreflight', 'ProdDeploy', 'ProdVerify')
    $reportedStage = if ($registeredStages -ccontains $Stage) { $Stage } else { 'INVALID' }
    $invocation = [pscustomobject][ordered]@{
        stage = $reportedStage
        manifestPath = '<redacted>'
        invokedAtUtc = ConvertTo-OperatorUtcTimestamp -Value ([DateTime]::UtcNow)
    }
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'invocation.json')) -Text (ConvertTo-Json -InputObject $invocation -Depth 8)
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'operator-version.txt')) -Text ($OperatorVersion + [Environment]::NewLine)
}

function Write-OperatorManifestReports {
    param(
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [AllowNull()]$ManifestImport,
        [ValidateSet(
            'Manifest validation failed.',
            'Manifest is unavailable.',
            'Manifest was not evaluated because the invocation stage is invalid.',
            'Manifest was not evaluated because deployment stages are blocked in package B.',
            'Manifest processing did not complete because of an internal operator error.'
        )]
        [string]$RejectedReason = 'Manifest is unavailable.',
        [string]$RejectedSha256 = 'UNAVAILABLE'
    )
    if ($null -ne $ManifestImport) {
        Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'manifest.snapshot.json')) -Text ([string]$ManifestImport.SnapshotJson + [Environment]::NewLine)
        Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'manifest.sha256')) -Text ([string]$ManifestImport.Sha256 + [Environment]::NewLine)
        return
    }
    $snapshot = [pscustomobject][ordered]@{ status = 'rejected'; reason = [string]$RejectedReason }
    $hash = if ([regex]::IsMatch($RejectedSha256, '^[a-f0-9]{64}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $RejectedSha256 } else { 'UNAVAILABLE' }
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'manifest.snapshot.json')) -Text ((ConvertTo-Json -InputObject $snapshot -Depth 4) + [Environment]::NewLine)
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'manifest.sha256')) -Text ($hash + [Environment]::NewLine)
}

function Get-OperatorSuccessMarker {
    param([Parameter(Mandatory = $true)][string]$Stage)
    switch -CaseSensitive ($Stage) {
        'SelfTest' { return 'V4_M000_R1_SELFTEST_OK' }
        'Preflight' { return 'V4_M000_R1_PREFLIGHT_OK' }
        'LocalVerify' { return 'V4_M000_R1_LOCAL_OK' }
        'LocalFreeze' { return 'V4_M000_R1_LOCAL_FROZEN' }
        default { throw "No success marker exists for stage '$Stage'." }
    }
}

function Write-OperatorFinalReport {
    param(
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)]$Result
    )
    $validation = Test-OperatorResultSemantics -Result $Result
    if (-not $validation.IsValid) { throw ('Result validation failed: ' + ($validation.Errors -join ' ')) }

    $resultJson = ConvertTo-Json -InputObject $Result -Depth 32
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'result.json')) -Text ($resultJson + [Environment]::NewLine)
    $summaryLines = @(
        'Plaerrdeifl Portal Operator 1.0.0',
        "RunId: $($Result.runId)",
        "Stage: $($Result.stage)",
        "Status: $($Result.status)",
        "ExitCode: $($Result.exitCode)",
        "StartedAtUtc: $($Result.startedAtUtc)",
        "FinishedAtUtc: $($Result.finishedAtUtc)",
        "DurationMs: $($Result.durationMs)"
    )
    foreach ($message in @($Result.messages)) { $summaryLines += "Message: $message" }
    Write-OperatorAtomicText -LiteralPath ([IO.Path]::Combine($RunDirectory, 'summary.txt')) -Text (($summaryLines -join [Environment]::NewLine) + [Environment]::NewLine)

    if ([string]$Result.status -eq 'passed' -and [int]$Result.exitCode -eq 0) {
        Write-Output (Get-OperatorSuccessMarker -Stage ([string]$Result.stage))
    }
}

Export-ModuleMember -Function @(
    'Write-OperatorAtomicText',
    'Write-OperatorEnvironmentReport',
    'Write-OperatorRepositorySnapshotReport',
    'Write-OperatorWorkingTreeFingerprintReport',
    'New-OperatorResult',
    'Test-OperatorResultSemantics',
    'Write-OperatorInvocationReport',
    'Write-OperatorManifestReports',
    'Write-OperatorFinalReport'
)
