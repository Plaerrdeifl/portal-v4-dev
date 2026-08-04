#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TargetId,
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$RunDirectory,
    [Parameter(Mandatory = $true)][string]$ProcessDirectory,
    [Parameter(Mandatory = $true)][string]$GateName,
    [Parameter(Mandatory = $true)][string]$ControlFilePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$gate = $null
$target = $null
$completionFull = $null
$workerExitCode = 100

function Get-ProcessWorkerSafeExistingDirectory {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    if (-not [IO.Path]::IsPathRooted($LiteralPath) -or $LiteralPath.StartsWith('\\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\?\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\.\', [StringComparison]::Ordinal)) { throw 'unsafe' }
    $fullPath = [IO.Path]::GetFullPath($LiteralPath).TrimEnd('\', '/')
    $volumeRoot = [IO.Path]::GetPathRoot($fullPath)
    $drive = New-Object -TypeName IO.DriveInfo -ArgumentList $volumeRoot
    if ($drive.DriveType -eq [IO.DriveType]::Network) { throw 'network' }
    $relative = $fullPath.Substring($volumeRoot.Length)
    $cursor = $volumeRoot
    foreach ($segment in @($relative -split '[\\/]' | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })) {
        $cursor = [IO.Path]::Combine($cursor, [string]$segment)
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse' }
        $cursor = [IO.Path]::GetFullPath([string]$item.FullName).TrimEnd('\', '/')
    }
    return $cursor
}

function Write-ProcessWorkerRecord {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)]$Record
    )
    $directory = [IO.Path]::GetDirectoryName($LiteralPath)
    $temporaryPath = [IO.Path]::Combine($directory, ('.worker-record.' + [Guid]::NewGuid().ToString('N') + '.tmp'))
    try {
        $json = ConvertTo-Json -InputObject $Record -Depth 4 -Compress
        [IO.File]::WriteAllText($temporaryPath, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
        if ([IO.File]::Exists($LiteralPath) -or [IO.Directory]::Exists($LiteralPath)) { throw 'Worker record already exists.' }
        [IO.File]::Move($temporaryPath, $LiteralPath)
    }
    finally {
        if ([IO.File]::Exists($temporaryPath)) { [IO.File]::Delete($temporaryPath) }
    }
}

try {
    if ($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { $workerExitCode = 91; throw 'runtime' }
    if (-not [regex]::IsMatch($TargetId, '^[a-z0-9]+(?:[.-][a-z0-9]+)*$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $workerExitCode = 92; throw 'target' }
    if (-not [regex]::IsMatch($GateName, '^Local\\Plaerrdeifl-M000-\d{8}T\d{9}Z-[a-f0-9]{12}-[a-f0-9]{32}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $workerExitCode = 93; throw 'gate' }
    foreach ($path in @($RepositoryRoot, $RunDirectory, $ProcessDirectory, $ControlFilePath)) {
        if (-not [IO.Path]::IsPathRooted([string]$path) -or ([string]$path).StartsWith('\\', [StringComparison]::Ordinal)) { $workerExitCode = 94; throw 'path' }
    }
    $runFull = [IO.Path]::GetFullPath($RunDirectory).TrimEnd('\', '/')
    $processFull = [IO.Path]::GetFullPath($ProcessDirectory).TrimEnd('\', '/')
    $controlFull = [IO.Path]::GetFullPath($ControlFilePath)
    $completionFull = [IO.Path]::Combine($processFull, 'completion.json')
    $runId = [string][IO.Path]::GetFileName($runFull)
    if (-not [regex]::IsMatch($runId, '^\d{8}T\d{9}Z-[a-f0-9]{12}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $workerExitCode = 95; throw 'run' }
    $localAppData = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
    if ($localAppData -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$localAppData)) { $workerExitCode = 95; throw 'root' }
    $localRoot = Get-ProcessWorkerSafeExistingDirectory -LiteralPath ([string]$localAppData)
    $standardRunRoot = Get-ProcessWorkerSafeExistingDirectory -LiteralPath ([IO.Path]::Combine($localRoot, 'Plaerrdeifl', 'PortalOperator', 'runs'))
    $validatedRun = Get-ProcessWorkerSafeExistingDirectory -LiteralPath $runFull
    $validatedProcesses = Get-ProcessWorkerSafeExistingDirectory -LiteralPath ([IO.Path]::GetDirectoryName($processFull))
    $validatedProcess = Get-ProcessWorkerSafeExistingDirectory -LiteralPath $processFull
    if (-not [string]::Equals([IO.Path]::GetDirectoryName($validatedRun), $standardRunRoot, [StringComparison]::OrdinalIgnoreCase)) { $workerExitCode = 95; throw 'run-root' }
    if ([string][IO.Path]::GetFileName($validatedRun) -cne $runId) { $workerExitCode = 95; throw 'run-id' }
    if (-not [string]::Equals($validatedProcesses, [IO.Path]::Combine($validatedRun, 'processes'), [StringComparison]::OrdinalIgnoreCase)) { $workerExitCode = 95; throw 'processes' }
    if (-not [string]::Equals($validatedProcess, $processFull, [StringComparison]::OrdinalIgnoreCase)) { $workerExitCode = 95; throw 'process' }
    if (-not $GateName.StartsWith(('Local\Plaerrdeifl-M000-' + $runId + '-'), [StringComparison]::Ordinal)) { $workerExitCode = 95; throw 'gate-run' }
    if (-not [regex]::IsMatch([string][IO.Path]::GetFileName($processFull), '^\d{4}-[a-z0-9]+(?:[.-][a-z0-9]+)*$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $workerExitCode = 95; throw 'process-name' }
    if ([string][IO.Path]::GetFileName($processFull).Substring(5) -cne $TargetId) { $workerExitCode = 95; throw 'process-target' }
    if ([string][IO.Path]::GetDirectoryName($controlFull) -cne $processFull -or [string][IO.Path]::GetFileName($controlFull) -cne 'control.json') { $workerExitCode = 95; throw 'control' }
    if ([IO.File]::Exists($controlFull) -or [IO.File]::Exists($completionFull)) { $workerExitCode = 96; throw 'record' }

    $processModulePath = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, 'modules', 'Operator.Process.psm1'))
    Import-Module -Name $processModulePath -ErrorAction Stop
    $registration = Get-OperatorProcessTargetRegistration -TargetId $TargetId
    if ($null -eq $registration) { $workerExitCode = 97; throw 'registration' }
    $launch = Resolve-OperatorProcessLaunchDefinition -RepositoryRoot $RepositoryRoot -TargetId $TargetId

    $gate = [Threading.EventWaitHandle]::OpenExisting($GateName)
    if (-not $gate.WaitOne([TimeSpan]::FromSeconds(30))) { $workerExitCode = 98; throw 'gate-timeout' }

    $targetArguments = ConvertTo-OperatorWindowsCommandLine -Arguments ([string[]]$launch.arguments)
    $target = [Plaerrdeifl.Operator.RelayProcess]::Start([string]$launch.executablePath, $targetArguments, [string]$launch.workingDirectory)

    $record = [pscustomobject][ordered]@{
        schemaVersion = [int]1
        targetId = $TargetId
        workerPid = [int]$PID
        targetPid = [int]$target.Id
        startedAtUtc = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
    }
    Write-ProcessWorkerRecord -LiteralPath $controlFull -Record $record

    while (-not $target.WaitForExit(1000)) { }
    if (-not $target.WaitForStreams(5000) -or $target.StreamFailed) { $workerExitCode = 99; throw 'stream' }
    $targetExitCode = [int]$target.ExitCode
    $completion = [pscustomobject][ordered]@{
        schemaVersion = [int]1
        targetId = $TargetId
        workerPid = [int]$PID
        targetPid = [int]$target.Id
        targetExitCode = $targetExitCode
        completedAtUtc = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
    }
    Write-ProcessWorkerRecord -LiteralPath $completionFull -Record $completion
    $workerExitCode = 0
}
catch {
    if ($workerExitCode -eq 0) { $workerExitCode = 100 }
}
finally {
    $resourceFailure = $false
    if ($null -ne $target) { try { $target.Dispose() } catch { $resourceFailure = $true } }
    if ($null -ne $gate) { try { $gate.Dispose() } catch { $resourceFailure = $true } }
    if ($resourceFailure) {
        $workerExitCode = 100
        if ($null -ne $completionFull -and [IO.File]::Exists($completionFull)) {
            try { [IO.File]::Delete($completionFull) }
            catch { $workerExitCode = 100 }
        }
    }
}

exit $workerExitCode
