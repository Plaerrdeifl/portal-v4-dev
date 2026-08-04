Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$moduleRoot = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', 'modules'))
foreach ($moduleName in @(
    'Operator.Core.psm1',
    'Operator.Manifest.psm1',
    'Operator.Git.psm1',
    'Operator.Environment.psm1',
    'Operator.Security.psm1',
    'Operator.Reporting.psm1',
    'Operator.Process.psm1'
)) {
    Import-Module -Name ([IO.Path]::Combine($moduleRoot, $moduleName)) -ErrorAction Stop
}

$script:GitStdoutLimit = 1048576
$script:GitStderrLimit = 65536
$script:GitTerminationWaitMilliseconds = 5000
$script:RunLogCharacterLimit = 5242880
$script:AllowedDPaths = @(
    'scripts/operator/checks/M000.R1.Checks.psm1',
    'scripts/operator/modules/Operator.Orchestration.psm1',
    'scripts/operator/manifests/M000-R1.json',
    'scripts/operator/portal-operator.ps1',
    'scripts/operator/modules/Operator.Reporting.psm1',
    'scripts/operator/tests/Test.Helpers.ps1',
    'scripts/operator/tests/Operator.Manifest.Tests.ps1',
    'scripts/operator/tests/Operator.Repository.Tests.ps1',
    'scripts/operator/tests/Operator.Registry.Tests.ps1',
    'scripts/operator/tests/Operator.Security.Tests.ps1',
    'scripts/operator/tests/Operator.Reporting.Tests.ps1',
    'scripts/operator/tests/Operator.Process.Tests.ps1',
    'scripts/operator/tests/Operator.Orchestration.Tests.ps1',
    'scripts/operator/tests/portal-operator.Tests.ps1',
    'docs/project/operator-framework-contracts-v1.md',
    'docs/modules/M000/R1/M000-R1-D.md',
    'docs/modules/M000/R1/M000-R1-COMPLETION.md'
)

$script:BoundedGitStreamSource = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Plaerrdeifl.Operator.D1 {
    public sealed class BoundedGitStreams {
        private readonly StringBuilder stdout = new StringBuilder();
        private readonly Object stdoutLock = new Object();
        private readonly Task stdoutTask;
        private readonly Task stderrTask;
        private readonly Int32 stdoutLimit;
        private readonly Int32 stderrLimit;
        private volatile Boolean stdoutTruncated;
        private volatile Boolean stderrTruncated;
        private volatile Boolean stderrPresent;
        private volatile Boolean failed;

        public BoundedGitStreams(Process process, Int32 maximumStdout, Int32 maximumStderr) {
            if (process == null) throw new ArgumentNullException("process");
            stdoutLimit = maximumStdout;
            stderrLimit = maximumStderr;
            stdoutTask = Task.Factory.StartNew(
                () => Drain(process.StandardOutput, true),
                CancellationToken.None,
                TaskCreationOptions.LongRunning,
                TaskScheduler.Default);
            stderrTask = Task.Factory.StartNew(
                () => Drain(process.StandardError, false),
                CancellationToken.None,
                TaskCreationOptions.LongRunning,
                TaskScheduler.Default);
        }

        private void Drain(StreamReader reader, Boolean isStdout) {
            Char[] buffer = new Char[4096];
            Int32 retainedStderr = 0;
            try {
                while (true) {
                    Int32 read = reader.Read(buffer, 0, buffer.Length);
                    if (read == 0) break;
                    if (isStdout) {
                        lock (stdoutLock) {
                            Int32 remaining = stdoutLimit - stdout.Length;
                            if (remaining > 0) stdout.Append(buffer, 0, Math.Min(read, remaining));
                            if (read > remaining) stdoutTruncated = true;
                        }
                    } else {
                        stderrPresent = true;
                        Int32 remaining = stderrLimit - retainedStderr;
                        if (remaining > 0) retainedStderr += Math.Min(read, remaining);
                        if (read > remaining) stderrTruncated = true;
                    }
                }
            } catch {
                failed = true;
            }
        }

        public Boolean Wait(Int32 milliseconds) {
            try { return Task.WaitAll(new Task[] { stdoutTask, stderrTask }, milliseconds); }
            catch { failed = true; return false; }
        }

        public String Stdout { get { lock (stdoutLock) { return stdout.ToString(); } } }
        public Boolean StdoutTruncated { get { return stdoutTruncated; } }
        public Boolean StderrTruncated { get { return stderrTruncated; } }
        public Boolean StderrPresent { get { return stderrPresent; } }
        public Boolean Failed { get { return failed; } }
    }
}
'@

if ($null -eq ('Plaerrdeifl.Operator.D1.BoundedGitStreams' -as [type])) {
    Add-Type -TypeDefinition $script:BoundedGitStreamSource -Language CSharp -ErrorAction Stop
}

function New-M000R1Cleanup {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('passed', 'failed', 'skipped')][string]$Status,
        [Parameter(Mandatory = $true)][int]$OwnedProcessCount,
        [Parameter(Mandatory = $true)][int]$TerminatedProcessCount,
        [Parameter(Mandatory = $true)][int]$RemainingOwnedProcessCount
    )
    if ($OwnedProcessCount -lt 0 -or $TerminatedProcessCount -lt 0 -or $RemainingOwnedProcessCount -lt 0) { throw 'Trusted cleanup values are invalid.' }
    if ($TerminatedProcessCount -gt $OwnedProcessCount -or $RemainingOwnedProcessCount -gt $OwnedProcessCount -or ($TerminatedProcessCount + $RemainingOwnedProcessCount) -gt $OwnedProcessCount) { throw 'Trusted cleanup values are inconsistent.' }
    if ($Status -ceq 'passed' -and $RemainingOwnedProcessCount -ne 0) { throw 'Trusted cleanup status is inconsistent.' }
    if ($Status -ceq 'failed' -and $RemainingOwnedProcessCount -eq 0) { throw 'Trusted cleanup status is inconsistent.' }
    if ($Status -ceq 'skipped' -and ($OwnedProcessCount -ne 0 -or $TerminatedProcessCount -ne 0 -or $RemainingOwnedProcessCount -ne 0)) { throw 'Trusted cleanup status is inconsistent.' }
    return [pscustomobject][ordered]@{
        status = $Status
        ownedProcessCount = [int]$OwnedProcessCount
        terminatedProcessCount = [int]$TerminatedProcessCount
        remainingOwnedProcessCount = [int]$RemainingOwnedProcessCount
    }
}

function New-M000R1CheckOutcome {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('passed', 'failed', 'blocked', 'error', 'skipped')][string]$Status,
        [Parameter(Mandatory = $true)][ValidateSet('none', 'invocation', 'internal')][string]$ErrorKind,
        [Parameter(Mandatory = $true)][string]$ReasonCode,
        [Parameter(Mandatory = $true)][ValidateSet('none', 'inline', 'process-manager')][string]$CleanupSource,
        [Parameter(Mandatory = $true)]$Cleanup
    )
    if (-not [regex]::IsMatch($ReasonCode, '^[a-z0-9]+(?:-[a-z0-9]+)*$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Trusted reason code is invalid.' }
    return [pscustomobject][ordered]@{
        schemaVersion = [int]1
        status = $Status
        errorKind = $ErrorKind
        reasonCode = $ReasonCode
        cleanupSource = $CleanupSource
        cleanup = $Cleanup
    }
}

function Test-M000R1SafeLocalApplicationPath {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    try {
        if ([string]::IsNullOrWhiteSpace($LiteralPath) -or -not [IO.Path]::IsPathRooted($LiteralPath)) { return $false }
        if ($LiteralPath.StartsWith('\\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\?\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\.\', [StringComparison]::Ordinal)) { return $false }
        $fullPath = [IO.Path]::GetFullPath($LiteralPath)
        $volumeRoot = [IO.Path]::GetPathRoot($fullPath)
        $drive = New-Object IO.DriveInfo($volumeRoot)
        if ($drive.DriveType -eq [IO.DriveType]::Network) { return $false }
        $relative = $fullPath.Substring($volumeRoot.Length)
        $cursor = $volumeRoot
        foreach ($segment in @($relative -split '[\\/]' | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })) {
            $cursor = [IO.Path]::Combine($cursor, [string]$segment)
            $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
        }
        $final = Get-Item -LiteralPath $fullPath -Force -ErrorAction Stop
        return (-not $final.PSIsContainer -and $final.FullName -is [string])
    }
    catch { return $false }
}

function Get-M000R1GitExecutable {
    foreach ($command in @(Get-Command -Name 'git.exe' -CommandType Application -ErrorAction SilentlyContinue)) {
        if ($null -eq $command -or $command.CommandType -ne [Management.Automation.CommandTypes]::Application) { continue }
        $candidate = [string]$command.Source
        if ([string]::IsNullOrWhiteSpace($candidate)) { $candidate = [string]$command.Path }
        if (-not (Test-M000R1SafeLocalApplicationPath -LiteralPath $candidate)) { continue }
        return [IO.Path]::GetFullPath($candidate)
    }
    return $null
}

function Invoke-M000R1GitQuery {
    param(
        [Parameter(Mandatory = $true)][string]$GitPath,
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)]$PlanItem
    )
    $allowed = Test-OperatorGitArgumentsReadOnly -TargetId ([string]$PlanItem.targetId) -Arguments ([string[]]@($PlanItem.arguments))
    if (-not [bool]$allowed.isAllowed) { throw 'Trusted Git inspection plan is invalid.' }
    $timeoutSeconds = if ([string]$PlanItem.targetId -ceq 'working-tree-status') { 60 } else { 15 }
    $process = $null
    $streams = $null
    $stdoutReader = $null
    $stderrReader = $null
    $started = $false
    $terminated = 0
    $remaining = 0
    $timedOut = $false
    $resourceFailure = $false
    $exitCode = $null
    $stdout = ''
    $stderrPresent = $false
    $stdoutTruncated = $false
    $stderrTruncated = $false
    try {
        $startInfo = New-Object Diagnostics.ProcessStartInfo
        $startInfo.FileName = $GitPath
        $startInfo.Arguments = ConvertTo-OperatorWindowsCommandLine -Arguments ([string[]]@($PlanItem.arguments))
        $startInfo.WorkingDirectory = $RepositoryRoot
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $process = New-Object Diagnostics.Process
        $process.StartInfo = $startInfo
        if (-not $process.Start()) { throw 'Trusted Git process did not start.' }
        $started = $true
        $stdoutReader = $process.StandardOutput
        $stderrReader = $process.StandardError
        $streams = New-Object Plaerrdeifl.Operator.D1.BoundedGitStreams($process, $script:GitStdoutLimit, $script:GitStderrLimit)
        if (-not $process.WaitForExit($timeoutSeconds * 1000)) {
            $timedOut = $true
            try { $process.Kill() }
            catch { $resourceFailure = $true }
            if ($process.WaitForExit($script:GitTerminationWaitMilliseconds)) { $terminated = 1 } else { $remaining = 1 }
        }
        if (-not $timedOut -and $process.HasExited) { $exitCode = [int]$process.ExitCode }
        if ($null -ne $streams) {
            if (-not $streams.Wait($script:GitTerminationWaitMilliseconds)) { $resourceFailure = $true }
            $stdout = [string]$streams.Stdout
            $stderrPresent = [bool]$streams.StderrPresent
            $stdoutTruncated = [bool]$streams.StdoutTruncated
            $stderrTruncated = [bool]$streams.StderrTruncated
            if ([bool]$streams.Failed) { $resourceFailure = $true }
        }
        if ($stdoutTruncated -or $stderrTruncated) { $resourceFailure = $true }
    }
    catch {
        $resourceFailure = $true
        if ($started -and $null -ne $process) {
            try {
                if (-not $process.HasExited) {
                    $process.Kill()
                    if ($process.WaitForExit($script:GitTerminationWaitMilliseconds)) { $terminated = 1 } else { $remaining = 1 }
                }
            }
            catch { $remaining = 1 }
        }
    }
    finally {
        if ($null -ne $stdoutReader) { try { $stdoutReader.Dispose() } catch { $resourceFailure = $true } }
        if ($null -ne $stderrReader) { try { $stderrReader.Dispose() } catch { $resourceFailure = $true } }
        if ($null -ne $process) { try { $process.Dispose() } catch { $resourceFailure = $true } }
    }
    $cleanupStatus = if ($remaining -gt 0) { 'failed' } else { 'passed' }
    $cleanup = New-M000R1Cleanup -Status $cleanupStatus -OwnedProcessCount ([int]([bool]$started)) -TerminatedProcessCount $terminated -RemainingOwnedProcessCount $remaining
    $status = if ($remaining -gt 0) { 'blocked' } elseif ($timedOut) { 'timed-out' } elseif ($resourceFailure) { 'error' } else { 'completed' }
    return [pscustomobject][ordered]@{
        schemaVersion = [int]1
        targetId = [string]$PlanItem.targetId
        status = $status
        exitCode = $exitCode
        stdout = $stdout
        stderrPresent = [bool]$stderrPresent
        cleanup = $cleanup
    }
}

function Merge-M000R1InlineCleanup {
    param([Parameter(Mandatory = $true)][object[]]$CleanupItems)
    $owned = 0L; $terminated = 0L; $remaining = 0L
    foreach ($item in $CleanupItems) {
        $owned += [int64]$item.ownedProcessCount
        $terminated += [int64]$item.terminatedProcessCount
        $remaining += [int64]$item.remainingOwnedProcessCount
        if ($owned -gt [int]::MaxValue -or $terminated -gt [int]::MaxValue -or $remaining -gt [int]::MaxValue) { throw 'Inline cleanup aggregate exceeded its bound.' }
    }
    return New-M000R1Cleanup -Status $(if ($remaining -gt 0) { 'failed' } else { 'passed' }) -OwnedProcessCount ([int]$owned) -TerminatedProcessCount ([int]$terminated) -RemainingOwnedProcessCount ([int]$remaining)
}

function Get-M000R1ConservativeExecutionCleanup {
    param([Parameter(Mandatory = $true)][Collections.Generic.List[object]]$Executions)
    $owned=0L; $terminated=0L; $remaining=0L
    foreach ($execution in $Executions) {
        $cleanup = $execution.cleanup
        $valid = $null -ne $cleanup -and $cleanup.ownedProcessCount -is [int] -and $cleanup.terminatedProcessCount -is [int] -and $cleanup.remainingOwnedProcessCount -is [int] -and [int]$cleanup.ownedProcessCount -ge 0 -and [int]$cleanup.terminatedProcessCount -ge 0 -and [int]$cleanup.remainingOwnedProcessCount -ge 0
        if (-not $valid) { $owned++; $remaining++; continue }
        $itemTerminated=[int64]$cleanup.terminatedProcessCount; $itemRemaining=[int64]$cleanup.remainingOwnedProcessCount
        $itemOwned=[Math]::Max([int64]$cleanup.ownedProcessCount, $itemTerminated + $itemRemaining)
        $owned += $itemOwned; $terminated += $itemTerminated; $remaining += $itemRemaining
    }
    if ($owned -gt [int]::MaxValue -or $terminated -gt [int]::MaxValue -or $remaining -gt [int]::MaxValue) { throw 'Conservative cleanup aggregate exceeded its bound.' }
    return New-M000R1Cleanup -Status $(if ($remaining -gt 0) {'failed'}else{'passed'}) -OwnedProcessCount ([int]$owned) -TerminatedProcessCount ([int]$terminated) -RemainingOwnedProcessCount ([int]$remaining)
}

function Get-M000R1CurrentRepositoryState {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [AllowNull()][string]$ExpectedHeadSha = $null
    )
    $emptyCleanup = New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0
    $executions = New-Object 'Collections.Generic.List[object]' 6
    try {
        $policy = if ([string]::IsNullOrWhiteSpace($ExpectedHeadSha)) { New-OperatorRepositoryPolicy -RepositoryRoot $RepositoryRoot } else { New-OperatorRepositoryPolicy -RepositoryRoot $RepositoryRoot -ExpectedHeadSha $ExpectedHeadSha }
        $plan = @(Get-OperatorGitInspectionPlan)
        $planValidation = Test-OperatorGitInspectionPlan -Plan $plan
        if (-not [bool]$planValidation.isValid -or $plan.Count -ne 6) { return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'error'; errorKind = 'internal'; reasonCode = 'git-plan-invalid'; snapshot = $null; fingerprint = $null; cleanup = $emptyCleanup } }
        $gitPath = Get-M000R1GitExecutable
        if ($null -eq $gitPath) { return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'blocked'; errorKind = 'none'; reasonCode = 'git-unavailable'; snapshot = $null; fingerprint = $null; cleanup = $emptyCleanup } }
        foreach ($planItem in $plan) {
            if ($executions.Count -ge 6) { throw 'Trusted Git execution list exceeded its bound.' }
            $execution = Invoke-M000R1GitQuery -GitPath $gitPath -RepositoryRoot ([string]$policy.repositoryRoot) -PlanItem $planItem
            [void]$executions.Add($execution)
        }
        $cleanup = Merge-M000R1InlineCleanup -CleanupItems @($executions.ToArray() | ForEach-Object { $_.cleanup })
        if ([string]$cleanup.status -cne 'passed') { return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'blocked'; errorKind = 'none'; reasonCode = 'git-cleanup-failed'; snapshot = $null; fingerprint = $null; cleanup = $cleanup } }
        if (@($executions | Where-Object { [string]$_.status -ceq 'timed-out' }).Count -gt 0) { return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'failed'; errorKind = 'none'; reasonCode = 'git-query-timeout'; snapshot = $null; fingerprint = $null; cleanup = $cleanup } }
        if (@($executions | Where-Object { [string]$_.status -ceq 'error' }).Count -gt 0) { return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'error'; errorKind = 'internal'; reasonCode = 'git-query-error'; snapshot = $null; fingerprint = $null; cleanup = $cleanup } }
        $captured = @()
        foreach ($execution in $executions) {
            $targetId = [string]$execution.targetId
            $exitCode = if ($null -eq $execution.exitCode) { -1 } else { [int]$execution.exitCode }
            $allowedExit = if ($targetId -ceq 'upstream') { @(0, 1, 128) -contains $exitCode } else { $exitCode -eq 0 }
            if (-not $allowedExit) { return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'failed'; errorKind = 'none'; reasonCode = 'git-query-failed'; snapshot = $null; fingerprint = $null; cleanup = $cleanup } }
            $captured += [pscustomobject][ordered]@{ targetId = $targetId; exitCode = [int]$exitCode; output = [string]$execution.stdout }
        }
        $snapshot = ConvertTo-OperatorRepositorySnapshot -InspectionResults $captured
        $snapshotValidation = Test-OperatorRepositorySnapshot -Snapshot $snapshot -Policy $policy
        if (-not [bool]$snapshotValidation.isValid) { return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'blocked'; errorKind = 'none'; reasonCode = 'repository-policy-blocked'; snapshot = $snapshot; fingerprint = $null; cleanup = $cleanup } }
        $fingerprint = New-OperatorWorkingTreeFingerprint -RepositorySnapshot $snapshot -RepositoryRoot ([string]$policy.repositoryRoot)
        return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'passed'; errorKind = 'none'; reasonCode = 'repository-inspection-passed'; snapshot = $snapshot; fingerprint = $fingerprint; cleanup = $cleanup }
    }
    catch {
        $cleanup = $emptyCleanup
        if ($executions.Count -gt 0) {
            try { $cleanup = Merge-M000R1InlineCleanup -CleanupItems @($executions.ToArray() | ForEach-Object { $_.cleanup }) }
            catch { $cleanup = Get-M000R1ConservativeExecutionCleanup -Executions $executions }
        }
        if ([string]$cleanup.status -cne 'passed' -or [int]$cleanup.remainingOwnedProcessCount -gt 0) { return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'blocked'; errorKind = 'none'; reasonCode = 'git-cleanup-failed'; snapshot = $null; fingerprint = $null; cleanup = $cleanup } }
        return [pscustomobject][ordered]@{ schemaVersion = 1; status = 'error'; errorKind = 'internal'; reasonCode = 'repository-inspection-error'; snapshot = $null; fingerprint = $null; cleanup = $cleanup }
    }
}

function Get-M000R1SafeBoundedFilePath {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    try {
        if (-not [IO.Path]::IsPathRooted($LiteralPath) -or $LiteralPath.StartsWith('\\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\?\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\.\', [StringComparison]::Ordinal)) { return $null }
        $fullPath = [IO.Path]::GetFullPath($LiteralPath)
        $volumeRoot = [IO.Path]::GetPathRoot($fullPath)
        if ((New-Object IO.DriveInfo($volumeRoot)).DriveType -eq [IO.DriveType]::Network) { return $null }
        $cursor = $volumeRoot
        foreach ($segment in @($fullPath.Substring($volumeRoot.Length) -split '[\\/]' | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })) {
            $cursor = [IO.Path]::Combine($cursor, [string]$segment)
            $candidate = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
            if (($candidate.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $null }
        }
        $item = Get-Item -LiteralPath $fullPath -Force -ErrorAction Stop
        if ($item.PSIsContainer) { return $null }
        return [IO.Path]::GetFullPath([string]$item.FullName)
    }
    catch { return $null }
}

function Read-M000R1BoundedUtf8Text {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][int]$MaximumBytes
    )
    if ($MaximumBytes -lt 0 -or $MaximumBytes -ge [int]::MaxValue) { throw 'Bounded log input is invalid.' }
    $safePath = Get-M000R1SafeBoundedFilePath -LiteralPath $LiteralPath
    if ($null -eq $safePath) { throw 'Bounded log input is invalid.' }
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
        if ($total -gt $MaximumBytes) { throw 'Bounded log input exceeded its limit.' }
        $encoding = New-Object Text.UTF8Encoding($false, $true)
        return $encoding.GetString($bytes, 0, $total)
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Get-M000R1ProcessLogs {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$ProcessResult
    )
    $directoryName = ('{0:D4}-{1}' -f [int]$ProcessResult.sequence, [string]$ProcessResult.targetId)
    $processDirectory = [IO.Path]::Combine([string]$Context.runContext.RunDirectory, 'processes', $directoryName)
    $maximumBytes = ($script:RunLogCharacterLimit * 4) + 4096
    return [pscustomobject][ordered]@{
        stdout = Read-M000R1BoundedUtf8Text -LiteralPath ([IO.Path]::Combine($processDirectory, 'stdout.log')) -MaximumBytes $maximumBytes
        stderr = Read-M000R1BoundedUtf8Text -LiteralPath ([IO.Path]::Combine($processDirectory, 'stderr.log')) -MaximumBytes $maximumBytes
    }
}

function Invoke-M000R1SelfTestCheck {
    param([Parameter(Mandatory = $true)]$Context, [Parameter(Mandatory = $true)]$ManifestCheck)
    $zero = New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0
    $result = Invoke-OperatorProcessTarget -RunContext $Context.runContext -RepositoryRoot $Context.repositoryRoot -Stage $Context.stage -TargetId ([string]$ManifestCheck.targetId) -TimeoutProfile ([string]$ManifestCheck.timeoutProfile)
    if (-not (Test-OperatorProcessReportContract -ProcessReport $result)) { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'selftest-process-contract-invalid' -CleanupSource process-manager -Cleanup $zero }
    if ([string]$result.cleanup.status -cne 'passed' -or [int]$result.cleanup.remainingOwnedProcessCount -ne 0) { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'selftest-cleanup-failed' -CleanupSource process-manager -Cleanup $zero }
    $passed = $false
    switch -CaseSensitive ([string]$ManifestCheck.checkId) {
        'selftest.exit-success' { $passed = [string]$result.status -ceq 'passed' -and [int]$result.exitCode -eq 0 -and -not [bool]$result.timedOut }
        'selftest.stderr-success' {
            $logs = Get-M000R1ProcessLogs -Context $Context -ProcessResult $result
            $passed = [string]$result.status -ceq 'passed' -and [int]$result.exitCode -eq 0 -and $logs.stdout.Contains('fixture stdout-only line') -and -not $logs.stdout.Contains('fixture stderr-only line') -and $logs.stderr.Contains('fixture stderr-only line') -and -not $logs.stderr.Contains('fixture stdout-only line') -and (Test-OperatorLogTextSafe -Text $logs.stderr)
        }
        'selftest.exit-failure' { $passed = [string]$result.status -ceq 'failed' -and [int]$result.exitCode -eq 7 -and -not [bool]$result.timedOut }
        'selftest.health-ready' { $passed = [string]$result.status -ceq 'passed' -and [string]$result.healthStatus -ceq 'passed' }
        'selftest.health-failure' { $passed = [string]$result.status -ceq 'failed' -and [string]$result.healthStatus -ceq 'failed' }
        'selftest.timeout' { $passed = [string]$result.status -ceq 'failed' -and [bool]$result.timedOut }
        'selftest.child-tree' { $passed = [string]$result.status -ceq 'failed' -and [bool]$result.timedOut -and [int]$result.cleanup.ownedProcessCount -ge 3 }
        'selftest.secret-output' {
            $logs = Get-M000R1ProcessLogs -Context $Context -ProcessResult $result
            $dummyToken = ('gh' + 'p_' + ('A' * 24))
            $reservedMarker = ('V4_M000_R1_' + 'SELFTEST_OK')
            $passed = [string]$result.status -ceq 'passed' -and (Test-OperatorLogTextSafe -Text $logs.stdout) -and (Test-OperatorLogTextSafe -Text $logs.stderr) -and -not $logs.stdout.Contains($dummyToken) -and -not $logs.stderr.Contains($dummyToken) -and -not $logs.stdout.Contains($reservedMarker) -and -not $logs.stderr.Contains($reservedMarker)
        }
        'selftest.large-output' {
            $logs = Get-M000R1ProcessLogs -Context $Context -ProcessResult $result
            $marker = '[TRUNCATED:stream-limit]'
            $passed = [string]$result.status -ceq 'passed' -and [bool]$result.stdoutTruncated -and $logs.stdout.Length -le $script:RunLogCharacterLimit -and $logs.stdout.Contains($marker)
        }
        default { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'selftest-binding-invalid' -CleanupSource process-manager -Cleanup $zero }
    }
    if ($passed) { return New-M000R1CheckOutcome -Status passed -ErrorKind none -ReasonCode 'selftest-expectation-passed' -CleanupSource process-manager -Cleanup $zero }
    return New-M000R1CheckOutcome -Status failed -ErrorKind none -ReasonCode 'selftest-expectation-failed' -CleanupSource process-manager -Cleanup $zero
}

function Invoke-M000R1RepositoryCheck {
    param([Parameter(Mandatory = $true)]$Context)
    $state = $Context.repositoryState
    $zero = New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0
    if ([string]$state.status -cne 'passed') { return New-M000R1CheckOutcome -Status ([string]$state.status) -ErrorKind ([string]$state.errorKind) -ReasonCode ([string]$state.reasonCode) -CleanupSource none -Cleanup $zero }
    Write-OperatorRepositorySnapshotReport -RunDirectory ([string]$Context.runContext.RunDirectory) -RepositorySnapshot $state.snapshot
    return New-M000R1CheckOutcome -Status passed -ErrorKind none -ReasonCode 'repository-policy-passed' -CleanupSource none -Cleanup $zero
}

function Invoke-M000R1EnvironmentCheck {
    param([Parameter(Mandatory = $true)]$Context)
    try {
        $snapshot = Get-OperatorEnvironmentSnapshot -RepositoryRoot ([string]$Context.repositoryRoot)
        $validation = Test-OperatorEnvironmentSnapshot -Snapshot $snapshot
        if (-not [bool]$validation.isValid) { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'environment-contract-invalid' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
        Write-OperatorEnvironmentReport -RunDirectory ([string]$Context.runContext.RunDirectory) -EnvironmentSnapshot $snapshot
        $blocked = @($snapshot.tools | Where-Object { [bool]$_.required -and (-not [bool]$_.available -or [string]$_.versionStatus -ceq 'unsatisfied' -or ([string]$_.versionRequirement -and [string]$_.versionStatus -cne 'satisfied')) }).Count -gt 0
        return New-M000R1CheckOutcome -Status $(if ($blocked) { 'blocked' } else { 'passed' }) -ErrorKind none -ReasonCode $(if ($blocked) { 'environment-required-blocked' } else { 'environment-required-passed' }) -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0)
    }
    catch { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'environment-check-error' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
}

function Invoke-M000R1LocalIsolationCheck {
    param([Parameter(Mandatory = $true)]$Context)
    try {
        $policy = New-OperatorPathPolicy -RepositoryRoot ([string]$Context.repositoryRoot)
        $environment = Test-OperatorLocalEnvironmentVariables -Variables ([Environment]::GetEnvironmentVariables())
        $linkState = Test-OperatorSupabaseLinkState -Policy $policy
        $blocked = [string]$environment.status -cne 'clear' -or [string]$linkState.status -cne 'clear'
        return New-M000R1CheckOutcome -Status $(if ($blocked) { 'blocked' } else { 'passed' }) -ErrorKind none -ReasonCode $(if ($blocked) { 'local-isolation-blocked' } else { 'local-isolation-passed' }) -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0)
    }
    catch { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'local-isolation-error' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
}

function Get-M000R1ChangedPaths {
    param([Parameter(Mandatory = $true)]$Context)
    if ($null -eq $Context.repositoryState -or $null -eq $Context.repositoryState.snapshot) { throw 'Repository state is unavailable.' }
    return @($Context.repositoryState.snapshot.workingTreeState.entries)
}

function Invoke-M000R1PathScopeCheck {
    param([Parameter(Mandatory = $true)]$Context)
    try {
        $policy = New-OperatorPathPolicy -RepositoryRoot ([string]$Context.repositoryRoot)
        foreach ($entry in @(Get-M000R1ChangedPaths -Context $Context)) {
            if ($null -ne $entry.originalPath -or ([string]$entry.status).IndexOfAny(@([char]'D', [char]'R', [char]'C')) -ge 0) { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'path-scope-change-kind-blocked' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
            $resolved = Resolve-OperatorRepositoryRelativePath -Policy $policy -RelativePath ([string]$entry.path)
            if ($script:AllowedDPaths -cnotcontains [string]$resolved.relativePath) { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'path-scope-extra-path-blocked' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
        }
        return New-M000R1CheckOutcome -Status passed -ErrorKind none -ReasonCode 'path-scope-passed' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0)
    }
    catch { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'path-scope-unsafe' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
}

function Invoke-M000R1SecretHintsCheck {
    param([Parameter(Mandatory = $true)]$Context)
    try {
        $policy = New-OperatorPathPolicy -RepositoryRoot ([string]$Context.repositoryRoot)
        $paths = @()
        foreach ($entry in @(Get-M000R1ChangedPaths -Context $Context)) { if ($null -eq $entry.originalPath -and ([string]$entry.status).IndexOf('D') -lt 0) { $paths += [string]$entry.path } }
        $result = Test-OperatorSecretHints -Policy $policy -RelativePaths ([string[]]$paths)
        $blocked = [string]$result.status -cne 'clear'
        return New-M000R1CheckOutcome -Status $(if ($blocked) { 'blocked' } else { 'passed' }) -ErrorKind none -ReasonCode $(if ($blocked) { 'secret-hints-blocked' } else { 'secret-hints-passed' }) -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0)
    }
    catch { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'secret-hints-error' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
}

function Invoke-M000R1LocalProcessCheck {
    param([Parameter(Mandatory = $true)]$Context, [Parameter(Mandatory = $true)]$ManifestCheck)
    $zero = New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0
    $result = Invoke-OperatorProcessTarget -RunContext $Context.runContext -RepositoryRoot $Context.repositoryRoot -Stage $Context.stage -TargetId ([string]$ManifestCheck.targetId) -TimeoutProfile ([string]$ManifestCheck.timeoutProfile)
    if (-not (Test-OperatorProcessReportContract -ProcessReport $result)) { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'local-process-contract-invalid' -CleanupSource process-manager -Cleanup $zero }
    if ([string]$result.cleanup.status -cne 'passed' -or [int]$result.cleanup.remainingOwnedProcessCount -ne 0) { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'local-process-cleanup-failed' -CleanupSource process-manager -Cleanup $zero }
    switch -CaseSensitive ([string]$result.status) {
        'passed' { return New-M000R1CheckOutcome -Status passed -ErrorKind none -ReasonCode 'local-process-passed' -CleanupSource process-manager -Cleanup $zero }
        'failed' { return New-M000R1CheckOutcome -Status failed -ErrorKind none -ReasonCode 'local-process-failed' -CleanupSource process-manager -Cleanup $zero }
        'blocked' { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'local-process-blocked' -CleanupSource process-manager -Cleanup $zero }
        default { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'local-process-error' -CleanupSource process-manager -Cleanup $zero }
    }
}

function Invoke-M000R1FingerprintCaptureCheck {
    param([Parameter(Mandatory = $true)]$Context)
    $freshState = Get-M000R1CurrentRepositoryState -RepositoryRoot ([string]$Context.repositoryRoot) -ExpectedHeadSha ([string]$Context.repositoryState.snapshot.headSha)
    $freshCleanup = $freshState.cleanup
    if ([string]$freshCleanup.status -cne 'passed' -or [int]$freshCleanup.remainingOwnedProcessCount -gt 0) { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'fingerprint-cleanup-failed' -CleanupSource inline -Cleanup $freshCleanup }
    if ([string]$freshState.status -cne 'passed') { return New-M000R1CheckOutcome -Status ([string]$freshState.status) -ErrorKind ([string]$freshState.errorKind) -ReasonCode ([string]$freshState.reasonCode) -CleanupSource inline -Cleanup $freshState.cleanup }
    try {
        $comparison = Compare-OperatorWorkingTreeFingerprint -ReferenceFingerprint $Context.repositoryState.fingerprint -CurrentFingerprint $freshState.fingerprint
        if (-not [bool]$comparison.isMatch) { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'fingerprint-worktree-changed' -CleanupSource inline -Cleanup $freshCleanup }
        Write-OperatorRepositorySnapshotReport -RunDirectory ([string]$Context.runContext.RunDirectory) -RepositorySnapshot $freshState.snapshot
        Write-OperatorWorkingTreeFingerprintReport -RunDirectory ([string]$Context.runContext.RunDirectory) -WorkingTreeFingerprint $freshState.fingerprint
        $Context.finalRepositoryState = $freshState
        return New-M000R1CheckOutcome -Status passed -ErrorKind none -ReasonCode 'fingerprint-capture-passed' -CleanupSource inline -Cleanup $freshCleanup
    }
    catch { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'fingerprint-capture-error' -CleanupSource inline -Cleanup $freshCleanup }
}

function Invoke-M000R1FingerprintCompareCheck {
    param([Parameter(Mandatory = $true)]$Context)
    if ($null -eq $Context.referenceRun -or [string]$Context.referenceRun.status -cne 'passed') { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'fingerprint-reference-blocked' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
    $freshState = Get-M000R1CurrentRepositoryState -RepositoryRoot ([string]$Context.repositoryRoot) -ExpectedHeadSha ([string]$Context.repositoryState.snapshot.headSha)
    $freshCleanup = $freshState.cleanup
    if ([string]$freshCleanup.status -cne 'passed' -or [int]$freshCleanup.remainingOwnedProcessCount -gt 0) { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'fingerprint-cleanup-failed' -CleanupSource inline -Cleanup $freshCleanup }
    if ([string]$freshState.status -cne 'passed') { return New-M000R1CheckOutcome -Status ([string]$freshState.status) -ErrorKind ([string]$freshState.errorKind) -ReasonCode ([string]$freshState.reasonCode) -CleanupSource inline -Cleanup $freshState.cleanup }
    try {
        $baselineComparison = Compare-OperatorWorkingTreeFingerprint -ReferenceFingerprint $Context.repositoryState.fingerprint -CurrentFingerprint $freshState.fingerprint
        $referenceComparison = Compare-OperatorWorkingTreeFingerprint -ReferenceFingerprint $Context.referenceRun.fingerprint -CurrentFingerprint $freshState.fingerprint
        if (-not [bool]$baselineComparison.isMatch -or -not [bool]$referenceComparison.isMatch) { return New-M000R1CheckOutcome -Status blocked -ErrorKind none -ReasonCode 'fingerprint-worktree-changed' -CleanupSource inline -Cleanup $freshCleanup }
        Write-OperatorRepositorySnapshotReport -RunDirectory ([string]$Context.runContext.RunDirectory) -RepositorySnapshot $freshState.snapshot
        Write-OperatorWorkingTreeFingerprintReport -RunDirectory ([string]$Context.runContext.RunDirectory) -WorkingTreeFingerprint $freshState.fingerprint
        $Context.finalRepositoryState = $freshState
        return New-M000R1CheckOutcome -Status passed -ErrorKind none -ReasonCode 'fingerprint-compare-passed' -CleanupSource inline -Cleanup $freshCleanup
    }
    catch { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'fingerprint-compare-error' -CleanupSource inline -Cleanup $freshCleanup }
}

function Invoke-M000R1RegisteredCheck {
    param([Parameter(Mandatory = $true)]$Context, [Parameter(Mandatory = $true)]$ManifestCheck)
    switch -CaseSensitive ([string]$ManifestCheck.checkId) {
        { $_.StartsWith('selftest.', [StringComparison]::Ordinal) } { return Invoke-M000R1SelfTestCheck -Context $Context -ManifestCheck $ManifestCheck }
        'repository.policy' { return Invoke-M000R1RepositoryCheck -Context $Context }
        'environment.required' { return Invoke-M000R1EnvironmentCheck -Context $Context }
        'local.isolation' { return Invoke-M000R1LocalIsolationCheck -Context $Context }
        'path.scope' { return Invoke-M000R1PathScopeCheck -Context $Context }
        'secret.hints' { return Invoke-M000R1SecretHintsCheck -Context $Context }
        { $_ -in @('local.test', 'local.frontend', 'local.static', 'local.build') } { return Invoke-M000R1LocalProcessCheck -Context $Context -ManifestCheck $ManifestCheck }
        'fingerprint.capture' { return Invoke-M000R1FingerprintCaptureCheck -Context $Context }
        'fingerprint.compare' { return Invoke-M000R1FingerprintCompareCheck -Context $Context }
        default { return New-M000R1CheckOutcome -Status error -ErrorKind internal -ReasonCode 'check-binding-invalid' -CleanupSource none -Cleanup (New-M000R1Cleanup -Status passed -OwnedProcessCount 0 -TerminatedProcessCount 0 -RemainingOwnedProcessCount 0) }
    }
}

$script:TrustedHandler = { param($Context, $ManifestCheck) Invoke-M000R1RegisteredCheck -Context $Context -ManifestCheck $ManifestCheck }
$script:CheckDefinitions = @(
    [pscustomobject][ordered]@{ checkId='selftest.exit-success'; targetId='fixture.exit-success'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('short'); expectedSemantics='passed-exit-zero'; required=$true },
    [pscustomobject][ordered]@{ checkId='selftest.stderr-success'; targetId='fixture.stderr-success'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('short'); expectedSemantics='passed-separated-streams'; required=$true },
    [pscustomobject][ordered]@{ checkId='selftest.exit-failure'; targetId='fixture.exit-failure'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('short'); expectedSemantics='expected-failed-exit'; required=$true },
    [pscustomobject][ordered]@{ checkId='selftest.health-ready'; targetId='fixture.health-ready'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('short'); expectedSemantics='passed-health'; required=$true },
    [pscustomobject][ordered]@{ checkId='selftest.health-failure'; targetId='fixture.health-failure'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('short'); expectedSemantics='expected-health-failure'; required=$true },
    [pscustomobject][ordered]@{ checkId='selftest.timeout'; targetId='fixture.timeout'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('short'); expectedSemantics='expected-timeout'; required=$true },
    [pscustomobject][ordered]@{ checkId='selftest.child-tree'; targetId='fixture.child-tree'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('short'); expectedSemantics='expected-tree-timeout'; required=$true },
    [pscustomobject][ordered]@{ checkId='selftest.secret-output'; targetId='fixture.secret-output'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('short'); expectedSemantics='passed-redacted'; required=$true },
    [pscustomobject][ordered]@{ checkId='selftest.large-output'; targetId='fixture.large-output'; allowedStages=@('SelfTest'); allowedTimeoutProfiles=@('standard'); expectedSemantics='passed-truncated'; required=$true },
    [pscustomobject][ordered]@{ checkId='repository.policy'; targetId='operator.repository'; allowedStages=@('Preflight','LocalVerify','LocalFreeze'); allowedTimeoutProfiles=@('standard'); expectedSemantics='repository-policy'; required=$true },
    [pscustomobject][ordered]@{ checkId='environment.required'; targetId='operator.environment'; allowedStages=@('Preflight','LocalVerify','LocalFreeze'); allowedTimeoutProfiles=@('short'); expectedSemantics='required-environment'; required=$true },
    [pscustomobject][ordered]@{ checkId='local.isolation'; targetId='operator.local-mode'; allowedStages=@('Preflight','LocalVerify','LocalFreeze'); allowedTimeoutProfiles=@('short'); expectedSemantics='local-isolation'; required=$true },
    [pscustomobject][ordered]@{ checkId='path.scope'; targetId='operator.changed-paths'; allowedStages=@('Preflight','LocalVerify','LocalFreeze'); allowedTimeoutProfiles=@('short'); expectedSemantics='exact-d-paths'; required=$true },
    [pscustomobject][ordered]@{ checkId='secret.hints'; targetId='operator.secret-hints'; allowedStages=@('Preflight','LocalVerify','LocalFreeze'); allowedTimeoutProfiles=@('short'); expectedSemantics='no-secret-hints'; required=$true },
    [pscustomobject][ordered]@{ checkId='local.test'; targetId='npm.test'; allowedStages=@('LocalVerify','LocalFreeze'); allowedTimeoutProfiles=@('standard'); expectedSemantics='process-passed'; required=$true },
    [pscustomobject][ordered]@{ checkId='local.frontend'; targetId='npm.check-frontend'; allowedStages=@('LocalVerify','LocalFreeze'); allowedTimeoutProfiles=@('standard'); expectedSemantics='process-passed'; required=$true },
    [pscustomobject][ordered]@{ checkId='local.static'; targetId='npm.check-static'; allowedStages=@('LocalVerify','LocalFreeze'); allowedTimeoutProfiles=@('standard'); expectedSemantics='process-passed'; required=$true },
    [pscustomobject][ordered]@{ checkId='local.build'; targetId='npm.build'; allowedStages=@('LocalFreeze'); allowedTimeoutProfiles=@('long'); expectedSemantics='process-passed'; required=$true },
    [pscustomobject][ordered]@{ checkId='fingerprint.capture'; targetId='operator.fingerprint-capture'; allowedStages=@('LocalVerify'); allowedTimeoutProfiles=@('standard'); expectedSemantics='fingerprint-captured'; required=$true },
    [pscustomobject][ordered]@{ checkId='fingerprint.compare'; targetId='operator.fingerprint-compare'; allowedStages=@('LocalFreeze'); allowedTimeoutProfiles=@('standard'); expectedSemantics='fingerprint-matched'; required=$true }
)

function Get-M000R1CheckDefinition {
    param([Parameter(Mandatory = $true)][string]$CheckId, [Parameter(Mandatory = $true)][string]$TargetId)
    $matches = @($script:CheckDefinitions | Where-Object { [string]$_.checkId -ceq $CheckId -and [string]$_.targetId -ceq $TargetId })
    if ($matches.Count -eq 0) { return $null }
    if ($matches.Count -ne 1) { throw 'Trusted M000 check matrix is invalid.' }
    $item = $matches[0]
    return [pscustomobject][ordered]@{ checkId=[string]$item.checkId; targetId=[string]$item.targetId; allowedStages=@($item.allowedStages); allowedTimeoutProfiles=@($item.allowedTimeoutProfiles); expectedSemantics=[string]$item.expectedSemantics; required=[bool]$item.required }
}

function New-M000R1RegistrationBindingResult {
    param([Parameter(Mandatory = $true)][bool]$IsValid, [Parameter(Mandatory = $true)][string]$ReasonCode)
    return [pscustomobject][ordered]@{ schemaVersion=[int]1; isValid=$IsValid; reasonCode=$ReasonCode }
}

function Test-M000R1CheckRegistrationBinding {
    param(
        [Parameter(Mandatory = $true)][string]$CheckId,
        [Parameter(Mandatory = $true)][string]$TargetId,
        [AllowNull()]$Registration
    )
    try {
        if ($script:CheckDefinitions.Count -ne 20) { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-definition-matrix-invalid' }
        $matches = @($script:CheckDefinitions | Where-Object { [string]$_.checkId -ceq $CheckId -and [string]$_.targetId -ceq $TargetId })
        if ($matches.Count -ne 1) { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-definition-invalid' }
        $definition = $matches[0]
        if ($null -eq $Registration -or $Registration -isnot [pscustomobject]) { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-registration-missing' }
        $properties = @($Registration.PSObject.Properties.Name)
        if ($properties.Count -ne 4 -or $properties -cnotcontains 'CheckId' -or $properties -cnotcontains 'TargetId' -or $properties -cnotcontains 'AllowedStages' -or $properties -cnotcontains 'Handler') { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-registration-contract-invalid' }
        if ($Registration.CheckId -isnot [string] -or [string]$Registration.CheckId -cne [string]$definition.checkId -or $Registration.TargetId -isnot [string] -or [string]$Registration.TargetId -cne [string]$definition.targetId) { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-registration-identity-invalid' }
        if (@($Registration.AllowedStages).Count -ne @($definition.allowedStages).Count) { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-allowed-stages-invalid' }
        for ($index = 0; $index -lt @($definition.allowedStages).Count; $index++) {
            if ($Registration.AllowedStages[$index] -isnot [string] -or [string]$Registration.AllowedStages[$index] -cne [string]$definition.allowedStages[$index]) { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-allowed-stages-invalid' }
        }
        if ($Registration.Handler -isnot [scriptblock] -or -not [object]::ReferenceEquals($Registration.Handler, $script:TrustedHandler)) { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-handler-invalid' }
        return New-M000R1RegistrationBindingResult -IsValid $true -ReasonCode 'registry-registration-valid'
    }
    catch { return New-M000R1RegistrationBindingResult -IsValid $false -ReasonCode 'registry-registration-contract-invalid' }
}

function Register-M000R1Checks {
    if ($script:CheckDefinitions.Count -ne 20) { throw 'Trusted M000 check matrix is invalid.' }
    foreach ($definition in $script:CheckDefinitions) {
        $existing = Get-OperatorCheckRegistration -CheckId ([string]$definition.checkId) -TargetId ([string]$definition.targetId)
        if ($null -eq $existing) {
            [void](Register-OperatorCheck -CheckId ([string]$definition.checkId) -TargetId ([string]$definition.targetId) -AllowedStages ([string[]]@($definition.allowedStages)) -Handler $script:TrustedHandler)
            continue
        }
        $binding = Test-M000R1CheckRegistrationBinding -CheckId ([string]$definition.checkId) -TargetId ([string]$definition.targetId) -Registration $existing
        if (-not [bool]$binding.isValid) { throw 'Existing M000 check registration differs from the trusted matrix.' }
    }
    $registry = Get-OperatorCheckRegistrySnapshot
    if ($registry.Count -ne 20) { throw 'Operator check registry contains an unexpected entry.' }
    foreach ($entry in $registry) {
        $binding = Test-M000R1CheckRegistrationBinding -CheckId ([string]$entry.CheckId) -TargetId ([string]$entry.TargetId) -Registration $entry
        if (-not [bool]$binding.isValid) { throw 'Operator check registry contains an unexpected entry.' }
    }
    $summary = @()
    foreach ($definition in $script:CheckDefinitions) { $summary += Get-M000R1CheckDefinition -CheckId ([string]$definition.checkId) -TargetId ([string]$definition.targetId) }
    return [pscustomobject][ordered]@{ schemaVersion=[int]1; count=[int]$summary.Count; checks=@($summary) }
}

Export-ModuleMember -Function @(
    'Register-M000R1Checks',
    'Get-M000R1CheckDefinition',
    'Test-M000R1CheckRegistrationBinding',
    'Get-M000R1CurrentRepositoryState'
)
