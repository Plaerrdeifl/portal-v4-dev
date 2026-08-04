#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('exit-success', 'stderr-success', 'exit-failure', 'health-ready', 'health-failure', 'timeout', 'child-tree', 'child-sleep', 'secret-output', 'large-output')]
    [string]$Mode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertTo-FixtureWindowsArgument {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
    if ($Value.Length -gt 0 -and -not [regex]::IsMatch($Value, '[\s"]', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $Value }
    $builder = New-Object Text.StringBuilder
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (($slashes * 2) + 1)))
            [void]$builder.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)); $slashes = 0 }
        [void]$builder.Append($character)
    }
    if ($slashes -gt 0) { [void]$builder.Append(('\' * ($slashes * 2))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

switch -CaseSensitive ($Mode) {
    'exit-success' {
        [Console]::Out.WriteLine('fixture exit-success stdout')
        exit 0
    }
    'stderr-success' {
        [Console]::Out.WriteLine('fixture stdout-only line')
        [Console]::Error.WriteLine('fixture stderr-only line')
        exit 0
    }
    'exit-failure' {
        [Console]::Error.WriteLine('fixture exit-failure stderr')
        exit 7
    }
    'health-ready' {
        [Console]::Out.WriteLine('M000_PROCESS_HEALTH_READY_V1')
        Start-Sleep -Seconds 2
        exit 0
    }
    'health-failure' {
        [Console]::Out.WriteLine('fixture health-failure without readiness')
        Start-Sleep -Seconds 1
        exit 0
    }
    'timeout' {
        Start-Sleep -Seconds 20
        exit 0
    }
    'child-tree' {
        $powerShellPath = [IO.Path]::Combine($PSHOME, 'powershell.exe')
        if (-not [IO.File]::Exists($powerShellPath)) { exit 81 }
        $arguments = @('-NoLogo', '-NoProfile', '-NonInteractive', '-File', $PSCommandPath, '-Mode', 'child-sleep')
        $encoded = @($arguments | ForEach-Object { ConvertTo-FixtureWindowsArgument -Value ([string]$_) }) -join ' '
        $startInfo = New-Object Diagnostics.ProcessStartInfo
        $startInfo.FileName = $powerShellPath
        $startInfo.Arguments = $encoded
        $startInfo.WorkingDirectory = $PSScriptRoot
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $child = New-Object Diagnostics.Process
        $child.StartInfo = $startInfo
        try {
            if (-not $child.Start()) { exit 82 }
            Start-Sleep -Seconds 20
        }
        finally {
            $child.Dispose()
        }
        exit 0
    }
    'child-sleep' {
        Start-Sleep -Seconds 20
        exit 0
    }
    'secret-output' {
        $dummyToken = ('gh' + 'p_' + ('A' * 24))
        $reservedMarker = ('V4_M000_R1_' + 'SELFTEST_OK')
        [Console]::Out.WriteLine(('stdout value ' + $dummyToken))
        [Console]::Error.WriteLine(('stderr value ' + $dummyToken))
        [Console]::Out.WriteLine($reservedMarker)
        exit 0
    }
    'large-output' {
        $chunk = ('L' * 4095) + [Environment]::NewLine
        for ($index = 0; $index -lt 1300; $index++) { [Console]::Out.Write($chunk) }
        exit 0
    }
}

exit 80
