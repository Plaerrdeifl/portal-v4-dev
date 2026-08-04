Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$coreModulePath = [IO.Path]::Combine($PSScriptRoot, 'Operator.Core.psm1')
$manifestModulePath = [IO.Path]::Combine($PSScriptRoot, 'Operator.Manifest.psm1')
$reportingModulePath = [IO.Path]::Combine($PSScriptRoot, 'Operator.Reporting.psm1')
$gitModulePath = [IO.Path]::Combine($PSScriptRoot, 'Operator.Git.psm1')
$environmentModulePath = [IO.Path]::Combine($PSScriptRoot, 'Operator.Environment.psm1')
$securityModulePath = [IO.Path]::Combine($PSScriptRoot, 'Operator.Security.psm1')
$processModulePath = [IO.Path]::Combine($PSScriptRoot, 'Operator.Process.psm1')
foreach ($path in @($coreModulePath, $manifestModulePath, $gitModulePath, $environmentModulePath, $securityModulePath, $reportingModulePath, $processModulePath)) { Import-Module -Name $path -ErrorAction Stop }

$script:RunIdPattern = '^\d{8}T\d{9}Z-[a-f0-9]{12}$'
$script:MaximumReferenceJsonBytes = 1048576
$script:MaximumReferenceLogBytes = (5242880 * 4) + 4096
$script:MaximumReferenceSummaryBytes = 65536
$script:ReferenceGitInspectionProcessCount = 12
$script:ReservedSuccessMarkers = @('V4_M000_R1_SELFTEST_OK', 'V4_M000_R1_PREFLIGHT_OK', 'V4_M000_R1_LOCAL_OK', 'V4_M000_R1_LOCAL_FROZEN')
$script:ReferenceRootNames = @(
    'cleanup.json', 'environment.json', 'invocation.json', 'manifest.sha256',
    'manifest.snapshot.json', 'operator-version.txt', 'processes',
    'repository-snapshot.json', 'result.json', 'stderr.log', 'stdout.log',
    'summary.txt', 'working-tree-fingerprint.json'
)
$script:LocalVerifyReferenceChecks = @(
    [pscustomobject][ordered]@{ checkId='repository.policy'; targetId='operator.repository' },
    [pscustomobject][ordered]@{ checkId='environment.required'; targetId='operator.environment' },
    [pscustomobject][ordered]@{ checkId='local.isolation'; targetId='operator.local-mode' },
    [pscustomobject][ordered]@{ checkId='path.scope'; targetId='operator.changed-paths' },
    [pscustomobject][ordered]@{ checkId='secret.hints'; targetId='operator.secret-hints' },
    [pscustomobject][ordered]@{ checkId='local.test'; targetId='npm.test' },
    [pscustomobject][ordered]@{ checkId='local.frontend'; targetId='npm.check-frontend' },
    [pscustomobject][ordered]@{ checkId='local.static'; targetId='npm.check-static' },
    [pscustomobject][ordered]@{ checkId='fingerprint.capture'; targetId='operator.fingerprint-capture' }
)
$script:LocalVerifyReferenceAttempts = @(
    [pscustomobject][ordered]@{ sequence=[int]1; directory='0001-npm.test'; targetId='npm.test'; checkIndex=[int]5 },
    [pscustomobject][ordered]@{ sequence=[int]2; directory='0002-npm.check-frontend'; targetId='npm.check-frontend'; checkIndex=[int]6 },
    [pscustomobject][ordered]@{ sequence=[int]3; directory='0003-npm.check-static'; targetId='npm.check-static'; checkIndex=[int]7 }
)

function Test-M000R1ClosedObject {
    param([AllowNull()]$InputObject, [Parameter(Mandatory = $true)][string[]]$PropertyNames)
    if ($null -eq $InputObject -or $InputObject -isnot [pscustomobject]) { return $false }
    $actual = @($InputObject.PSObject.Properties.Name)
    if ($actual.Count -ne $PropertyNames.Count) { return $false }
    foreach ($name in $PropertyNames) { if ($actual -cnotcontains $name) { return $false } }
    return $true
}

function Test-OperatorReferenceRunIdParameter {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Stage,
        [Parameter(Mandatory = $true)][bool]$ReferenceRunIdProvided,
        [AllowNull()][AllowEmptyString()][string]$ReferenceRunId
    )
    $status = 'valid'
    $reasonCode = 'reference-valid'
    if ($Stage -ceq 'LocalFreeze') {
        if (-not $ReferenceRunIdProvided) { $status = 'blocked'; $reasonCode = 'reference-required' }
        elseif (-not [regex]::IsMatch([string]$ReferenceRunId, $script:RunIdPattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $status = 'blocked'; $reasonCode = 'reference-invalid-syntax' }
    }
    elseif ($ReferenceRunIdProvided) {
        $status = 'blocked'
        $reasonCode = 'reference-not-allowed'
    }
    return [pscustomobject][ordered]@{ schemaVersion = [int]1; status = $status; reasonCode = $reasonCode }
}

function Test-M000R1SafeExistingPath {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][ValidateSet('file', 'directory')][string]$Kind
    )
    try {
        if (-not [IO.Path]::IsPathRooted($LiteralPath) -or $LiteralPath.StartsWith('\\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\?\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\.\', [StringComparison]::Ordinal)) { return $null }
        $fullPath = [IO.Path]::GetFullPath($LiteralPath).TrimEnd('\', '/')
        $volumeRoot = [IO.Path]::GetPathRoot($fullPath)
        $drive = New-Object IO.DriveInfo($volumeRoot)
        if ($drive.DriveType -eq [IO.DriveType]::Network) { return $null }
        $cursor = $volumeRoot
        foreach ($segment in @($fullPath.Substring($volumeRoot.Length) -split '[\\/]' | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })) {
            $cursor = [IO.Path]::Combine($cursor, [string]$segment)
            $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $null }
        }
        $final = Get-Item -LiteralPath $fullPath -Force -ErrorAction Stop
        if (($Kind -ceq 'file' -and $final.PSIsContainer) -or ($Kind -ceq 'directory' -and -not $final.PSIsContainer)) { return $null }
        return [IO.Path]::GetFullPath([string]$final.FullName).TrimEnd('\', '/')
    }
    catch { return $null }
}

function Read-M000R1BoundedTextFile {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][int]$MaximumBytes
    )
    if ($MaximumBytes -lt 0 -or $MaximumBytes -ge [int]::MaxValue) { throw 'Reference file bound is invalid.' }
    $safePath = Test-M000R1SafeExistingPath -LiteralPath $LiteralPath -Kind file
    if ($null -eq $safePath) { throw 'Reference file failed safety validation.' }
    $stream = $null
    try {
        $stream = New-Object IO.FileStream($safePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        $bytes = New-Object byte[] ($MaximumBytes + 1)
        $total = 0
        while ($total -lt $bytes.Length) {
            $read = $stream.Read($bytes, $total, $bytes.Length - $total)
            if ($read -eq 0) { break }
            $total += $read
        }
        if ($total -gt $MaximumBytes) { throw 'Reference file exceeded its bound.' }
        $encoding = New-Object Text.UTF8Encoding($false, $true)
        return $encoding.GetString($bytes, 0, $total)
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Get-M000R1TrustedManifestModule {
    $trustedPath = [IO.Path]::GetFullPath($manifestModulePath)
    $matches = @()
    foreach ($module in @(Get-Module -Name 'Operator.Manifest')) {
        try {
            if ($null -ne $module.Path -and [string]::Equals([IO.Path]::GetFullPath([string]$module.Path), $trustedPath, [StringComparison]::OrdinalIgnoreCase)) { $matches += $module }
        }
        catch { continue }
    }
    if ($matches.Count -ne 1) {
        $exception = New-Object System.InvalidOperationException -ArgumentList 'Trusted manifest module is unavailable.'
        $exception.Data['OperatorErrorKind'] = 'TrustedSchema'
        throw $exception
    }
    return $matches[0]
}

function Read-M000R1StrictReferenceJson {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [int]$MaximumBytes = $script:MaximumReferenceJsonBytes
    )
    $text = Read-M000R1BoundedTextFile -LiteralPath $LiteralPath -MaximumBytes $MaximumBytes
    $manifestModule = Get-M000R1TrustedManifestModule
    return & $manifestModule { param($JsonText) ConvertFrom-OperatorStrictJson -Text $JsonText } $text
}

function Test-M000R1UtcTimestamp {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrEmpty([string]$Value)) { return $false }
    $parsed = [DateTime]::MinValue
    $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
    return [DateTime]::TryParseExact([string]$Value, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$parsed)
}

function Test-M000R1ReferenceTextSafe {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text,
        [Parameter(Mandatory = $true)][int]$MaximumCharacters
    )
    if ($Text.Length -gt $MaximumCharacters -or -not (Test-OperatorLogTextSafe -Text $Text)) { return $false }
    foreach ($marker in $script:ReservedSuccessMarkers) {
        if ($Text.IndexOf($marker, [StringComparison]::Ordinal) -ge 0) { return $false }
    }
    return $true
}

function Resolve-M000R1ReferenceRunDirectory {
    param([Parameter(Mandatory = $true)][string]$ReferenceRunId)
    if (-not [regex]::IsMatch($ReferenceRunId, $script:RunIdPattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $null }
    $localAppData = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
    if ($localAppData -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$localAppData)) { return $null }
    $safeLocalRoot = Test-M000R1SafeExistingPath -LiteralPath ([string]$localAppData) -Kind directory
    if ($null -eq $safeLocalRoot) { return $null }
    $runRootCandidate = [IO.Path]::GetFullPath([IO.Path]::Combine($safeLocalRoot, 'Plaerrdeifl', 'PortalOperator', 'runs')).TrimEnd('\', '/')
    $runRoot = Test-M000R1SafeExistingPath -LiteralPath $runRootCandidate -Kind directory
    if ($null -eq $runRoot -or -not [string]::Equals($runRoot, $runRootCandidate, [StringComparison]::OrdinalIgnoreCase)) { return $null }
    $candidate = [IO.Path]::GetFullPath([IO.Path]::Combine($runRoot, $ReferenceRunId)).TrimEnd('\', '/')
    if (-not [string]::Equals([IO.Path]::GetDirectoryName($candidate), $runRoot, [StringComparison]::OrdinalIgnoreCase)) { return $null }
    if ([string][IO.Path]::GetFileName($candidate) -cne $ReferenceRunId) { return $null }
    return Test-M000R1SafeExistingPath -LiteralPath $candidate -Kind directory
}

function New-M000R1ReferenceAttemptOutcome {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('valid','mismatch','invalid')][string]$Status,
        [Parameter(Mandatory = $true)][string]$ReasonCode,
        [int]$Owned = 0,
        [int]$Terminated = 0,
        [int]$Remaining = 0,
        [object[]]$Reports = @()
    )
    return [pscustomobject][ordered]@{ status=$Status; reasonCode=$ReasonCode; owned=[int]$Owned; terminated=[int]$Terminated; remaining=[int]$Remaining; count=[int]@($Reports).Count; reports=@($Reports) }
}

function Test-M000R1ReferenceProcessAttempts {
    param(
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)][object[]]$ResultChecks
    )
    $processesPath = [IO.Path]::Combine($RunDirectory, 'processes')
    $safeProcessesPath = Test-M000R1SafeExistingPath -LiteralPath $processesPath -Kind directory
    if ($null -eq $safeProcessesPath) { return New-M000R1ReferenceAttemptOutcome -Status invalid -ReasonCode 'reference-attempt-structure-invalid' }
    $entries = @(Get-ChildItem -LiteralPath $safeProcessesPath -Force -ErrorAction Stop)
    foreach ($entry in $entries) {
        if (-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return New-M000R1ReferenceAttemptOutcome -Status invalid -ReasonCode 'reference-attempt-structure-invalid' }
    }
    $expectedNames = @($script:LocalVerifyReferenceAttempts | ForEach-Object { $_.directory })
    $actualNames = @($entries | ForEach-Object { [string]$_.Name })
    if ($actualNames.Count -ne $expectedNames.Count) { return New-M000R1ReferenceAttemptOutcome -Status mismatch -ReasonCode 'reference-attempt-mismatch' }
    foreach ($name in $expectedNames) { if ($actualNames -cnotcontains $name) { return New-M000R1ReferenceAttemptOutcome -Status mismatch -ReasonCode 'reference-attempt-mismatch' } }

    $reports = @()
    $owned=0L; $terminated=0L; $remaining=0L
    foreach ($expected in $script:LocalVerifyReferenceAttempts) {
        $entry = @($entries | Where-Object { [string]$_.Name -ceq [string]$expected.directory })[0]
        $safeAttemptPath = Test-M000R1SafeExistingPath -LiteralPath ([string]$entry.FullName) -Kind directory
        if ($null -eq $safeAttemptPath) { return New-M000R1ReferenceAttemptOutcome -Status invalid -ReasonCode 'reference-attempt-structure-invalid' }
        $children = @(Get-ChildItem -LiteralPath $safeAttemptPath -Force -ErrorAction Stop)
        $requiredNames = @('process.json','stdout.log','stderr.log')
        if ($children.Count -ne 3) { return New-M000R1ReferenceAttemptOutcome -Status invalid -ReasonCode 'reference-attempt-structure-invalid' }
        foreach ($name in $requiredNames) {
            if (@($children | Where-Object { [string]$_.Name -ceq $name -and -not $_.PSIsContainer -and ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 }).Count -ne 1) { return New-M000R1ReferenceAttemptOutcome -Status invalid -ReasonCode 'reference-attempt-structure-invalid' }
        }
        $report = Read-M000R1StrictReferenceJson -LiteralPath ([IO.Path]::Combine($safeAttemptPath, 'process.json')) -MaximumBytes 65536
        if (-not (Test-OperatorProcessReportContract -ProcessReport $report)) { return New-M000R1ReferenceAttemptOutcome -Status invalid -ReasonCode 'reference-attempt-report-invalid' }
        $expectedCheck = $ResultChecks[[int]$expected.checkIndex]
        $matches = [int]$report.sequence -eq [int]$expected.sequence -and
            [string]$report.targetId -ceq [string]$expected.targetId -and
            [string]$expectedCheck.targetId -ceq [string]$expected.targetId -and
            [string]$expectedCheck.status -ceq 'passed' -and
            [string]$report.status -ceq 'passed' -and
            $report.exitCode -is [int] -and [int]$report.exitCode -eq 0 -and
            $report.timedOut -is [bool] -and -not [bool]$report.timedOut -and
            [string]$report.healthStatus -ceq 'not-configured' -and
            $report.workerPid -is [int] -and $report.targetPid -is [int] -and
            [int]$report.workerPid -gt 0 -and [int]$report.targetPid -gt 0 -and [int]$report.workerPid -ne [int]$report.targetPid -and
            $report.stdoutTruncated -is [bool] -and -not [bool]$report.stdoutTruncated -and
            $report.stderrTruncated -is [bool] -and -not [bool]$report.stderrTruncated -and
            [string]$report.cleanup.status -ceq 'passed' -and [int]$report.cleanup.remainingOwnedProcessCount -eq 0
        if (-not $matches) { return New-M000R1ReferenceAttemptOutcome -Status mismatch -ReasonCode 'reference-attempt-mismatch' }
        foreach ($logName in @('stdout.log','stderr.log')) {
            $log = Read-M000R1BoundedTextFile -LiteralPath ([IO.Path]::Combine($safeAttemptPath, $logName)) -MaximumBytes $script:MaximumReferenceLogBytes
            if ($log.Length -gt 5242880 -or -not (Test-OperatorLogTextSafe -Text $log)) { return New-M000R1ReferenceAttemptOutcome -Status invalid -ReasonCode 'reference-attempt-log-invalid' }
        }
        $reports += $report
        $owned += [int64]$report.cleanup.ownedProcessCount
        $terminated += [int64]$report.cleanup.terminatedProcessCount
        $remaining += [int64]$report.cleanup.remainingOwnedProcessCount
    }
    if ($owned -gt [int]::MaxValue -or $terminated -gt [int]::MaxValue -or $remaining -gt [int]::MaxValue) { return New-M000R1ReferenceAttemptOutcome -Status invalid -ReasonCode 'reference-attempt-cleanup-invalid' }
    return New-M000R1ReferenceAttemptOutcome -Status valid -ReasonCode 'reference-attempts-valid' -Owned ([int]$owned) -Terminated ([int]$terminated) -Remaining ([int]$remaining) -Reports $reports
}

function New-M000R1ReferenceOutcome {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('passed','blocked','error')][string]$Status,
        [Parameter(Mandatory = $true)][ValidateSet('none','invocation','internal')][string]$ErrorKind,
        [Parameter(Mandatory = $true)][string]$ReasonCode,
        [AllowNull()][string]$ReferenceRunId,
        [AllowNull()]$RepositorySnapshot,
        [AllowNull()]$Fingerprint,
        [AllowNull()]$Cleanup
    )
    return [pscustomobject][ordered]@{ schemaVersion=[int]1; status=$Status; errorKind=$ErrorKind; reasonCode=$ReasonCode; referenceRunId=$ReferenceRunId; repositorySnapshot=$RepositorySnapshot; fingerprint=$Fingerprint; cleanup=$Cleanup }
}

function Test-M000R1ManifestEquivalent {
    param([Parameter(Mandatory = $true)]$ReferenceManifest, [Parameter(Mandatory = $true)]$CurrentManifest)
    $manifestModule = Get-M000R1TrustedManifestModule
    return [bool](& $manifestModule { param($Left, $Right) Test-OperatorJsonEquivalent -Left $Left -Right $Right } $ReferenceManifest $CurrentManifest)
}

function Test-M000R1ReferenceCheckMatrix {
    param([Parameter(Mandatory = $true)][object[]]$Checks)
    if ($Checks.Count -ne $script:LocalVerifyReferenceChecks.Count) { return $false }
    for ($index = 0; $index -lt $script:LocalVerifyReferenceChecks.Count; $index++) {
        $actual = $Checks[$index]
        $expected = $script:LocalVerifyReferenceChecks[$index]
        if ([string]$actual.checkId -cne [string]$expected.checkId -or [string]$actual.targetId -cne [string]$expected.targetId -or [string]$actual.status -cne 'passed') { return $false }
    }
    return $true
}

function Test-M000R1IntegerValue {
    param([AllowNull()]$Value)
    return $Value -is [sbyte] -or $Value -is [byte] -or $Value -is [int16] -or $Value -is [uint16] -or $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64]
}

function Test-M000R1ReferenceResultTextSemantics {
    param([Parameter(Mandatory = $true)]$Result)
    try {
        $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
        foreach ($check in @($Result.checks)) {
            $started = [DateTime]::MinValue
            $finished = [DateTime]::MinValue
            if ($check.startedAtUtc -isnot [string] -or -not [DateTime]::TryParseExact([string]$check.startedAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$started)) { return $false }
            if ($check.finishedAtUtc -isnot [string] -or -not [DateTime]::TryParseExact([string]$check.finishedAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$finished)) { return $false }
            if ($finished -lt $started -or -not (Test-M000R1IntegerValue -Value $check.durationMs) -or [int64]$check.durationMs -lt 0) { return $false }
            $measuredDuration = [Math]::Max(0, [int64][Math]::Round(($finished - $started).TotalMilliseconds))
            if ([Math]::Abs([int64]$check.durationMs - $measuredDuration) -gt 1000) { return $false }
            if ($check.summary -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$check.summary) -or -not (Test-M000R1ReferenceTextSafe -Text ([string]$check.summary) -MaximumCharacters 65536)) { return $false }
        }
        foreach ($message in @($Result.messages)) {
            if ($message -isnot [string] -or -not (Test-M000R1ReferenceTextSafe -Text ([string]$message) -MaximumCharacters 65536)) { return $false }
        }
        return $true
    }
    catch { return $false }
}

function Resolve-OperatorReferenceRun {
    param(
        [Parameter(Mandatory = $true)][string]$ReferenceRunId,
        [Parameter(Mandatory = $true)]$ManifestImport,
        [Parameter(Mandatory = $true)]$CurrentRepositoryState,
        [Parameter(Mandatory = $true)][string]$RepositoryRoot
    )
    $directory = Resolve-M000R1ReferenceRunDirectory -ReferenceRunId $ReferenceRunId
    if ($null -eq $directory) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-not-found' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
    try {
        if ([IO.File]::Exists([IO.Path]::Combine($directory, 'fatal.txt'))) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-run-structure-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $entries = @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop)
        foreach ($entry in $entries) { if ($script:ReferenceRootNames -cnotcontains [string]$entry.Name -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-run-structure-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null } }
        foreach ($requiredName in $script:ReferenceRootNames) { if (@($entries | Where-Object { [string]$_.Name -ceq $requiredName }).Count -ne 1) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-run-structure-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null } }
        $referenceManifest = Read-M000R1StrictReferenceJson -LiteralPath ([IO.Path]::Combine($directory, 'manifest.snapshot.json')) -MaximumBytes ([int](Get-OperatorMaximumManifestBytes))
        $manifestValidation = Test-OperatorJsonSchema -InputObject $referenceManifest -SchemaPath (Get-OperatorManifestSchemaPath)
        if (-not [bool]$manifestValidation.IsValid) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-manifest-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if (-not (Test-M000R1ManifestEquivalent -ReferenceManifest $referenceManifest -CurrentManifest $ManifestImport.Manifest)) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-manifest-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }

        $result = Read-M000R1StrictReferenceJson -LiteralPath ([IO.Path]::Combine($directory, 'result.json'))
        $resultValidation = Test-OperatorResultSemantics -Result $result
        if (-not [bool]$resultValidation.IsValid) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-result-semantics-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$result.runId -cne $ReferenceRunId) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-run-id-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$result.moduleId -cne [string]$ManifestImport.Manifest.moduleId) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-module-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$result.status -cne 'passed' -or [int]$result.exitCode -ne 0) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-status-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$result.stage -cne 'LocalVerify') { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-stage-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if (-not (Test-M000R1ReferenceCheckMatrix -Checks @($result.checks))) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-check-matrix-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if (-not (Test-M000R1ReferenceResultTextSemantics -Result $result)) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-result-text-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if (-not [string]::Equals([string]$result.runDirectory, $directory, [StringComparison]::OrdinalIgnoreCase)) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-run-structure-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$result.manifestSha256 -cne [string]$ManifestImport.Sha256) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-manifest-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$result.operatorVersion -cne (Get-OperatorFrameworkVersion)) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-version-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$result.revision -cne [string]$ManifestImport.Manifest.revision) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-revision-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $reportedHash = (Read-M000R1BoundedTextFile -LiteralPath ([IO.Path]::Combine($directory, 'manifest.sha256')) -MaximumBytes 128).Trim()
        if (-not [regex]::IsMatch($reportedHash, '^[a-f0-9]{64}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-run-structure-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ($reportedHash -cne [string]$ManifestImport.Sha256 -or $reportedHash -cne [string]$result.manifestSha256) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-manifest-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $reportedVersion = (Read-M000R1BoundedTextFile -LiteralPath ([IO.Path]::Combine($directory, 'operator-version.txt')) -MaximumBytes 128).Trim()
        if ($reportedVersion -cne (Get-OperatorFrameworkVersion)) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-version-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $invocation = Read-M000R1StrictReferenceJson -LiteralPath ([IO.Path]::Combine($directory, 'invocation.json')) -MaximumBytes 4096
        if (-not (Test-M000R1ClosedObject -InputObject $invocation -PropertyNames @('stage','manifestPath','invokedAtUtc')) -or [string]$invocation.stage -cne 'LocalVerify' -or [string]$invocation.manifestPath -cne '<redacted>' -or -not (Test-M000R1UtcTimestamp -Value ([string]$invocation.invokedAtUtc))) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-run-structure-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $environment = Read-M000R1StrictReferenceJson -LiteralPath ([IO.Path]::Combine($directory, 'environment.json'))
        if (-not [bool](Test-OperatorEnvironmentSnapshot -Snapshot $environment).isValid) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-environment-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        foreach ($logName in @('stdout.log','stderr.log')) {
            $rootLog = Read-M000R1BoundedTextFile -LiteralPath ([IO.Path]::Combine($directory, $logName)) -MaximumBytes $script:MaximumReferenceLogBytes
            if (-not (Test-M000R1ReferenceTextSafe -Text $rootLog -MaximumCharacters 5242880)) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-run-log-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        }
        $summary = Read-M000R1BoundedTextFile -LiteralPath ([IO.Path]::Combine($directory, 'summary.txt')) -MaximumBytes $script:MaximumReferenceSummaryBytes
        if (-not (Test-M000R1ReferenceTextSafe -Text $summary -MaximumCharacters $script:MaximumReferenceSummaryBytes)) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-run-log-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $snapshot = Read-M000R1StrictReferenceJson -LiteralPath ([IO.Path]::Combine($directory, 'repository-snapshot.json'))
        if (-not (Test-OperatorRepositorySnapshotReportContract -RepositorySnapshot $snapshot)) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-schema-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$snapshot.repositoryRoot -cne [string]$CurrentRepositoryState.snapshot.repositoryRoot) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-root-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$snapshot.branch -cne [string]$CurrentRepositoryState.snapshot.branch) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-branch-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$snapshot.headSha -cne [string]$CurrentRepositoryState.snapshot.headSha) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-head-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $policy = New-OperatorRepositoryPolicy -RepositoryRoot $RepositoryRoot -ExpectedHeadSha ([string]$CurrentRepositoryState.snapshot.headSha)
        if (-not [bool](Test-OperatorRepositorySnapshot -Snapshot $snapshot -Policy $policy).isValid) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-root-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $fingerprint = Read-M000R1StrictReferenceJson -LiteralPath ([IO.Path]::Combine($directory, 'working-tree-fingerprint.json'))
        if (-not (Test-OperatorWorkingTreeFingerprintReportContract -WorkingTreeFingerprint $fingerprint) -or [string]$fingerprint.headSha -cne [string]$snapshot.headSha) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-fingerprint-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $cleanupReport = Read-M000R1StrictReferenceJson -LiteralPath ([IO.Path]::Combine($directory, 'cleanup.json')) -MaximumBytes 65536
        $attempts = Test-M000R1ReferenceProcessAttempts -RunDirectory $directory -ResultChecks @($result.checks)
        if ([string]$attempts.status -ceq 'invalid') { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode ([string]$attempts.reasonCode) -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([string]$attempts.status -ceq 'mismatch') { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode ([string]$attempts.reasonCode) -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        if ([int]$attempts.count -ne 3 -or [int]$attempts.remaining -ne 0) { return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-attempt-cleanup-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
        $expectedOwned = [int64]$attempts.owned + [int64]$script:ReferenceGitInspectionProcessCount
        $expectedTerminated = [int64]$attempts.terminated
        if ($expectedOwned -gt [int]::MaxValue -or $expectedTerminated -gt [int]::MaxValue -or
            -not (Test-OperatorCleanupReportContract -CleanupReport $cleanupReport) -or
            [string]$cleanupReport.status -cne 'passed' -or [int]$cleanupReport.ownedProcessCount -ne [int]$expectedOwned -or [int]$cleanupReport.terminatedProcessCount -ne [int]$expectedTerminated -or [int]$cleanupReport.remainingOwnedProcessCount -ne 0 -or
            [string]$result.cleanup.status -cne [string]$cleanupReport.status -or [int]$result.cleanup.ownedProcessCount -ne [int]$cleanupReport.ownedProcessCount -or [int]$result.cleanup.terminatedProcessCount -ne [int]$cleanupReport.terminatedProcessCount -or [int]$result.cleanup.remainingOwnedProcessCount -ne [int]$cleanupReport.remainingOwnedProcessCount) {
            return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-cleanup-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null
        }
        $comparison = Compare-OperatorWorkingTreeFingerprint -ReferenceFingerprint $fingerprint -CurrentFingerprint $CurrentRepositoryState.fingerprint
        if (-not [bool]$comparison.isMatch) { return New-M000R1ReferenceOutcome -Status blocked -ErrorKind none -ReasonCode 'reference-fingerprint-mismatch' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $snapshot -Fingerprint $fingerprint -Cleanup $cleanupReport }
        return New-M000R1ReferenceOutcome -Status passed -ErrorKind none -ReasonCode 'reference-passed' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $snapshot -Fingerprint $fingerprint -Cleanup $cleanupReport
    }
    catch {
        $classifiedException = $_.Exception
        while ($null -ne $classifiedException) {
            if ($classifiedException.Data.Contains('OperatorErrorKind') -and [string]$classifiedException.Data['OperatorErrorKind'] -ceq 'TrustedSchema') { return New-M000R1ReferenceOutcome -Status error -ErrorKind internal -ReasonCode 'reference-contract-error' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null }
            $classifiedException = $classifiedException.InnerException
        }
        return New-M000R1ReferenceOutcome -Status error -ErrorKind invocation -ReasonCode 'reference-json-invalid' -ReferenceRunId $ReferenceRunId -RepositorySnapshot $null -Fingerprint $null -Cleanup $null
    }
}

function Test-OperatorBoundManifestBinding {
    param([Parameter(Mandatory = $true)]$ManifestImport)

    $internalResult = [pscustomobject][ordered]@{ schemaVersion=[int]1; isValid=[bool]$false; errorKind='internal'; reasonCode='manifest-binding-contract-error' }
    $invocationResult = [pscustomobject][ordered]@{ schemaVersion=[int]1; isValid=[bool]$false; errorKind='invocation'; reasonCode='manifest-hash-mismatch' }
    $validResult = [pscustomobject][ordered]@{ schemaVersion=[int]1; isValid=[bool]$true; errorKind='none'; reasonCode='manifest-binding-valid' }

    if (-not (Test-M000R1ClosedObject -InputObject $ManifestImport -PropertyNames @('Manifest','FullPath','Sha256','SnapshotJson','SchemaVersion','OperatorVersion'))) { return $internalResult }
    if ($ManifestImport.Manifest -isnot [pscustomobject] -or $ManifestImport.FullPath -isnot [string] -or $ManifestImport.Sha256 -isnot [string] -or
        $ManifestImport.SnapshotJson -isnot [string] -or $ManifestImport.SchemaVersion -isnot [int] -or $ManifestImport.OperatorVersion -isnot [string]) { return $internalResult }
    if (-not [regex]::IsMatch([string]$ManifestImport.Sha256, '^[a-f0-9]{64}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $internalResult }

    $maximumBytes = $null
    $manifestModule = $null
    $schemaPath = $null
    $stream = $null
    $hashAlgorithm = $null
    try {
        $maximumValue = Get-OperatorMaximumManifestBytes
        if (-not (Test-M000R1IntegerValue -Value $maximumValue) -or [int64]$maximumValue -lt 1 -or [int64]$maximumValue -ge [int]::MaxValue) { return $internalResult }
        $maximumBytes = [int]$maximumValue

        $manifestModule = Get-M000R1TrustedManifestModule
        $privateContract = & $manifestModule {
            [pscustomobject][ordered]@{
                strictJson = [bool]($null -ne (Get-Command -Name 'ConvertFrom-OperatorStrictJson' -CommandType Function -ErrorAction SilentlyContinue))
                equivalent = [bool]($null -ne (Get-Command -Name 'Test-OperatorJsonEquivalent' -CommandType Function -ErrorAction SilentlyContinue))
            }
        }
        if (-not (Test-M000R1ClosedObject -InputObject $privateContract -PropertyNames @('strictJson','equivalent')) -or
            $privateContract.strictJson -isnot [bool] -or $privateContract.equivalent -isnot [bool] -or
            -not [bool]$privateContract.strictJson -or -not [bool]$privateContract.equivalent) { return $internalResult }
        $snapshotManifest = & $manifestModule { param($JsonText) ConvertFrom-OperatorStrictJson -Text $JsonText } ([string]$ManifestImport.SnapshotJson)

        $schemaPathValue = Get-OperatorManifestSchemaPath
        if ($schemaPathValue -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$schemaPathValue)) { return $internalResult }
        $schemaPath = [string]$schemaPathValue
        $hashAlgorithm = [Security.Cryptography.SHA256]::Create()
        if ($null -eq $hashAlgorithm) { return $internalResult }
    }
    catch { return $internalResult }

    try {
        $safePath = Test-M000R1SafeExistingPath -LiteralPath ([string]$ManifestImport.FullPath) -Kind file
        if ($null -eq $safePath) { return $invocationResult }
        try {
            $stream = New-Object IO.FileStream($safePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
            $bytes = New-Object byte[] ($maximumBytes + 1)
            $total = 0
            while ($total -lt $bytes.Length) {
                $read = $stream.Read($bytes, $total, $bytes.Length - $total)
                if ($read -eq 0) { break }
                $total += $read
            }
        }
        catch { return $invocationResult }
        finally {
            if ($null -ne $stream) { $stream.Dispose(); $stream = $null }
        }
        if ($total -gt $maximumBytes) { return $invocationResult }
        try {
            $encoding = New-Object Text.UTF8Encoding($false, $true)
            $text = $encoding.GetString($bytes, 0, $total)
            $parsedManifest = & $manifestModule { param($JsonText) ConvertFrom-OperatorStrictJson -Text $JsonText } $text
        }
        catch { return $invocationResult }

        try {
            $fileSchemaValidation = Test-OperatorJsonSchema -InputObject $parsedManifest -SchemaPath $schemaPath
            $boundSchemaValidation = Test-OperatorJsonSchema -InputObject $ManifestImport.Manifest -SchemaPath $schemaPath
        }
        catch { return $internalResult }
        foreach ($schemaValidation in @($fileSchemaValidation,$boundSchemaValidation)) {
            if (-not (Test-M000R1ClosedObject -InputObject $schemaValidation -PropertyNames @('IsValid','Errors')) -or $schemaValidation.IsValid -isnot [bool] -or $schemaValidation.Errors -isnot [array]) { return $internalResult }
            foreach ($schemaError in @($schemaValidation.Errors)) { if ($schemaError -isnot [string]) { return $internalResult } }
        }
        if (-not [bool]$fileSchemaValidation.IsValid) { return $invocationResult }
        if (-not [bool]$boundSchemaValidation.IsValid) { return $internalResult }
        try { $isEquivalent = [bool](& $manifestModule { param($Left, $Right) Test-OperatorJsonEquivalent -Left $Left -Right $Right } $parsedManifest $ManifestImport.Manifest) }
        catch { return $internalResult }
        if (-not $isEquivalent) { return $invocationResult }
        try {
            $snapshotEquivalent = [bool](& $manifestModule { param($Left, $Right) Test-OperatorJsonEquivalent -Left $Left -Right $Right } $snapshotManifest $ManifestImport.Manifest)
            if (-not $snapshotEquivalent -or [int]$ManifestImport.SchemaVersion -ne [int]$ManifestImport.Manifest.schemaVersion -or [string]$ManifestImport.OperatorVersion -cne [string]$ManifestImport.Manifest.operatorVersion) { return $internalResult }
        }
        catch { return $internalResult }

        try {
            $hashBytes = $hashAlgorithm.ComputeHash($bytes, 0, $total)
            if ($hashBytes -isnot [byte[]] -or $hashBytes.Length -ne 32) { return $internalResult }
        }
        catch { return $internalResult }
        $hashText = ([BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
        if ($hashText -cne [string]$ManifestImport.Sha256) { return $invocationResult }
        return $validResult
    }
    catch { return $internalResult }
    finally {
        if ($null -ne $hashAlgorithm) { $hashAlgorithm.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Test-M000R1ManifestBinding {
    param([Parameter(Mandatory = $true)]$ManifestImport)
    return [bool](Test-OperatorBoundManifestBinding -ManifestImport $ManifestImport).isValid
}

function Test-M000R1CheckOutcome {
    param([AllowNull()]$Outcome)
    if (-not (Test-M000R1ClosedObject -InputObject $Outcome -PropertyNames @('schemaVersion','status','errorKind','reasonCode','cleanupSource','cleanup'))) { return $false }
    if ($Outcome.schemaVersion -isnot [int] -or [int]$Outcome.schemaVersion -ne 1) { return $false }
    if ($Outcome.status -isnot [string] -or @('passed','failed','blocked','error','skipped') -cnotcontains [string]$Outcome.status) { return $false }
    if ($Outcome.errorKind -isnot [string] -or @('none','invocation','internal') -cnotcontains [string]$Outcome.errorKind) { return $false }
    if ($Outcome.reasonCode -isnot [string] -or -not [regex]::IsMatch([string]$Outcome.reasonCode, '^[a-z0-9]+(?:-[a-z0-9]+)*$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $false }
    if ($Outcome.cleanupSource -isnot [string] -or @('none','inline','process-manager') -cnotcontains [string]$Outcome.cleanupSource) { return $false }
    if (-not (Test-M000R1ClosedObject -InputObject $Outcome.cleanup -PropertyNames @('status','ownedProcessCount','terminatedProcessCount','remainingOwnedProcessCount'))) { return $false }
    if ($Outcome.cleanup.status -isnot [string] -or @('passed','failed','skipped') -cnotcontains [string]$Outcome.cleanup.status) { return $false }
    foreach ($value in @($Outcome.cleanup.ownedProcessCount,$Outcome.cleanup.terminatedProcessCount,$Outcome.cleanup.remainingOwnedProcessCount)) { if ($value -isnot [int] -or [int]$value -lt 0) { return $false } }
    if (@('passed','skipped','failed','blocked') -ccontains [string]$Outcome.status -and [string]$Outcome.errorKind -cne 'none') { return $false }
    if ([string]$Outcome.status -ceq 'error' -and @('invocation','internal') -cnotcontains [string]$Outcome.errorKind) { return $false }
    $owned = [int]$Outcome.cleanup.ownedProcessCount
    $terminated = [int]$Outcome.cleanup.terminatedProcessCount
    $remaining = [int]$Outcome.cleanup.remainingOwnedProcessCount
    if ($terminated -gt $owned -or $remaining -gt $owned -or ($terminated + $remaining) -gt $owned) { return $false }
    if ([string]$Outcome.cleanup.status -ceq 'passed' -and $remaining -ne 0) { return $false }
    if ([string]$Outcome.cleanup.status -ceq 'failed' -and $remaining -le 0) { return $false }
    if ([string]$Outcome.cleanup.status -ceq 'skipped' -and ($owned -ne 0 -or $terminated -ne 0 -or $remaining -ne 0)) { return $false }
    if ([string]$Outcome.cleanupSource -ceq 'none' -and ($owned -ne 0 -or $terminated -ne 0 -or $remaining -ne 0)) { return $false }
    return $true
}

function New-M000R1ResultCheck {
    param(
        [Parameter(Mandatory = $true)]$ManifestCheck,
        [Parameter(Mandatory = $true)][DateTime]$Started,
        [Parameter(Mandatory = $true)][DateTime]$Finished,
        [Parameter(Mandatory = $true)]$Outcome
    )
    return [pscustomobject][ordered]@{
        checkId = [string]$ManifestCheck.checkId
        targetId = [string]$ManifestCheck.targetId
        status = [string]$Outcome.status
        startedAtUtc = $Started.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
        finishedAtUtc = $Finished.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
        durationMs = [int64][Math]::Max(0, [Math]::Round(($Finished.ToUniversalTime() - $Started.ToUniversalTime()).TotalMilliseconds))
        summary = ('Operator check reason: ' + [string]$Outcome.reasonCode + '.')
    }
}

function Merge-M000R1StageCleanup {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$InlineCleanup, [Parameter(Mandatory = $true)]$ProcessCleanup)
    if (-not (Test-M000R1StageCleanupContract -Cleanup $ProcessCleanup -AllowReport)) { throw 'Process cleanup contract is invalid.' }
    $owned=[int64]$ProcessCleanup.ownedProcessCount; $terminated=[int64]$ProcessCleanup.terminatedProcessCount; $remaining=[int64]$ProcessCleanup.remainingOwnedProcessCount
    $failed = [string]$ProcessCleanup.status -ceq 'failed'
    foreach ($item in $InlineCleanup) {
        if (-not (Test-M000R1StageCleanupContract -Cleanup $item)) { throw 'Inline cleanup contract is invalid.' }
        $owned += [int64]$item.ownedProcessCount; $terminated += [int64]$item.terminatedProcessCount; $remaining += [int64]$item.remainingOwnedProcessCount
        if ([string]$item.status -ceq 'failed') { $failed = $true }
    }
    if ($owned -gt [int]::MaxValue -or $terminated -gt [int]::MaxValue -or $remaining -gt [int]::MaxValue -or $terminated -gt $owned -or $remaining -gt $owned -or ($terminated + $remaining) -gt $owned) { throw 'Stage cleanup aggregate is invalid.' }
    $status = if ($failed -or $remaining -gt 0) { 'failed' } else { 'passed' }
    return [pscustomobject][ordered]@{ status=$status; ownedProcessCount=[int]$owned; terminatedProcessCount=[int]$terminated; remainingOwnedProcessCount=[int]$remaining }
}

function Test-M000R1StageCleanupContract {
    param([AllowNull()]$Cleanup, [switch]$AllowReport)
    $inlineProperties=@('status','ownedProcessCount','terminatedProcessCount','remainingOwnedProcessCount')
    $reportProperties=@('schemaVersion','status','ownedProcessCount','terminatedProcessCount','remainingOwnedProcessCount','completedAtUtc')
    $isInline=Test-M000R1ClosedObject -InputObject $Cleanup -PropertyNames $inlineProperties
    $isReport=$AllowReport -and (Test-M000R1ClosedObject -InputObject $Cleanup -PropertyNames $reportProperties)
    if (-not $isInline -and -not $isReport) { return $false }
    if ($isReport -and ($Cleanup.schemaVersion -isnot [int] -or [int]$Cleanup.schemaVersion -ne 1 -or -not (Test-M000R1UtcTimestamp -Value ([string]$Cleanup.completedAtUtc)))) { return $false }
    $allowedStatuses=if($isReport){@('passed','failed','skipped')}else{@('passed','failed')}
    if ($Cleanup.status -isnot [string] -or $allowedStatuses -cnotcontains [string]$Cleanup.status) { return $false }
    foreach ($count in @($Cleanup.ownedProcessCount,$Cleanup.terminatedProcessCount,$Cleanup.remainingOwnedProcessCount)) { if ($count -isnot [int] -or [int]$count -lt 0) { return $false } }
    $owned=[int]$Cleanup.ownedProcessCount; $terminated=[int]$Cleanup.terminatedProcessCount; $remaining=[int]$Cleanup.remainingOwnedProcessCount
    if ($terminated -gt $owned -or $remaining -gt $owned -or ($terminated + $remaining) -gt $owned) { return $false }
    if ([string]$Cleanup.status -ceq 'passed' -and $remaining -ne 0) { return $false }
    if ([string]$Cleanup.status -ceq 'failed' -and $remaining -le 0) { return $false }
    if ([string]$Cleanup.status -ceq 'skipped' -and ($owned -ne 0 -or $terminated -ne 0 -or $remaining -ne 0)) { return $false }
    return $true
}

function Get-M000R1ConservativeStageCleanup {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$InlineCleanup, [AllowNull()]$ProcessCleanup)
    $owned=0L; $terminated=0L; $remaining=0L; $uncertain=$false; $failed=$false
    foreach ($item in @($InlineCleanup)) {
        if ($null -ne $item -and (Test-M000R1StageCleanupContract -Cleanup $item)) {
            $owned += [int64]$item.ownedProcessCount; $terminated += [int64]$item.terminatedProcessCount; $remaining += [int64]$item.remainingOwnedProcessCount
            if ([string]$item.status -ceq 'failed') { $failed=$true }
        }
        else { $uncertain=$true }
    }
    if ($null -ne $ProcessCleanup -and (Test-M000R1StageCleanupContract -Cleanup $ProcessCleanup -AllowReport)) {
        $owned += [int64]$ProcessCleanup.ownedProcessCount; $terminated += [int64]$ProcessCleanup.terminatedProcessCount; $remaining += [int64]$ProcessCleanup.remainingOwnedProcessCount
        if ([string]$ProcessCleanup.status -ceq 'failed') { $failed=$true }
    }
    else { $uncertain=$true }
    if ($uncertain) { $owned += 1; $remaining += 1; $failed=$true }
    if ($owned -gt [int]::MaxValue -or $terminated -gt [int]::MaxValue -or $remaining -gt [int]::MaxValue -or ($terminated + $remaining) -gt $owned) {
        return [pscustomobject][ordered]@{ status='failed'; ownedProcessCount=[int]1; terminatedProcessCount=[int]0; remainingOwnedProcessCount=[int]1 }
    }
    return [pscustomobject][ordered]@{ status=$(if($failed -or $remaining -gt 0){'failed'}else{'passed'}); ownedProcessCount=[int]$owned; terminatedProcessCount=[int]$terminated; remainingOwnedProcessCount=[int]$remaining }
}

function New-M000R1StageOutcome {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('passed','failed','blocked','error')][string]$Status,
        [Parameter(Mandatory = $true)][ValidateSet(0,10,20,30,40)][int]$ExitCode,
        [Parameter(Mandatory = $true)][ValidateSet('none','invocation','internal')][string]$ErrorKind,
        [Parameter(Mandatory = $true)][string]$ReasonCode,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Checks,
        [Parameter(Mandatory = $true)][string[]]$Messages,
        [Parameter(Mandatory = $true)]$Cleanup,
        [AllowNull()]$RepositorySnapshot,
        [AllowNull()]$Fingerprint
    )
    if (-not [regex]::IsMatch($ReasonCode, '^[a-z0-9]+(?:-[a-z0-9]+)*$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Stage outcome reason code is invalid.' }
    if ($Status -ceq 'error' -and @('invocation','internal') -cnotcontains $ErrorKind) { throw 'Stage outcome error classification is invalid.' }
    if ($Status -cne 'error' -and $ErrorKind -cne 'none') { throw 'Stage outcome error classification is invalid.' }
    return [pscustomobject][ordered]@{ schemaVersion=[int]1; status=$Status; exitCode=[int]$ExitCode; errorKind=$ErrorKind; reasonCode=$ReasonCode; checks=@($Checks); messages=@($Messages); cleanup=$Cleanup; repositorySnapshot=$RepositorySnapshot; fingerprint=$Fingerprint }
}

function Get-M000R1StageStatusPriority {
    param(
        [Parameter(Mandatory = $true)][string]$Status,
        [Parameter(Mandatory = $true)][int]$ExitCode,
        [Parameter(Mandatory = $true)][string]$ErrorKind,
        [Parameter(Mandatory = $true)][string]$ReasonCode
    )
    if ($Status -ceq 'blocked' -and $ExitCode -eq 20 -and $ErrorKind -ceq 'none' -and $ReasonCode -ceq 'stage-cleanup-failed') { return 1 }
    if ($Status -ceq 'error' -and $ExitCode -eq 40 -and $ErrorKind -ceq 'internal') { return 2 }
    if ($Status -ceq 'error' -and $ExitCode -eq 30 -and $ErrorKind -ceq 'invocation') { return 3 }
    if ($Status -ceq 'blocked' -and $ExitCode -eq 20 -and $ErrorKind -ceq 'none') { return 4 }
    if ($Status -ceq 'failed' -and $ExitCode -eq 10 -and $ErrorKind -ceq 'none') { return 5 }
    if ($Status -ceq 'passed' -and $ExitCode -eq 0 -and $ErrorKind -ceq 'none' -and $ReasonCode -ceq 'stage-passed') { return 6 }
    throw 'Stage status tuple is invalid.'
}

function Set-M000R1StageFailure {
    param(
        [Parameter(Mandatory = $true)]$CurrentState,
        [Parameter(Mandatory = $true)][string]$Status,
        [Parameter(Mandatory = $true)][int]$ExitCode,
        [Parameter(Mandatory = $true)][string]$ErrorKind,
        [Parameter(Mandatory = $true)][string]$ReasonCode
    )
    if (-not (Test-M000R1ClosedObject -InputObject $CurrentState -PropertyNames @('status','exitCode','errorKind','reasonCode'))) { throw 'Current stage status state is invalid.' }
    if (-not [regex]::IsMatch($ReasonCode, '^[a-z0-9]+(?:-[a-z0-9]+)*$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Stage status reason code is invalid.' }
    $currentPriority = Get-M000R1StageStatusPriority -Status ([string]$CurrentState.status) -ExitCode ([int]$CurrentState.exitCode) -ErrorKind ([string]$CurrentState.errorKind) -ReasonCode ([string]$CurrentState.reasonCode)
    $newPriority = Get-M000R1StageStatusPriority -Status $Status -ExitCode $ExitCode -ErrorKind $ErrorKind -ReasonCode $ReasonCode
    if ($currentPriority -le $newPriority) { return $CurrentState }
    return [pscustomobject][ordered]@{ status=$Status; exitCode=[int]$ExitCode; errorKind=$ErrorKind; reasonCode=$ReasonCode }
}

function Test-M000R1ManifestBindingResultContract {
    param([AllowNull()]$BindingResult)
    if (-not (Test-M000R1ClosedObject -InputObject $BindingResult -PropertyNames @('schemaVersion','isValid','errorKind','reasonCode'))) { return $false }
    if ($BindingResult.schemaVersion -isnot [int] -or [int]$BindingResult.schemaVersion -ne 1 -or $BindingResult.isValid -isnot [bool] -or $BindingResult.errorKind -isnot [string] -or $BindingResult.reasonCode -isnot [string]) { return $false }
    if ([bool]$BindingResult.isValid) { return [string]$BindingResult.errorKind -ceq 'none' -and [string]$BindingResult.reasonCode -ceq 'manifest-binding-valid' }
    if ([string]$BindingResult.errorKind -ceq 'invocation') { return [string]$BindingResult.reasonCode -ceq 'manifest-hash-mismatch' }
    if ([string]$BindingResult.errorKind -ceq 'internal') { return [string]$BindingResult.reasonCode -ceq 'manifest-binding-contract-error' }
    return $false
}

function Merge-M000R1StageManifestBindingState {
    param(
        [Parameter(Mandatory = $true)]$CurrentState,
        [AllowNull()]$ManifestImport
    )
    if ($null -eq $ManifestImport) {
        return Set-M000R1StageFailure -CurrentState $CurrentState -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'manifest-binding-contract-error'
    }
    $bindingResult = $null
    try { $bindingResult = Test-OperatorBoundManifestBinding -ManifestImport $ManifestImport }
    catch {
        return Set-M000R1StageFailure -CurrentState $CurrentState -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'manifest-binding-contract-error'
    }
    if (-not (Test-M000R1ManifestBindingResultContract -BindingResult $bindingResult)) {
        return Set-M000R1StageFailure -CurrentState $CurrentState -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'manifest-binding-contract-error'
    }
    if ([bool]$bindingResult.isValid) { return $CurrentState }
    if ([string]$bindingResult.errorKind -ceq 'internal') {
        return Set-M000R1StageFailure -CurrentState $CurrentState -Status error -ExitCode 40 -ErrorKind internal -ReasonCode ([string]$bindingResult.reasonCode)
    }
    return Set-M000R1StageFailure -CurrentState $CurrentState -Status error -ExitCode 30 -ErrorKind invocation -ReasonCode ([string]$bindingResult.reasonCode)
}

function Merge-OperatorFinalManifestBindingState {
    param(
        [Parameter(Mandatory = $true)]$CurrentState,
        [AllowNull()]$BindingResult
    )
    $internalState = [pscustomobject][ordered]@{ status='error'; exitCode=[int]40; errorKind='internal'; reasonCode='manifest-binding-contract-error' }
    if (-not (Test-M000R1ClosedObject -InputObject $CurrentState -PropertyNames @('status','exitCode','errorKind','reasonCode'))) { return $internalState }
    if ($CurrentState.status -isnot [string] -or $CurrentState.exitCode -isnot [int] -or $CurrentState.errorKind -isnot [string] -or $CurrentState.reasonCode -isnot [string]) { return $internalState }
    try { $null = Get-M000R1StageStatusPriority -Status ([string]$CurrentState.status) -ExitCode ([int]$CurrentState.exitCode) -ErrorKind ([string]$CurrentState.errorKind) -ReasonCode ([string]$CurrentState.reasonCode) }
    catch { return $internalState }

    if (-not (Test-M000R1ManifestBindingResultContract -BindingResult $BindingResult)) {
        return Set-M000R1StageFailure -CurrentState $CurrentState -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'manifest-binding-contract-error'
    }
    if ([bool]$BindingResult.isValid) { return $CurrentState }
    if ([string]$BindingResult.errorKind -ceq 'internal') {
        return Set-M000R1StageFailure -CurrentState $CurrentState -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'manifest-binding-contract-error'
    }
    if ([string]$CurrentState.status -ceq 'blocked' -and [int]$CurrentState.exitCode -eq 20) { return $CurrentState }
    return Set-M000R1StageFailure -CurrentState $CurrentState -Status error -ExitCode 30 -ErrorKind invocation -ReasonCode 'manifest-hash-mismatch'
}

function Test-M000R1CheckDefinitionContract {
    param([AllowNull()]$Definition)
    if (-not (Test-M000R1ClosedObject -InputObject $Definition -PropertyNames @('checkId','targetId','allowedStages','allowedTimeoutProfiles','expectedSemantics','required'))) { return $false }
    if ($Definition.checkId -isnot [string] -or $Definition.targetId -isnot [string] -or $Definition.expectedSemantics -isnot [string] -or $Definition.required -isnot [bool]) { return $false }
    if (@($Definition.allowedStages).Count -eq 0 -or @($Definition.allowedTimeoutProfiles).Count -eq 0) { return $false }
    foreach ($value in @($Definition.allowedStages) + @($Definition.allowedTimeoutProfiles)) { if ($value -isnot [string]) { return $false } }
    return $true
}

function Test-M000R1CheckRegistryIntegrity {
    try {
        $registry = Get-OperatorCheckRegistrySnapshot
        if ($registry.Count -ne 20) { return $false }
        foreach ($registration in $registry) {
            if ($registration -isnot [pscustomobject] -or $null -eq $registration.PSObject.Properties['CheckId'] -or $null -eq $registration.PSObject.Properties['TargetId']) { return $false }
            $definition = Get-M000R1CheckDefinition -CheckId ([string]$registration.CheckId) -TargetId ([string]$registration.TargetId)
            if (-not (Test-M000R1CheckDefinitionContract -Definition $definition)) { return $false }
            $binding = Test-M000R1CheckRegistrationBinding -CheckId ([string]$definition.checkId) -TargetId ([string]$definition.targetId) -Registration $registration
            if (-not (Test-M000R1ClosedObject -InputObject $binding -PropertyNames @('schemaVersion','isValid','reasonCode')) -or $binding.schemaVersion -isnot [int] -or [int]$binding.schemaVersion -ne 1 -or $binding.isValid -isnot [bool] -or -not [bool]$binding.isValid) { return $false }
        }
        return $true
    }
    catch { return $false }
}

function New-M000R1FallbackStageOutcome {
    param([Parameter(Mandatory = $true)]$State, [object[]]$Checks, [Parameter(Mandatory = $true)]$Cleanup, [AllowNull()]$RepositorySnapshot, [AllowNull()]$Fingerprint)
    return [pscustomobject][ordered]@{ schemaVersion=[int]1; status=[string]$State.status; exitCode=[int]$State.exitCode; errorKind=[string]$State.errorKind; reasonCode=[string]$State.reasonCode; checks=@($Checks); messages=@([string]$State.reasonCode); cleanup=$Cleanup; repositorySnapshot=$RepositorySnapshot; fingerprint=$Fingerprint }
}

function Invoke-OperatorStage {
    param(
        [Parameter(Mandatory = $true)][string]$Stage,
        [Parameter(Mandatory = $true)]$ManifestImport,
        [Parameter(Mandatory = $true)]$RunContext,
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $false)][bool]$ReferenceRunIdProvided = $false,
        [AllowNull()][string]$ReferenceRunId
    )
    $checks=@(); $inlineCleanup=@(); $referenceRun=$null; $repositoryState=$null; $stageChecks=@()
    $state=[pscustomobject][ordered]@{ status='passed'; exitCode=[int]0; errorKind='none'; reasonCode='stage-passed' }
    $context=[pscustomobject][ordered]@{ schemaVersion=[int]1; stage=$Stage; repositoryRoot=$RepositoryRoot; runContext=$RunContext; manifestImport=$ManifestImport; referenceRun=$null; repositoryState=$null; finalRepositoryState=$null }
    try {
        $booleanWasBound=$PSBoundParameters.ContainsKey('ReferenceRunIdProvided')
        $valueWasBound=$PSBoundParameters.ContainsKey('ReferenceRunId')
        if (-not $booleanWasBound -or [bool]$ReferenceRunIdProvided -ne [bool]$valueWasBound) {
            $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'reference-parameter-contract-error'
        }
        if ([string]$state.status -ceq 'passed') {
            $referenceParameter=Test-OperatorReferenceRunIdParameter -Stage $Stage -ReferenceRunIdProvided $ReferenceRunIdProvided -ReferenceRunId $ReferenceRunId
            if ([string]$referenceParameter.status -ceq 'blocked') { $state=Set-M000R1StageFailure -CurrentState $state -Status blocked -ExitCode 20 -ErrorKind none -ReasonCode ([string]$referenceParameter.reasonCode) }
        }
        $state = Merge-M000R1StageManifestBindingState -CurrentState $state -ManifestImport $ManifestImport

        if ([string]$state.status -ceq 'passed') {
            $stageProperty=$ManifestImport.Manifest.stages.PSObject.Properties[$Stage]
            if ($null -eq $stageProperty -or -not (Test-M000R1ClosedObject -InputObject $stageProperty.Value -PropertyNames @('checks'))) {
                $state=Set-M000R1StageFailure -CurrentState $state -Status blocked -ExitCode 20 -ErrorKind none -ReasonCode 'manifest-stage-binding-blocked'
            }
            else {
                $stageChecks=@($stageProperty.Value.checks)
                if ($stageChecks.Count -eq 0) { $state=Set-M000R1StageFailure -CurrentState $state -Status blocked -ExitCode 20 -ErrorKind none -ReasonCode 'manifest-stage-binding-blocked' }
            }
        }
        if ([string]$state.status -ceq 'passed') {
            $seen=@{}
            foreach ($manifestCheck in $stageChecks) {
                if (-not (Test-M000R1ClosedObject -InputObject $manifestCheck -PropertyNames @('checkId','targetId','timeoutProfile','required'))) { $state=Set-M000R1StageFailure -CurrentState $state -Status blocked -ExitCode 20 -ErrorKind none -ReasonCode 'manifest-check-binding-blocked'; break }
                $key=([string]$manifestCheck.checkId+"`n"+[string]$manifestCheck.targetId)
                if ($seen.ContainsKey($key)) { $state=Set-M000R1StageFailure -CurrentState $state -Status blocked -ExitCode 20 -ErrorKind none -ReasonCode 'manifest-check-duplicate-blocked'; break }
                $seen[$key]=$true
                $definition=Get-M000R1CheckDefinition -CheckId ([string]$manifestCheck.checkId) -TargetId ([string]$manifestCheck.targetId)
                if ($null -eq $definition) { $state=Set-M000R1StageFailure -CurrentState $state -Status blocked -ExitCode 20 -ErrorKind none -ReasonCode 'manifest-check-unknown-blocked'; break }
                if (-not (Test-M000R1CheckDefinitionContract -Definition $definition)) { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'registry-definition-contract-error'; break }
                if (@($definition.allowedStages) -cnotcontains $Stage -or @($definition.allowedTimeoutProfiles) -cnotcontains [string]$manifestCheck.timeoutProfile -or $manifestCheck.required -isnot [bool] -or [bool]$manifestCheck.required -ne [bool]$definition.required) { $state=Set-M000R1StageFailure -CurrentState $state -Status blocked -ExitCode 20 -ErrorKind none -ReasonCode 'manifest-check-binding-blocked'; break }
            }
        }
        if ([string]$state.status -ceq 'passed' -and -not (Test-M000R1CheckRegistryIntegrity)) { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'registry-integrity-error' }

        if ([string]$state.status -ceq 'passed' -and $Stage -cne 'SelfTest') {
            $repositoryState=Get-M000R1CurrentRepositoryState -RepositoryRoot $RepositoryRoot
            if ($null -ne $repositoryState -and $null -ne $repositoryState.PSObject.Properties['cleanup'] -and (Test-M000R1StageCleanupContract -Cleanup $repositoryState.cleanup)) { $inlineCleanup+=$repositoryState.cleanup }
            $context.repositoryState=$repositoryState
            if ([string]$repositoryState.status -cne 'passed') {
                $repositoryExit=if([string]$repositoryState.status -ceq 'failed'){10}elseif([string]$repositoryState.status -ceq 'blocked'){20}elseif([string]$repositoryState.errorKind -ceq 'invocation'){30}else{40}
                $repositoryErrorKind=if([string]$repositoryState.status -ceq 'error'){[string]$repositoryState.errorKind}else{'none'}
                $state=Set-M000R1StageFailure -CurrentState $state -Status ([string]$repositoryState.status) -ExitCode $repositoryExit -ErrorKind $repositoryErrorKind -ReasonCode ([string]$repositoryState.reasonCode)
            }
        }
        if ([string]$state.status -ceq 'passed' -and $Stage -ceq 'LocalFreeze') {
            $referenceRun=Resolve-OperatorReferenceRun -ReferenceRunId ([string]$ReferenceRunId) -ManifestImport $ManifestImport -CurrentRepositoryState $repositoryState -RepositoryRoot $RepositoryRoot
            $context.referenceRun=$referenceRun
            if ([string]$referenceRun.status -cne 'passed') {
                $referenceExit=if([string]$referenceRun.status -ceq 'blocked'){20}elseif([string]$referenceRun.errorKind -ceq 'internal'){40}else{30}
                $referenceErrorKind=if([string]$referenceRun.status -ceq 'error'){[string]$referenceRun.errorKind}else{'none'}
                $state=Set-M000R1StageFailure -CurrentState $state -Status ([string]$referenceRun.status) -ExitCode $referenceExit -ErrorKind $referenceErrorKind -ReasonCode ([string]$referenceRun.reasonCode)
            }
        }
        if ([string]$state.status -ceq 'passed') {
            foreach ($manifestCheck in $stageChecks) {
                $state = Merge-M000R1StageManifestBindingState -CurrentState $state -ManifestImport $ManifestImport
                if ([string]$state.status -cne 'passed') { break }
                $registration=Get-OperatorCheckRegistration -CheckId ([string]$manifestCheck.checkId) -TargetId ([string]$manifestCheck.targetId)
                $registrationBinding=Test-M000R1CheckRegistrationBinding -CheckId ([string]$manifestCheck.checkId) -TargetId ([string]$manifestCheck.targetId) -Registration $registration
                if (-not (Test-M000R1ClosedObject -InputObject $registrationBinding -PropertyNames @('schemaVersion','isValid','reasonCode')) -or $registrationBinding.isValid -isnot [bool] -or -not [bool]$registrationBinding.isValid) { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'registry-binding-error'; break }
                $started=[DateTime]::UtcNow
                try { $outcome=& $registration.Handler -Context $context -ManifestCheck $manifestCheck }
                catch { $outcome=[pscustomobject][ordered]@{ schemaVersion=[int]1; status='error'; errorKind='internal'; reasonCode='check-handler-error'; cleanupSource='none'; cleanup=[pscustomobject][ordered]@{ status='passed'; ownedProcessCount=[int]0; terminatedProcessCount=[int]0; remainingOwnedProcessCount=[int]0 } } }
                $finished=[DateTime]::UtcNow
                if ($null -ne $outcome -and $null -ne $outcome.PSObject.Properties['cleanupSource'] -and [string]$outcome.cleanupSource -ceq 'inline' -and $null -ne $outcome.PSObject.Properties['cleanup'] -and (Test-M000R1StageCleanupContract -Cleanup $outcome.cleanup)) { $inlineCleanup+=$outcome.cleanup }
                if (-not (Test-M000R1CheckOutcome -Outcome $outcome)) { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'check-outcome-invalid'; break }
                $checks+=New-M000R1ResultCheck -ManifestCheck $manifestCheck -Started $started -Finished $finished -Outcome $outcome
                if ([bool]$manifestCheck.required -and [string]$outcome.status -ceq 'skipped') { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'required-check-skipped'; break }
                if ([string]$outcome.status -cne 'passed' -and -not (-not [bool]$manifestCheck.required -and [string]$outcome.status -ceq 'skipped')) {
                    $checkExit=if([string]$outcome.status -ceq 'failed'){10}elseif([string]$outcome.status -ceq 'blocked'){20}elseif([string]$outcome.errorKind -ceq 'invocation'){30}else{40}
                    $checkErrorKind=if([string]$outcome.status -ceq 'error'){[string]$outcome.errorKind}else{'none'}
                    $state=Set-M000R1StageFailure -CurrentState $state -Status ([string]$outcome.status) -ExitCode $checkExit -ErrorKind $checkErrorKind -ReasonCode ([string]$outcome.reasonCode)
                    break
                }
            }
        }
    }
    catch { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'stage-execution-error' }

    $state = Merge-M000R1StageManifestBindingState -CurrentState $state -ManifestImport $ManifestImport
    $processCleanup=$null; $processCompletionAttempted=$false
    try {
        if ($processCompletionAttempted) { throw 'Process completion was attempted more than once.' }
        $processCompletionAttempted=$true
        $processCleanup=Complete-OperatorProcessRun -RunContext $RunContext
    }
    catch { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'process-cleanup-error' }
    try { $cleanup=Merge-M000R1StageCleanup -InlineCleanup $inlineCleanup -ProcessCleanup $processCleanup }
    catch {
        $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'cleanup-merge-error'
        $cleanup=Get-M000R1ConservativeStageCleanup -InlineCleanup $inlineCleanup -ProcessCleanup $processCleanup
    }
    if ([string]$cleanup.status -cne 'passed' -or [int]$cleanup.remainingOwnedProcessCount -gt 0) { $state=Set-M000R1StageFailure -CurrentState $state -Status blocked -ExitCode 20 -ErrorKind none -ReasonCode 'stage-cleanup-failed' }
    $cleanupReport=[pscustomobject][ordered]@{ schemaVersion=[int]1; status=[string]$cleanup.status; ownedProcessCount=[int]$cleanup.ownedProcessCount; terminatedProcessCount=[int]$cleanup.terminatedProcessCount; remainingOwnedProcessCount=[int]$cleanup.remainingOwnedProcessCount; completedAtUtc=[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ',[Globalization.CultureInfo]::InvariantCulture) }
    try { Write-OperatorCleanupReport -RunDirectory ([string]$RunContext.RunDirectory) -CleanupReport $cleanupReport }
    catch { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'cleanup-report-write-error' }
    $state = Merge-M000R1StageManifestBindingState -CurrentState $state -ManifestImport $ManifestImport

    $repositorySnapshot=$null; $fingerprint=$null
    try {
        $finalRepositoryState=if($null -ne $context.finalRepositoryState){$context.finalRepositoryState}else{$repositoryState}
        if ($null -ne $finalRepositoryState) { $repositorySnapshot=$finalRepositoryState.snapshot; $fingerprint=$finalRepositoryState.fingerprint }
    }
    catch { $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'stage-result-contract-error' }
    try { return New-M000R1StageOutcome -Status ([string]$state.status) -ExitCode ([int]$state.exitCode) -ErrorKind ([string]$state.errorKind) -ReasonCode ([string]$state.reasonCode) -Checks $checks -Messages @([string]$state.reasonCode) -Cleanup $cleanup -RepositorySnapshot $repositorySnapshot -Fingerprint $fingerprint }
    catch {
        $state=Set-M000R1StageFailure -CurrentState $state -Status error -ExitCode 40 -ErrorKind internal -ReasonCode 'stage-outcome-error'
        return New-M000R1FallbackStageOutcome -State $state -Checks $checks -Cleanup $cleanup -RepositorySnapshot $repositorySnapshot -Fingerprint $fingerprint
    }
}

Export-ModuleMember -Function @(
    'Test-OperatorReferenceRunIdParameter',
    'Test-OperatorBoundManifestBinding',
    'Merge-OperatorFinalManifestBindingState',
    'Resolve-OperatorReferenceRun',
    'Invoke-OperatorStage'
)
