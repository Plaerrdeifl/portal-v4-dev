Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:D2TestRoot = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', '..', '..'))
$script:D2OperatorRoot = [IO.Path]::Combine($script:D2TestRoot, 'scripts', 'operator')
$script:D2LoadedModules = New-Object 'Collections.Generic.List[string]'
$script:D2EnvironmentBackup = @{}
$script:D2OwnedProcesses = New-Object 'Collections.Generic.List[object]'

function Get-D2ModulePath { param([Parameter(Mandatory = $true)][string]$Name) return [IO.Path]::Combine($script:D2OperatorRoot, 'modules', $Name) }

function Import-D2Module {
    param([Parameter(Mandatory = $true)][string]$Name)
    $module = Import-Module -Name (Get-D2ModulePath -Name $Name) -Force -PassThru -ErrorAction Stop
    if (-not $script:D2LoadedModules.Contains($module.Name)) { $script:D2LoadedModules.Add($module.Name) }
    return $module
}

function Import-D2ChecksModule {
    $module = Import-Module -Name ([IO.Path]::Combine($script:D2OperatorRoot, 'checks', 'M000.R1.Checks.psm1')) -Force -PassThru -ErrorAction Stop
    if (-not $script:D2LoadedModules.Contains($module.Name)) { $script:D2LoadedModules.Add($module.Name) }
    return $module
}

function Remove-D2Modules {
    foreach ($name in @($script:D2LoadedModules.ToArray()) | Select-Object -Unique) { Remove-Module -Name $name -Force -ErrorAction SilentlyContinue }
    foreach ($name in @('M000.R1.Checks', 'Operator.Orchestration', 'Operator.Process', 'Operator.Reporting', 'Operator.Security', 'Operator.Environment', 'Operator.Git', 'Operator.Manifest', 'Operator.Core')) { Remove-Module -Name $name -Force -ErrorAction SilentlyContinue }
    $script:D2LoadedModules.Clear()
}

function Set-D2EnvironmentValue {
    param([Parameter(Mandatory = $true)][string]$Name, [AllowNull()][string]$Value)
    if (-not $script:D2EnvironmentBackup.ContainsKey($Name)) { $script:D2EnvironmentBackup[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process') }
    [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
}

function Restore-D2Environment {
    foreach ($name in @($script:D2EnvironmentBackup.Keys)) { [Environment]::SetEnvironmentVariable([string]$name, $script:D2EnvironmentBackup[$name], 'Process') }
    $script:D2EnvironmentBackup.Clear()
}

function New-D2LocalAppData {
    param([Parameter(Mandatory = $true)][string]$BasePath)
    $path = [IO.Path]::Combine($BasePath, 'localappdata')
    [IO.Directory]::CreateDirectory($path) | Out-Null
    Set-D2EnvironmentValue -Name 'LOCALAPPDATA' -Value $path
    return $path
}

function New-D2ManifestObject {
    $manifestPath = [IO.Path]::Combine($script:D2OperatorRoot, 'manifests', 'M000-R1.json')
    return (Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Write-D2Manifest {
    param([Parameter(Mandatory = $true)][string]$LiteralPath, [Parameter(Mandatory = $true)]$Manifest)
    [IO.File]::WriteAllText($LiteralPath, (ConvertTo-Json -InputObject $Manifest -Depth 12), (New-Object Text.UTF8Encoding($false)))
    return $LiteralPath
}

function Write-D2InvalidJson {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    [IO.File]::WriteAllText($LiteralPath, '{"schemaVersion":1,', (New-Object Text.UTF8Encoding($false)))
    return $LiteralPath
}

function Write-D2DuplicatePropertyManifest {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    $json = '{"schemaVersion":1,"schemaVersion":1,"resultSchemaVersion":1,"operatorVersion":"1.0.0","moduleId":"M000","revision":"R1","name":"duplicate","stages":{"SelfTest":{"checks":[{"checkId":"selftest.exit-success","targetId":"fixture.exit-success","timeoutProfile":"short","required":true}]}}}'
    [IO.File]::WriteAllText($LiteralPath, $json, (New-Object Text.UTF8Encoding($false)))
    return $LiteralPath
}

function Copy-D2Object { param([Parameter(Mandatory = $true)]$InputObject) return ($InputObject | ConvertTo-Json -Depth 20 | ConvertFrom-Json) }

function New-D2RepositoryPolicy {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
    return [pscustomobject][ordered]@{
        schemaVersion = [int]1; repositoryRoot = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/'); branch = 'infra/m000-r1'; upstream = $null
        remotes = @([pscustomobject][ordered]@{ name = 'origin'; url = 'https://github.com/Plaerrdeifl/portal.git' }, [pscustomobject][ordered]@{ name = 'v4dev'; url = 'https://github.com/Plaerrdeifl/portal-v4-dev.git' })
        headSha = '94eab3c5228e77d4b70f7507216583407e8d9dc4'
    }
}

function New-D2RepositorySnapshot {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot, [object[]]$Entries = @())
    return [pscustomobject][ordered]@{
        schemaVersion = [int]1; repositoryRoot = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/'); headSha = '94eab3c5228e77d4b70f7507216583407e8d9dc4'; branch = 'infra/m000-r1'; upstream = $null
        remotes = @([pscustomobject][ordered]@{ name = 'origin'; url = 'https://github.com/Plaerrdeifl/portal.git' }, [pscustomobject][ordered]@{ name = 'v4dev'; url = 'https://github.com/Plaerrdeifl/portal-v4-dev.git' })
        workingTreeState = [pscustomobject][ordered]@{ isClean = (@($Entries).Count -eq 0); entries = @($Entries) }; capturedAtUtc = '2026-08-04T10:00:00.000Z'
    }
}

function New-D2Fingerprint {
    param([string]$Value = ('a' * 64), [string]$HeadSha = '94eab3c5228e77d4b70f7507216583407e8d9dc4', [int]$EntryCount = 0)
    return [pscustomobject][ordered]@{ schemaVersion = [int]1; algorithm = 'SHA256'; fingerprint = $Value; headSha = $HeadSha; entryCount = [int]$EntryCount; createdAtUtc = '2026-08-04T10:00:00.000Z' }
}

function New-D2Cleanup {
    param([string]$Status = 'passed', [int]$Owned = 0, [int]$Terminated = 0, [int]$Remaining = 0)
    return [pscustomobject][ordered]@{ status = $Status; ownedProcessCount = [int]$Owned; terminatedProcessCount = [int]$Terminated; remainingOwnedProcessCount = [int]$Remaining }
}

function New-D2Result {
    param([string]$Status = 'passed', [int]$ExitCode = 0, [object[]]$Checks = @(), [string]$CleanupStatus = 'passed', [int]$Owned = 0, [int]$Terminated = 0, [int]$Remaining = 0, [string]$RunDirectory = 'C:\safe\run')
    return [pscustomobject][ordered]@{
        schemaVersion = [int]1; operatorVersion = '1.0.0'; runId = '20260804T100000000Z-abcdef123456'; stage = 'SelfTest'; status = $Status; exitCode = [int]$ExitCode
        startedAtUtc = '2026-08-04T10:00:00.000Z'; finishedAtUtc = '2026-08-04T10:00:01.000Z'; durationMs = [int64]1000; runDirectory = $RunDirectory
        moduleId = 'M000'; revision = 'R1'; manifestSha256 = ('a' * 64); checks = @($Checks); messages = @('safe message')
        cleanup = [pscustomobject][ordered]@{ status = $CleanupStatus; ownedProcessCount = [int]$Owned; terminatedProcessCount = [int]$Terminated; remainingOwnedProcessCount = [int]$Remaining }
    }
}

function New-D2CheckResult {
    param([string]$Status = 'passed', [string]$CheckId = 'selftest.exit-success', [string]$TargetId = 'fixture.exit-success')
    return [pscustomobject][ordered]@{ checkId = $CheckId; targetId = $TargetId; status = $Status; startedAtUtc = '2026-08-04T10:00:00.000Z'; finishedAtUtc = '2026-08-04T10:00:01.000Z'; durationMs = [int64]1000; summary = 'safe summary' }
}

function New-D2RunContext {
    param([Parameter(Mandatory = $true)][string]$LocalAppData)
    $runRoot = [IO.Path]::Combine($LocalAppData, 'Plaerrdeifl', 'PortalOperator', 'runs'); $runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 12); $runDirectory = [IO.Path]::Combine($runRoot, $runId)
    [IO.Directory]::CreateDirectory($runDirectory) | Out-Null
    return [pscustomobject][ordered]@{ RunId = $runId; RunRoot = $runRoot; RunDirectory = $runDirectory; StartedAtUtc = [DateTime]::Parse('2026-08-04T10:00:00.000Z').ToUniversalTime() }
}

function Invoke-D2PortalProcess {
    param(
        [Parameter(Mandatory = $true)][string]$CaptureRoot,
        [Parameter(Mandatory = $true)][string]$Stage,
        [Parameter(Mandatory = $true)][string]$ManifestPath,
        [switch]$ReferenceProvided,
        [AllowNull()][string]$ReferenceRunId
    )

    [IO.Directory]::CreateDirectory($CaptureRoot) | Out-Null

    $processModule = Get-Module -Name 'Operator.Process' |
        Where-Object {
            $null -ne $_.Path -and
            [string]::Equals(
                [IO.Path]::GetFullPath([string]$_.Path),
                [IO.Path]::GetFullPath((Get-D2ModulePath -Name 'Operator.Process.psm1')),
                [StringComparison]::OrdinalIgnoreCase
            )
        } |
        Select-Object -First 1

    if ($null -eq $processModule) {
        $processModule = Import-D2Module -Name 'Operator.Process.psm1'
    }

    $arguments = @(
        '-NoLogo'
        '-NoProfile'
        '-NonInteractive'
        '-File'
        [IO.Path]::Combine($script:D2OperatorRoot, 'portal-operator.ps1')
        '-Stage'
        $Stage
        '-ManifestPath'
        $ManifestPath
    )

    if ($ReferenceProvided) {
        $arguments += @('-ReferenceRunId', [string]$ReferenceRunId)
    }

    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = [IO.Path]::Combine($PSHOME, 'powershell.exe')
    $startInfo.Arguments = ConvertTo-OperatorWindowsCommandLine -Arguments $arguments
    $startInfo.WorkingDirectory = $script:D2TestRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object Diagnostics.Process
    $process.StartInfo = $startInfo

    try {
        if (-not $process.Start()) {
            throw 'Portal test process could not be started.'
        }

        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()

        return [pscustomobject][ordered]@{
            ExitCode = [int]$process.ExitCode
            Stdout   = [string]$stdoutTask.GetAwaiter().GetResult()
            Stderr   = [string]$stderrTask.GetAwaiter().GetResult()
        }
    }
    finally {
        try {
            if (-not $process.HasExited) {
                $process.Kill()
                $process.WaitForExit()
            }
        }
        catch {
            Write-Verbose 'Portal test process cleanup failed.'
        }

        $process.Dispose()
    }
}

function Add-D2OwnedProcess { param([Parameter(Mandatory = $true)]$Process) $script:D2OwnedProcesses.Add($Process); return $Process }

function Stop-D2OwnedProcesses {
    foreach ($process in @($script:D2OwnedProcesses.ToArray())) {
        if ($null -ne $process) { try { if (-not $process.HasExited) { $process.Kill() } } catch { Write-Verbose 'Known test process could not be stopped.' }; try { $process.Dispose() } catch { Write-Verbose 'Known test process could not be disposed.' } }
    }
    $script:D2OwnedProcesses.Clear()
}

function Clear-D2TestState { Stop-D2OwnedProcesses; Restore-D2Environment; Remove-D2Modules }
