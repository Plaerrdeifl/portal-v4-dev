Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:GitInspectionDefinitions = @(
    [pscustomobject][ordered]@{ targetId = 'repository-root'; arguments = @('rev-parse', '--show-toplevel') },
    [pscustomobject][ordered]@{ targetId = 'head-sha'; arguments = @('rev-parse', '--verify', 'HEAD') },
    [pscustomobject][ordered]@{ targetId = 'current-branch'; arguments = @('symbolic-ref', '--quiet', '--short', 'HEAD') },
    [pscustomobject][ordered]@{ targetId = 'upstream'; arguments = @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}') },
    [pscustomobject][ordered]@{ targetId = 'remote-urls'; arguments = @('config', '--get-regexp', '^remote\..*\.url$') },
    [pscustomobject][ordered]@{ targetId = 'working-tree-status'; arguments = @('status', '--porcelain=v1', '-z', '--untracked-files=all') }
)

function New-OperatorRepositoryPolicy {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [string]$ExpectedBranch = 'infra/m000-r1',
        [AllowNull()][string]$ExpectedUpstream = $null,
        [AllowNull()][string]$ExpectedHeadSha = $null
    )

    if (-not [IO.Path]::IsPathRooted($RepositoryRoot)) { throw 'The trusted repository root must be absolute.' }
    $root = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if ([string]::IsNullOrWhiteSpace($ExpectedBranch)) { throw 'The expected branch must not be empty.' }
    $headValue = $null
    if ($PSBoundParameters.ContainsKey('ExpectedHeadSha') -and -not [string]::IsNullOrWhiteSpace($ExpectedHeadSha)) {
        if (-not [regex]::IsMatch($ExpectedHeadSha, '^[a-f0-9]{40}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'The expected HEAD SHA must be a lowercase full SHA-1 value.' }
        $headValue = $ExpectedHeadSha
    }
    $upstreamValue = $null
    if ($PSBoundParameters.ContainsKey('ExpectedUpstream') -and -not [string]::IsNullOrWhiteSpace($ExpectedUpstream)) { $upstreamValue = $ExpectedUpstream }

    return [pscustomobject][ordered]@{
        schemaVersion = 1
        repositoryRoot = $root
        branch = $ExpectedBranch
        upstream = $upstreamValue
        remotes = @(
            [pscustomobject][ordered]@{ name = 'origin'; url = 'https://github.com/Plaerrdeifl/portal.git' },
            [pscustomobject][ordered]@{ name = 'v4dev'; url = 'https://github.com/Plaerrdeifl/portal-v4-dev.git' }
        )
        headSha = $headValue
    }
}

function Get-OperatorGitInspectionPlan {
    $items = @()
    foreach ($definition in $script:GitInspectionDefinitions) {
        $items += [pscustomobject][ordered]@{
            targetId = [string]$definition.targetId
            arguments = @($definition.arguments)
        }
    }
    return $items
}

function Test-OperatorGitInspectionPlan {
    param([Parameter(Mandatory = $true)][object[]]$Plan)

    $violations = New-Object 'Collections.Generic.List[string]'
    if ($Plan.Count -ne $script:GitInspectionDefinitions.Count) {
        $violations.Add('The Git inspection plan has an unexpected target count.')
    }
    $limit = [Math]::Min($Plan.Count, $script:GitInspectionDefinitions.Count)
    for ($index = 0; $index -lt $limit; $index++) {
        $actual = $Plan[$index]
        $expected = $script:GitInspectionDefinitions[$index]
        if ($null -eq $actual -or $null -eq $actual.PSObject.Properties['targetId'] -or $null -eq $actual.PSObject.Properties['arguments']) {
            $violations.Add("Git inspection item $index is malformed.")
            continue
        }
        $actualNames = @($actual.PSObject.Properties.Name)
        if ($actualNames.Count -ne 2 -or $actualNames -cnotcontains 'targetId' -or $actualNames -cnotcontains 'arguments') {
            $violations.Add("Git inspection item $index is not closed.")
        }
        if ([string]$actual.targetId -cne [string]$expected.targetId) {
            $violations.Add("Git inspection item $index has an unexpected target ID.")
        }
        $arguments = @($actual.arguments)
        if ($arguments.Count -ne $expected.arguments.Count) {
            $violations.Add("Git inspection item $index has an unexpected argument count.")
            continue
        }
        for ($argumentIndex = 0; $argumentIndex -lt $arguments.Count; $argumentIndex++) {
            if ([string]$arguments[$argumentIndex] -cne [string]$expected.arguments[$argumentIndex]) {
                $violations.Add("Git inspection item $index has an unexpected argument at position $argumentIndex.")
            }
        }
    }
    return [pscustomobject][ordered]@{ isValid = ($violations.Count -eq 0); violations = @($violations.ToArray()) }
}

function Get-OperatorCapturedResult {
    param(
        [Parameter(Mandatory = $true)][object[]]$InspectionResults,
        [Parameter(Mandatory = $true)][string]$TargetId
    )
    $matches = @($InspectionResults | Where-Object { $null -ne $_ -and $null -ne $_.PSObject.Properties['targetId'] -and [string]$_.targetId -ceq $TargetId })
    if ($matches.Count -ne 1) { throw "Captured Git result '$TargetId' must occur exactly once." }
    $result = $matches[0]
    foreach ($name in @('targetId', 'exitCode', 'output')) {
        if ($null -eq $result.PSObject.Properties[$name]) { throw "Captured Git result '$TargetId' is missing a required property." }
    }
    $names = @($result.PSObject.Properties.Name)
    if ($names.Count -ne 3) { throw "Captured Git result '$TargetId' contains unsupported properties." }
    return $result
}

function ConvertFrom-OperatorRemoteOutput {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Output)
    $remoteMap = @{}
    foreach ($line in @($Output -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $match = [regex]::Match($line, '^remote\.([^\.\s]+)\.url\s+(.+)$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)
        if (-not $match.Success) { throw 'Captured remote configuration output is malformed.' }
        $name = $match.Groups[1].Value
        $url = $match.Groups[2].Value
        if ($remoteMap.ContainsKey($name)) { throw 'Captured remote configuration contains a duplicate remote.' }
        $remoteMap[$name] = $url
    }
    $remotes = @()
    foreach ($name in @($remoteMap.Keys | Sort-Object -CaseSensitive)) {
        $remotes += [pscustomobject][ordered]@{ name = [string]$name; url = [string]$remoteMap[$name] }
    }
    return ,$remotes
}

function ConvertFrom-OperatorStatusOutput {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Output)
    if ($Output.Length -eq 0) { return ,@() }
    $records = @($Output -split "`0", -1)
    $entries = @()
    for ($index = 0; $index -lt $records.Count; $index++) {
        $record = [string]$records[$index]
        if ($record.Length -eq 0) { continue }
        if ($record.Length -lt 4 -or $record[2] -cne ' ') { throw 'Captured working-tree status output is malformed.' }
        $statusCode = $record.Substring(0, 2)
        $path = $record.Substring(3)
        $originalPath = $null
        if ($statusCode[0] -ceq 'R' -or $statusCode[0] -ceq 'C' -or $statusCode[1] -ceq 'R' -or $statusCode[1] -ceq 'C') {
            $index++
            if ($index -ge $records.Count -or [string]::IsNullOrEmpty([string]$records[$index])) { throw 'Captured rename or copy status lacks its original path.' }
            $originalPath = [string]$records[$index]
        }
        $entries += [pscustomobject][ordered]@{
            path = $path.Replace('\', '/')
            status = $statusCode
            originalPath = if ($null -eq $originalPath) { $null } else { $originalPath.Replace('\', '/') }
        }
    }
    return ,@($entries | Sort-Object -Property @{ Expression = { [string]$_.path }; Ascending = $true } -CaseSensitive)
}

function ConvertTo-OperatorRepositorySnapshot {
    param(
        [Parameter(Mandatory = $true)][object[]]$InspectionResults,
        [DateTime]$CapturedAtUtc = [DateTime]::UtcNow
    )

    $planValidation = Test-OperatorGitInspectionPlan -Plan (Get-OperatorGitInspectionPlan)
    if (-not $planValidation.isValid) { throw 'The trusted Git inspection plan is internally invalid.' }

    $rootResult = Get-OperatorCapturedResult -InspectionResults $InspectionResults -TargetId 'repository-root'
    $headResult = Get-OperatorCapturedResult -InspectionResults $InspectionResults -TargetId 'head-sha'
    $branchResult = Get-OperatorCapturedResult -InspectionResults $InspectionResults -TargetId 'current-branch'
    $upstreamResult = Get-OperatorCapturedResult -InspectionResults $InspectionResults -TargetId 'upstream'
    $remoteResult = Get-OperatorCapturedResult -InspectionResults $InspectionResults -TargetId 'remote-urls'
    $statusResult = Get-OperatorCapturedResult -InspectionResults $InspectionResults -TargetId 'working-tree-status'

    foreach ($result in @($rootResult, $headResult, $branchResult, $remoteResult, $statusResult)) {
        if ([int]$result.exitCode -ne 0) { throw "Captured Git result '$($result.targetId)' did not complete successfully." }
    }
    if ([int]$upstreamResult.exitCode -notin @(0, 1, 128)) { throw 'Captured upstream result has an unsupported exit code.' }

    $repositoryRoot = ([string]$rootResult.output).TrimEnd("`r", "`n")
    $headSha = ([string]$headResult.output).Trim()
    $branch = ([string]$branchResult.output).Trim()
    if (-not [IO.Path]::IsPathRooted($repositoryRoot)) { throw 'Captured repository root is not absolute.' }
    if (-not [regex]::IsMatch($headSha, '^[a-f0-9]{40}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Captured HEAD is not a lowercase full SHA-1 value.' }
    if ([string]::IsNullOrWhiteSpace($branch)) { throw 'Captured branch is empty.' }
    $upstream = if ([int]$upstreamResult.exitCode -eq 0) { ([string]$upstreamResult.output).Trim() } else { $null }
    if ($null -ne $upstream -and [string]::IsNullOrWhiteSpace($upstream)) { throw 'Captured upstream is empty despite a successful result.' }
    $remotes = ConvertFrom-OperatorRemoteOutput -Output ([string]$remoteResult.output)
    $entries = ConvertFrom-OperatorStatusOutput -Output ([string]$statusResult.output)

    return [pscustomobject][ordered]@{
        schemaVersion = 1
        repositoryRoot = [IO.Path]::GetFullPath($repositoryRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        headSha = $headSha
        branch = $branch
        upstream = $upstream
        remotes = @($remotes)
        workingTreeState = [pscustomobject][ordered]@{
            isClean = ($entries.Count -eq 0)
            entries = @($entries)
        }
        capturedAtUtc = $CapturedAtUtc.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
    }
}

function Assert-OperatorTrustedRepositoryPolicy {
    param([Parameter(Mandatory = $true)]$Policy)
    if ($null -eq $Policy -or $Policy -isnot [pscustomobject]) { throw 'Trusted repository policy is malformed.' }
    $required = @('schemaVersion', 'repositoryRoot', 'branch', 'upstream', 'remotes', 'headSha')
    $names = @($Policy.PSObject.Properties.Name)
    foreach ($name in $required) { if ($names -cnotcontains $name) { throw 'Trusted repository policy is malformed.' } }
    if ($Policy.repositoryRoot -isnot [string] -or $Policy.branch -isnot [string] -or $Policy.remotes -isnot [System.Array]) { throw 'Trusted repository policy is malformed.' }
    if ($null -ne $Policy.upstream -and $Policy.upstream -isnot [string]) { throw 'Trusted repository policy is malformed.' }
    if ($null -ne $Policy.headSha -and $Policy.headSha -isnot [string]) { throw 'Trusted repository policy is malformed.' }
    foreach ($remote in @($Policy.remotes)) {
        if ($null -eq $remote -or $remote -isnot [pscustomobject] -or $null -eq $remote.PSObject.Properties['name'] -or $null -eq $remote.PSObject.Properties['url'] -or $remote.name -isnot [string] -or $remote.url -isnot [string]) { throw 'Trusted repository policy is malformed.' }
    }
}

function Test-OperatorSnapshotInteger {
    param([AllowNull()]$Value)
    return $Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or $Value -is [int64]
}

function Test-OperatorRepositorySnapshot {
    param(
        [AllowNull()]$Snapshot,
        [Parameter(Mandatory = $true)]$Policy
    )

    Assert-OperatorTrustedRepositoryPolicy -Policy $Policy
    $violations = New-Object 'Collections.Generic.List[string]'
    try {
        if ($null -eq $Snapshot) {
            $violations.Add('Repository snapshot is missing.')
            return [pscustomobject][ordered]@{ isValid = $false; violations = @($violations.ToArray()) }
        }
        if ($Snapshot -isnot [pscustomobject]) {
            $violations.Add('Repository snapshot must be an object.')
            return [pscustomobject][ordered]@{ isValid = $false; violations = @($violations.ToArray()) }
        }

        $expectedProperties = @('schemaVersion', 'repositoryRoot', 'headSha', 'branch', 'upstream', 'remotes', 'workingTreeState', 'capturedAtUtc')
        $actualProperties = @($Snapshot.PSObject.Properties.Name)
        foreach ($name in $expectedProperties) { if ($actualProperties -cnotcontains $name) { $violations.Add('Repository snapshot is missing a required property.') } }
        foreach ($name in $actualProperties) { if ($expectedProperties -cnotcontains $name) { $violations.Add('Repository snapshot contains an unsupported property.') } }

        if ($actualProperties -ccontains 'schemaVersion') {
            if (-not (Test-OperatorSnapshotInteger -Value $Snapshot.schemaVersion) -or [int64]$Snapshot.schemaVersion -ne 1) { $violations.Add('Repository snapshot schema version is invalid.') }
        }
        if ($actualProperties -ccontains 'repositoryRoot') {
            if ($Snapshot.repositoryRoot -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$Snapshot.repositoryRoot)) { $violations.Add('Repository snapshot root is invalid.') }
            elseif (-not [string]::Equals([string]$Snapshot.repositoryRoot, [string]$Policy.repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) { $violations.Add('Repository root does not match policy.') }
        }
        if ($actualProperties -ccontains 'headSha') {
            if ($Snapshot.headSha -isnot [string] -or -not [regex]::IsMatch([string]$Snapshot.headSha, '^[a-f0-9]{40}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $violations.Add('Repository snapshot HEAD is invalid.') }
            elseif ($null -ne $Policy.headSha -and [string]$Snapshot.headSha -cne [string]$Policy.headSha) { $violations.Add('Repository HEAD does not match policy.') }
        }
        if ($actualProperties -ccontains 'branch') {
            if ($Snapshot.branch -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$Snapshot.branch)) { $violations.Add('Repository snapshot branch is invalid.') }
            elseif ([string]$Snapshot.branch -cne [string]$Policy.branch) { $violations.Add('Repository branch does not match policy.') }
        }
        if ($actualProperties -ccontains 'upstream') {
            if ($null -ne $Snapshot.upstream -and $Snapshot.upstream -isnot [string]) { $violations.Add('Repository snapshot upstream is invalid.') }
            else {
                $actualUpstream = if ($null -eq $Snapshot.upstream) { $null } else { [string]$Snapshot.upstream }
                $expectedUpstream = if ($null -eq $Policy.upstream) { $null } else { [string]$Policy.upstream }
                if (($null -eq $actualUpstream) -ne ($null -eq $expectedUpstream) -or ($null -ne $actualUpstream -and $actualUpstream -cne $expectedUpstream)) { $violations.Add('Repository upstream does not match policy.') }
            }
        }

        if ($actualProperties -ccontains 'remotes') {
            if ($null -eq $Snapshot.remotes -or $Snapshot.remotes -isnot [System.Array]) {
                $violations.Add('Repository snapshot remotes must be an array.')
            }
            else {
                $actualRemotes = @($Snapshot.remotes)
                if ($actualRemotes.Count -ne @($Policy.remotes).Count) { $violations.Add('Repository remote count does not match policy.') }
                foreach ($remote in $actualRemotes) {
                    if ($null -eq $remote -or $remote -isnot [pscustomobject]) { $violations.Add('Repository remote entry is invalid.'); continue }
                    $remoteProperties = @($remote.PSObject.Properties.Name)
                    if ($remoteProperties.Count -ne 2 -or $remoteProperties -cnotcontains 'name' -or $remoteProperties -cnotcontains 'url') { $violations.Add('Repository remote entry is not closed.'); continue }
                    if ($remote.name -isnot [string] -or $remote.url -isnot [string]) { $violations.Add('Repository remote entry has invalid value types.'); continue }
                }
                foreach ($expectedRemote in @($Policy.remotes)) {
                    $matches = @($actualRemotes | Where-Object { $null -ne $_ -and $_ -is [pscustomobject] -and $null -ne $_.PSObject.Properties['name'] -and $_.name -is [string] -and [string]$_.name -ceq [string]$expectedRemote.name })
                    if ($matches.Count -ne 1) { $violations.Add('Repository remote mapping does not match policy.'); continue }
                    if ($null -eq $matches[0].PSObject.Properties['url'] -or $matches[0].url -isnot [string] -or [string]$matches[0].url -cne [string]$expectedRemote.url) { $violations.Add('Repository remote URL does not match policy.') }
                }
            }
        }

        if ($actualProperties -ccontains 'workingTreeState') {
            $state = $Snapshot.workingTreeState
            if ($null -eq $state -or $state -isnot [pscustomobject]) {
                $violations.Add('Repository working-tree state must be an object.')
            }
            else {
                $stateProperties = @($state.PSObject.Properties.Name)
                if ($stateProperties.Count -ne 2 -or $stateProperties -cnotcontains 'isClean' -or $stateProperties -cnotcontains 'entries') { $violations.Add('Repository working-tree state is not closed.') }
                if ($stateProperties -ccontains 'isClean' -and $state.isClean -isnot [bool]) { $violations.Add('Repository working-tree clean flag is invalid.') }
                if ($stateProperties -ccontains 'entries') {
                    if ($null -eq $state.entries -or $state.entries -isnot [System.Array]) {
                        $violations.Add('Repository working-tree entries must be an array.')
                    }
                    else {
                        $entries = @($state.entries)
                        foreach ($entry in $entries) {
                            if ($null -eq $entry -or $entry -isnot [pscustomobject]) { $violations.Add('Repository working-tree entry is invalid.'); continue }
                            $entryProperties = @($entry.PSObject.Properties.Name)
                            if ($entryProperties.Count -ne 3 -or $entryProperties -cnotcontains 'path' -or $entryProperties -cnotcontains 'status' -or $entryProperties -cnotcontains 'originalPath') { $violations.Add('Repository working-tree entry is not closed.'); continue }
                            if ($entry.path -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$entry.path) -or $entry.status -isnot [string] -or ([string]$entry.status).Length -ne 2 -or ($null -ne $entry.originalPath -and $entry.originalPath -isnot [string])) { $violations.Add('Repository working-tree entry has invalid value types.') }
                        }
                        if ($stateProperties -ccontains 'isClean' -and $state.isClean -is [bool] -and [bool]$state.isClean -ne ($entries.Count -eq 0)) { $violations.Add('Repository working-tree clean flag is inconsistent.') }
                    }
                }
            }
        }
        if ($actualProperties -ccontains 'capturedAtUtc') {
            $capturedAt = [DateTime]::MinValue
            $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
            if ($Snapshot.capturedAtUtc -isnot [string] -or -not [DateTime]::TryParseExact([string]$Snapshot.capturedAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$capturedAt)) { $violations.Add('Repository snapshot timestamp is invalid.') }
        }
    }
    catch {
        $violations.Add('Repository snapshot could not be evaluated safely.')
    }
    return [pscustomobject][ordered]@{ isValid = ($violations.Count -eq 0); violations = @($violations.ToArray()) }
}

function Get-OperatorSafeFingerprintPath {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )
    if ([string]::IsNullOrWhiteSpace($RelativePath) -or $RelativePath.IndexOf([char]0) -ge 0 -or $RelativePath.StartsWith('\', [StringComparison]::Ordinal) -or $RelativePath.StartsWith('/', [StringComparison]::Ordinal) -or $RelativePath -match '(^|[\\/])\.\.([\\/]|$)' -or $RelativePath.IndexOf(':') -ge 0) {
        throw 'Working-tree entry contains an unsafe path.'
    }
    $root = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/')
    try {
        if ([IO.Path]::IsPathRooted($RelativePath)) { throw 'Working-tree entry contains an absolute path.' }
        $candidate = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $RelativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
    }
    catch [System.ArgumentException] {
        return [pscustomobject][ordered]@{ fullPath = $null; isFileSystemAddressable = $false }
    }
    catch [System.NotSupportedException] {
        return [pscustomobject][ordered]@{ fullPath = $null; isFileSystemAddressable = $false }
    }
    $prefix = $root + [IO.Path]::DirectorySeparatorChar
    if (-not $candidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Working-tree entry escapes the repository root.' }
    $rootItems = @(Get-Item -LiteralPath $root -Force -ErrorAction Stop)
    if ($rootItems.Count -ne 1 -or ($rootItems[0].Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Fingerprint repository root must not be a reparse point.' }
    $segments = @($RelativePath -split '[\\/]')
    $cursor = $root
    for ($index = 0; $index -lt ($segments.Count - 1); $index++) {
        $cursor = [IO.Path]::Combine($cursor, [string]$segments[$index])
        $parentItem = Get-OperatorFinalFingerprintItem -LiteralPath $cursor
        if ($null -eq $parentItem) { break }
        if (($parentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Working-tree entry traverses a parent reparse point.' }
        if (-not $parentItem.PSIsContainer) { throw 'Working-tree entry traverses a non-directory parent.' }
    }
    return [pscustomobject][ordered]@{ fullPath = $candidate; isFileSystemAddressable = $true }
}

function ConvertTo-OperatorFingerprintField {
    param([AllowNull()]$Value)
    if ($null -eq $Value) { return 'N' }
    $encoding = New-Object Text.UTF8Encoding($false, $true)
    $bytes = $encoding.GetBytes([string]$Value)
    return ('B' + $bytes.Length.ToString([Globalization.CultureInfo]::InvariantCulture) + ':' + [Convert]::ToBase64String($bytes))
}

function Get-OperatorFinalFingerprintItem {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    try {
        return Get-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop
    }
    catch [System.Management.Automation.ItemNotFoundException] {
        return $null
    }
    catch {
        throw 'Unable to inspect a working-tree entry safely.'
    }
}

function Get-OperatorOrdinalSortedValues {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Values)
    $copy = [string[]]@($Values)
    [Array]::Sort($copy, [StringComparer]::Ordinal)
    return $copy
}

function Get-OperatorSingleEntryByNormalizedPath {
    param(
        [Parameter(Mandatory = $true)][object[]]$Entries,
        [Parameter(Mandatory = $true)][string]$NormalizedPath
    )
    $matches = @($Entries | Where-Object { ([string]$_.path).Replace('\', '/') -ceq $NormalizedPath })
    if ($matches.Count -ne 1) { throw 'Working-tree snapshot contains duplicate normalized paths.' }
    return $matches[0]
}

function Get-OperatorSingleRemoteByName {
    param(
        [Parameter(Mandatory = $true)][object[]]$Remotes,
        [Parameter(Mandatory = $true)][string]$Name
    )
    $matches = @($Remotes | Where-Object { [string]$_.name -ceq $Name })
    if ($matches.Count -ne 1) { throw 'Repository snapshot contains duplicate remote names.' }
    return $matches[0]
}

function Add-OperatorCanonicalRecord {
    param(
        [Parameter(Mandatory = $true)]$Records,
        [Parameter(Mandatory = $true)][string]$RecordType,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyCollection()][object[]]$Fields
    )
    $encodedFields = New-Object 'Collections.Generic.List[string]'
    foreach ($field in $Fields) {
        $encodedFields.Add((ConvertTo-OperatorFingerprintField -Value $field))
    }
    if ($encodedFields.Count -eq 0) {
        $Records.Add($RecordType)
    }
    else {
        $Records.Add($RecordType + '|' + ($encodedFields -join '|'))
    }
}

function Get-OperatorFileSha256Lower {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    $stream = $null
    $sha = $null
    try {
        $stream = [IO.File]::Open($LiteralPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        $sha = [Security.Cryptography.SHA256]::Create()
        $bytes = $sha.ComputeHash($stream)
        return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        if ($null -ne $sha) { $sha.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function New-OperatorWorkingTreeFingerprint {
    param(
        [Parameter(Mandatory = $true)]$RepositorySnapshot,
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [DateTime]$CreatedAtUtc = [DateTime]::UtcNow
    )

    $root = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/')
    if (-not [string]::Equals($root, [string]$RepositorySnapshot.repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Fingerprint root does not match repository snapshot.' }
    $canonicalLines = New-Object 'Collections.Generic.List[string]'
    Add-OperatorCanonicalRecord -Records $canonicalLines -RecordType 'schemaVersion' -Fields @('1')
    Add-OperatorCanonicalRecord -Records $canonicalLines -RecordType 'headSha' -Fields @([string]$RepositorySnapshot.headSha)
    Add-OperatorCanonicalRecord -Records $canonicalLines -RecordType 'branch' -Fields @([string]$RepositorySnapshot.branch)
    $upstreamField = if ($null -eq $RepositorySnapshot.upstream) { $null } else { [string]$RepositorySnapshot.upstream }
    $canonicalLines.Add('upstream|' + (ConvertTo-OperatorFingerprintField -Value $upstreamField))

    $remotes = @($RepositorySnapshot.remotes)
    $remoteNames = New-Object 'Collections.Generic.List[string]'
    foreach ($remote in $remotes) { $remoteNames.Add([string]$remote.name) }
    foreach ($remoteName in @(Get-OperatorOrdinalSortedValues -Values $remoteNames.ToArray())) {
        $remote = Get-OperatorSingleRemoteByName -Remotes $remotes -Name $remoteName
        Add-OperatorCanonicalRecord -Records $canonicalLines -RecordType 'remote' -Fields @([string]$remote.name, [string]$remote.url)
    }

    $snapshotEntries = @($RepositorySnapshot.workingTreeState.entries)
    $normalizedPaths = New-Object 'Collections.Generic.List[string]'
    foreach ($entry in $snapshotEntries) { $normalizedPaths.Add(([string]$entry.path).Replace('\', '/')) }
    $sortedPaths = @(Get-OperatorOrdinalSortedValues -Values $normalizedPaths.ToArray())
    foreach ($relativePath in $sortedPaths) {
        $entry = Get-OperatorSingleEntryByNormalizedPath -Entries $snapshotEntries -NormalizedPath $relativePath
        $pathResolution = Get-OperatorSafeFingerprintPath -RepositoryRoot $root -RelativePath $relativePath
        $kind = 'missing'
        $contentHash = $null
        $item = if ($pathResolution.isFileSystemAddressable) { Get-OperatorFinalFingerprintItem -LiteralPath ([string]$pathResolution.fullPath) } else { $null }
        if ($null -ne $item) {
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                $kind = 'reparse-point'
            }
            elseif ($item.PSIsContainer) {
                $kind = 'directory'
            }
            else {
                $kind = 'file'
                $contentHash = Get-OperatorFileSha256Lower -LiteralPath $item.FullName
            }
        }
        $originalPath = '-'
        if ($null -ne $entry.originalPath) {
            $originalPath = ([string]$entry.originalPath).Replace('\', '/')
            [void](Get-OperatorSafeFingerprintPath -RepositoryRoot $root -RelativePath $originalPath)
        }
        $originalValue = if ($originalPath -ceq '-') { $null } else { $originalPath }
        Add-OperatorCanonicalRecord -Records $canonicalLines -RecordType 'entry' -Fields @($relativePath, [string]$entry.status, $originalValue, $kind, $contentHash)
    }

    $canonicalText = ($canonicalLines -join "`n") + "`n"
    $encoding = New-Object Text.UTF8Encoding($false)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash($encoding.GetBytes($canonicalText))
        $fingerprint = ([BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }

    return [pscustomobject][ordered]@{
        schemaVersion = 1
        algorithm = 'SHA256'
        fingerprint = $fingerprint
        headSha = [string]$RepositorySnapshot.headSha
        entryCount = $sortedPaths.Count
        createdAtUtc = $CreatedAtUtc.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
    }
}

function Test-OperatorWorkingTreeFingerprintObject {
    param([AllowNull()]$FingerprintObject)
    try {
        if ($null -eq $FingerprintObject -or $FingerprintObject -isnot [pscustomobject]) { return $false }
        $expectedProperties = @('schemaVersion', 'algorithm', 'fingerprint', 'headSha', 'entryCount', 'createdAtUtc')
        $actualProperties = @($FingerprintObject.PSObject.Properties.Name)
        if ($actualProperties.Count -ne $expectedProperties.Count) { return $false }
        foreach ($name in $expectedProperties) { if ($actualProperties -cnotcontains $name) { return $false } }
        if (-not (Test-OperatorSnapshotInteger -Value $FingerprintObject.schemaVersion) -or [int64]$FingerprintObject.schemaVersion -ne 1) { return $false }
        if ($FingerprintObject.algorithm -isnot [string] -or [string]$FingerprintObject.algorithm -cne 'SHA256') { return $false }
        if ($FingerprintObject.fingerprint -isnot [string] -or -not [regex]::IsMatch([string]$FingerprintObject.fingerprint, '^[a-f0-9]{64}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $false }
        if ($FingerprintObject.headSha -isnot [string] -or -not [regex]::IsMatch([string]$FingerprintObject.headSha, '^[a-f0-9]{40}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $false }
        if (-not (Test-OperatorSnapshotInteger -Value $FingerprintObject.entryCount) -or [int64]$FingerprintObject.entryCount -lt 0) { return $false }
        if ($FingerprintObject.createdAtUtc -isnot [string]) { return $false }
        $createdAt = [DateTime]::MinValue
        $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
        if (-not [DateTime]::TryParseExact([string]$FingerprintObject.createdAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$createdAt)) { return $false }
        return $true
    }
    catch {
        return $false
    }
}

function Compare-OperatorWorkingTreeFingerprint {
    param(
        [Parameter(Mandatory = $true)][AllowNull()]$ReferenceFingerprint,
        [Parameter(Mandatory = $true)][AllowNull()]$CurrentFingerprint
    )
    if (-not (Test-OperatorWorkingTreeFingerprintObject -FingerprintObject $ReferenceFingerprint) -or -not (Test-OperatorWorkingTreeFingerprintObject -FingerprintObject $CurrentFingerprint)) {
        return [pscustomobject][ordered]@{ isMatch = $false; reason = 'Working-tree fingerprint input is invalid.' }
    }
    $isMatch = [string]$ReferenceFingerprint.fingerprint -ceq [string]$CurrentFingerprint.fingerprint
    return [pscustomobject][ordered]@{ isMatch = $isMatch; reason = if ($isMatch) { 'Fingerprint matches.' } else { 'Working-tree fingerprint changed.' } }
}

Export-ModuleMember -Function @(
    'New-OperatorRepositoryPolicy',
    'Get-OperatorGitInspectionPlan',
    'Test-OperatorGitInspectionPlan',
    'ConvertTo-OperatorRepositorySnapshot',
    'Test-OperatorRepositorySnapshot',
    'New-OperatorWorkingTreeFingerprint',
    'Compare-OperatorWorkingTreeFingerprint'
)
