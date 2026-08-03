Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-OperatorToolRequirements {
    return @(
        [pscustomobject][ordered]@{ id = 'windows-powershell'; required = $true; versionRequirement = '5.1' },
        [pscustomobject][ordered]@{ id = 'git'; required = $true; versionRequirement = $null },
        [pscustomobject][ordered]@{ id = 'node'; required = $true; versionRequirement = '>=24.18.0 <25' },
        [pscustomobject][ordered]@{ id = 'npm'; required = $true; versionRequirement = $null },
        [pscustomobject][ordered]@{ id = 'docker'; required = $true; versionRequirement = $null },
        [pscustomobject][ordered]@{ id = 'supabase-local'; required = $true; versionRequirement = $null },
        [pscustomobject][ordered]@{ id = 'pester'; required = $true; versionRequirement = $null }
    )
}

function Get-OperatorAvailablePesterVersions {
    $versions = New-Object 'Collections.Generic.List[version]'
    foreach ($module in @(Get-Module -ListAvailable -Name Pester -ErrorAction SilentlyContinue)) {
        if ($null -ne $module -and $null -ne $module.Version -and -not $versions.Contains([version]$module.Version)) {
            $versions.Add([version]$module.Version)
        }
    }
    return @($versions.ToArray() | Sort-Object -Descending)
}

function Get-OperatorSafeRepositoryFileCandidate {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )
    if (-not [IO.Path]::IsPathRooted($RepositoryRoot)) { throw 'Repository root must be absolute.' }
    $root = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/')
    $fullPath = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $RelativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
    $prefix = $root + [IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Trusted project-local candidate escaped the repository root.' }

    $rootItem = Get-Item -LiteralPath $root -Force -ErrorAction Stop
    if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        return [pscustomobject][ordered]@{ isSafeRegularFile = $false; fullPath = $fullPath }
    }

    $segments = @($RelativePath -split '[\\/]')
    $cursor = $root
    for ($index = 0; $index -lt $segments.Count; $index++) {
        $cursor = [IO.Path]::Combine($cursor, [string]$segments[$index])
        $item = $null
        try {
            $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
        }
        catch [System.Management.Automation.ItemNotFoundException] {
            return [pscustomobject][ordered]@{ isSafeRegularFile = $false; fullPath = $fullPath }
        }
        catch {
            return [pscustomobject][ordered]@{ isSafeRegularFile = $false; fullPath = $fullPath }
        }
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            return [pscustomobject][ordered]@{ isSafeRegularFile = $false; fullPath = $fullPath }
        }
        $isFinal = $index -eq ($segments.Count - 1)
        if (-not $isFinal -and -not $item.PSIsContainer) {
            return [pscustomobject][ordered]@{ isSafeRegularFile = $false; fullPath = $fullPath }
        }
        if ($isFinal) {
            return [pscustomobject][ordered]@{ isSafeRegularFile = (-not $item.PSIsContainer); fullPath = $fullPath }
        }
    }
    return [pscustomobject][ordered]@{ isSafeRegularFile = $false; fullPath = $fullPath }
}

function Find-OperatorProjectLocalSupabaseCli {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
    if (-not [IO.Path]::IsPathRooted($RepositoryRoot)) { throw 'Repository root must be absolute.' }
    $root = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/')
    $candidates = @(
        'node_modules/.bin/supabase.cmd',
        'node_modules/.bin/supabase.ps1',
        'node_modules/.bin/supabase',
        'node_modules/supabase/bin/supabase.exe',
        'node_modules/supabase/bin/supabase'
    )
    $found = @()
    foreach ($relativePath in $candidates) {
        $candidate = Get-OperatorSafeRepositoryFileCandidate -RepositoryRoot $root -RelativePath $relativePath
        if ($candidate.isSafeRegularFile) {
            $found += [pscustomobject][ordered]@{ relativePath = $relativePath; resolvedPath = [string]$candidate.fullPath; detectionSource = 'project-local-fixed-candidate' }
        }
    }
    return $found
}

function Get-OperatorSafeFileVersion {
    param([AllowNull()][string]$LiteralPath)
    if ([string]::IsNullOrWhiteSpace($LiteralPath) -or -not [IO.File]::Exists($LiteralPath)) { return $null }
    $item = Get-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $null }
    $version = [string]$item.VersionInfo.ProductVersion
    if ([string]::IsNullOrWhiteSpace($version)) { $version = [string]$item.VersionInfo.FileVersion }
    if ([string]::IsNullOrWhiteSpace($version)) { return $null }
    $match = [regex]::Match($version, '(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)', [Text.RegularExpressions.RegexOptions]::CultureInvariant)
    if (-not $match.Success) { return $null }
    return ($match.Groups[1].Value + '.' + $match.Groups[2].Value + '.' + $match.Groups[3].Value)
}

function Get-OperatorCommandMetadata {
    param([Parameter(Mandatory = $true)][string]$Name)
    $commands = @(Get-Command -Name $Name -CommandType Application -ErrorAction SilentlyContinue)
    if ($commands.Count -eq 0) { return [pscustomobject][ordered]@{ available = $false; resolvedPath = $null; detectedVersion = $null; detectionSource = 'get-command' } }
    $command = $commands[0]
    $path = [string]$command.Source
    if ([string]::IsNullOrWhiteSpace($path)) { $path = [string]$command.Path }
    $version = Get-OperatorSafeFileVersion -LiteralPath $path
    return [pscustomobject][ordered]@{ available = $true; resolvedPath = $path; detectedVersion = $version; detectionSource = 'get-command-and-file-metadata' }
}

function Get-OperatorVersionStatus {
    param(
        [Parameter(Mandatory = $true)][string]$ToolId,
        [AllowNull()][string]$DetectedVersion,
        [AllowNull()][string]$Requirement
    )
    if ([string]::IsNullOrWhiteSpace($Requirement)) { return 'not-applicable' }
    if ([string]::IsNullOrWhiteSpace($DetectedVersion)) { return 'unknown' }
    $parsed = $null
    if (-not [version]::TryParse($DetectedVersion, [ref]$parsed)) { return 'unknown' }
    if ($ToolId -ceq 'windows-powershell') { if ($parsed.Major -eq 5 -and $parsed.Minor -eq 1) { return 'satisfied' } else { return 'unsatisfied' } }
    if ($ToolId -ceq 'node') {
        $minimum = [version]'24.18.0'
        if ($parsed -ge $minimum -and $parsed.Major -lt 25) { return 'satisfied' } else { return 'unsatisfied' }
    }
    return 'unknown'
}

function New-OperatorToolStatus {
    param(
        [Parameter(Mandatory = $true)]$Requirement,
        [Parameter(Mandatory = $true)][bool]$Available,
        [AllowNull()]$ResolvedPath,
        [AllowNull()]$DetectedVersion,
        [Parameter(Mandatory = $true)][string]$DetectionSource
    )
    $pathValue = if ([string]::IsNullOrWhiteSpace([string]$ResolvedPath)) { $null } else { [string]$ResolvedPath }
    $versionValue = if ([string]::IsNullOrWhiteSpace([string]$DetectedVersion)) { $null } else { [string]$DetectedVersion }
    return [pscustomobject][ordered]@{
        id = [string]$Requirement.id
        required = [bool]$Requirement.required
        available = $Available
        resolvedPath = $pathValue
        detectedVersion = $versionValue
        versionRequirement = $Requirement.versionRequirement
        versionStatus = Get-OperatorVersionStatus -ToolId ([string]$Requirement.id) -DetectedVersion $versionValue -Requirement $Requirement.versionRequirement
        detectionSource = $DetectionSource
    }
}

function Get-OperatorEnvironmentSnapshot {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [DateTime]$CapturedAtUtc = [DateTime]::UtcNow
    )
    $requirements = Get-OperatorToolRequirements
    $requirementMap = @{}
    foreach ($requirement in $requirements) { $requirementMap[[string]$requirement.id] = $requirement }
    $tools = @()

    $powerShellVersion = $PSVersionTable.PSVersion.ToString()
    $powerShellPath = [IO.Path]::Combine($PSHOME, 'powershell.exe')
    if (-not [IO.File]::Exists($powerShellPath)) { $powerShellPath = $null }
    $tools += New-OperatorToolStatus -Requirement $requirementMap['windows-powershell'] -Available ($PSVersionTable.PSEdition -ceq 'Desktop' -and $PSVersionTable.PSVersion.Major -eq 5) -ResolvedPath $powerShellPath -DetectedVersion $powerShellVersion -DetectionSource 'powershell-runtime-metadata'

    foreach ($mapping in @(
        [pscustomobject]@{ id = 'git'; command = 'git.exe' },
        [pscustomobject]@{ id = 'node'; command = 'node.exe' },
        [pscustomobject]@{ id = 'npm'; command = 'npm.cmd' },
        [pscustomobject]@{ id = 'docker'; command = 'docker.exe' }
    )) {
        $metadata = Get-OperatorCommandMetadata -Name ([string]$mapping.command)
        $tools += New-OperatorToolStatus -Requirement $requirementMap[[string]$mapping.id] -Available ([bool]$metadata.available) -ResolvedPath $metadata.resolvedPath -DetectedVersion $metadata.detectedVersion -DetectionSource ([string]$metadata.detectionSource)
    }

    $supabaseCandidates = @(Find-OperatorProjectLocalSupabaseCli -RepositoryRoot $RepositoryRoot)
    $supabaseVersion = $null
    $packageCandidate = Get-OperatorSafeRepositoryFileCandidate -RepositoryRoot $RepositoryRoot -RelativePath 'node_modules/supabase/package.json'
    if ($supabaseCandidates.Count -gt 0 -and $packageCandidate.isSafeRegularFile) {
        try {
            $packageText = [IO.File]::ReadAllText([string]$packageCandidate.fullPath, (New-Object Text.UTF8Encoding($false, $true)))
            $packageObject = ConvertFrom-Json -InputObject $packageText -ErrorAction Stop
            if ($null -ne $packageObject.PSObject.Properties['version'] -and [regex]::IsMatch([string]$packageObject.version, '^\d+\.\d+\.\d+$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $supabaseVersion = [string]$packageObject.version }
        }
        catch {
            $supabaseVersion = $null
        }
    }
    $supabasePath = if ($supabaseCandidates.Count -gt 0) { [string]$supabaseCandidates[0].resolvedPath } else { $null }
    $tools += New-OperatorToolStatus -Requirement $requirementMap['supabase-local'] -Available ($supabaseCandidates.Count -gt 0) -ResolvedPath $supabasePath -DetectedVersion $supabaseVersion -DetectionSource 'project-local-fixed-candidates'

    $pesterVersions = @(Get-OperatorAvailablePesterVersions)
    $pesterVersion = if ($pesterVersions.Count -gt 0) { $pesterVersions[0].ToString() } else { $null }
    $tools += New-OperatorToolStatus -Requirement $requirementMap['pester'] -Available ($pesterVersions.Count -gt 0) -ResolvedPath $null -DetectedVersion $pesterVersion -DetectionSource 'get-module-listavailable'

    return [pscustomobject][ordered]@{
        schemaVersion = 1
        capturedAtUtc = $CapturedAtUtc.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
        tools = @($tools | Sort-Object -Property id -CaseSensitive)
    }
}

function Test-OperatorEnvironmentInteger {
    param([AllowNull()]$Value)
    return $Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or $Value -is [int64]
}

function Assert-OperatorTrustedToolRequirements {
    param([Parameter(Mandatory = $true)][object[]]$Requirements)
    $seen = @{}
    foreach ($requirement in $Requirements) {
        if ($null -eq $requirement -or $requirement -isnot [pscustomobject]) { throw 'Trusted tool requirements are malformed.' }
        $names = @($requirement.PSObject.Properties.Name)
        if ($names.Count -ne 3 -or $names -cnotcontains 'id' -or $names -cnotcontains 'required' -or $names -cnotcontains 'versionRequirement') { throw 'Trusted tool requirements are malformed.' }
        if ($requirement.id -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$requirement.id) -or $requirement.required -isnot [bool] -or ($null -ne $requirement.versionRequirement -and $requirement.versionRequirement -isnot [string])) { throw 'Trusted tool requirements are malformed.' }
        if ($seen.ContainsKey([string]$requirement.id)) { throw 'Trusted tool requirements are malformed.' }
        $seen[[string]$requirement.id] = $true
    }
}

function Test-OperatorEnvironmentSnapshot {
    param([Parameter(Mandatory = $true)][AllowNull()]$Snapshot)
    $requirements = @(Get-OperatorToolRequirements)
    Assert-OperatorTrustedToolRequirements -Requirements $requirements
    $violations = New-Object 'Collections.Generic.List[string]'
    try {
        if ($null -eq $Snapshot) {
            $violations.Add('Environment snapshot is missing.')
            return [pscustomobject][ordered]@{ isValid = $false; violations = @($violations.ToArray()) }
        }
        if ($Snapshot -isnot [pscustomobject]) {
            $violations.Add('Environment snapshot must be an object.')
            return [pscustomobject][ordered]@{ isValid = $false; violations = @($violations.ToArray()) }
        }
        $expectedTopLevel = @('schemaVersion', 'capturedAtUtc', 'tools')
        $names = @($Snapshot.PSObject.Properties.Name)
        foreach ($name in $expectedTopLevel) { if ($names -cnotcontains $name) { $violations.Add('Environment snapshot is missing a required property.') } }
        foreach ($name in $names) { if ($expectedTopLevel -cnotcontains $name) { $violations.Add('Environment snapshot contains an unsupported property.') } }
        if ($violations.Count -gt 0) { return [pscustomobject][ordered]@{ isValid = $false; violations = @($violations.ToArray()) } }

        if (-not (Test-OperatorEnvironmentInteger -Value $Snapshot.schemaVersion) -or [int64]$Snapshot.schemaVersion -ne 1) { $violations.Add('Environment snapshot schema version is invalid.') }
        $capturedAt = [DateTime]::MinValue
        $dateStyles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
        if ($Snapshot.capturedAtUtc -isnot [string] -or -not [DateTime]::TryParseExact([string]$Snapshot.capturedAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $dateStyles, [ref]$capturedAt)) { $violations.Add('Environment snapshot timestamp is invalid.') }

        if ($null -eq $Snapshot.tools -or $Snapshot.tools -isnot [System.Array]) {
            $violations.Add('Environment snapshot tools must be an array.')
            $tools = @()
        }
        else { $tools = @($Snapshot.tools) }
        if ($tools.Count -ne $requirements.Count) { $violations.Add('Environment snapshot tool count is unexpected.') }
        $expectedToolProperties = @('id', 'required', 'available', 'resolvedPath', 'detectedVersion', 'versionRequirement', 'versionStatus', 'detectionSource')
        foreach ($tool in $tools) {
            if ($null -eq $tool -or $tool -isnot [pscustomobject]) { $violations.Add('Environment snapshot contains an invalid tool status.'); continue }
            $toolNames = @($tool.PSObject.Properties.Name)
            $closed = $toolNames.Count -eq $expectedToolProperties.Count
            foreach ($name in $expectedToolProperties) { if ($toolNames -cnotcontains $name) { $closed = $false } }
            if (-not $closed) { $violations.Add('Environment snapshot tool status is not closed.'); continue }
            if ($tool.id -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$tool.id)) { $violations.Add('Tool status ID must be a non-empty string.') }
            if ($tool.required -isnot [bool] -or $tool.available -isnot [bool]) { $violations.Add('Tool status required and available values must be Boolean.') }
            if ($null -ne $tool.resolvedPath -and $tool.resolvedPath -isnot [string]) { $violations.Add('Tool resolved path must be a string or null.') }
            if ($null -ne $tool.detectedVersion -and $tool.detectedVersion -isnot [string]) { $violations.Add('Tool detected version must be a string or null.') }
            if ($null -ne $tool.versionRequirement -and $tool.versionRequirement -isnot [string]) { $violations.Add('Tool version requirement must be a string or null.') }
            if ($tool.versionStatus -isnot [string] -or @('satisfied', 'unsatisfied', 'unknown', 'not-applicable') -cnotcontains [string]$tool.versionStatus) { $violations.Add('Tool version status must be an allowed string.') }
            if ($tool.detectionSource -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$tool.detectionSource)) { $violations.Add('Tool detection source must be a non-empty string.') }
            if ($tool.resolvedPath -is [string] -and (([string]$tool.resolvedPath).IndexOf([char]0) -ge 0 -or ([string]$tool.resolvedPath).IndexOf("`r", [StringComparison]::Ordinal) -ge 0 -or ([string]$tool.resolvedPath).IndexOf("`n", [StringComparison]::Ordinal) -ge 0)) { $violations.Add('Tool resolved path contains a prohibited control character.') }
            if ($tool.detectionSource -is [string] -and (([string]$tool.detectionSource).IndexOf([char]0) -ge 0 -or ([string]$tool.detectionSource).IndexOf("`r", [StringComparison]::Ordinal) -ge 0 -or ([string]$tool.detectionSource).IndexOf("`n", [StringComparison]::Ordinal) -ge 0)) { $violations.Add('Tool detection source contains a prohibited control character.') }
            if ($tool.available -is [bool] -and -not [bool]$tool.available) {
                if ($null -ne $tool.resolvedPath) { $violations.Add('Unavailable tool must not have a resolved path.') }
                if ($null -ne $tool.detectedVersion) { $violations.Add('Unavailable tool must not have a detected version.') }
            }
        }

        foreach ($requirement in $requirements) {
            $matches = @($tools | Where-Object { $null -ne $_ -and $_ -is [pscustomobject] -and $null -ne $_.PSObject.Properties['id'] -and $_.id -is [string] -and [string]$_.id -ceq [string]$requirement.id })
            if ($matches.Count -ne 1) { $violations.Add('Environment snapshot must contain every trusted tool exactly once.'); continue }
            $tool = $matches[0]
            $toolNames = @($tool.PSObject.Properties.Name)
            if ($toolNames -cnotcontains 'required' -or $toolNames -cnotcontains 'versionRequirement' -or $toolNames -cnotcontains 'versionStatus' -or $toolNames -cnotcontains 'detectedVersion') { continue }
            if ($tool.required -isnot [bool] -or [bool]$tool.required -ne [bool]$requirement.required) { $violations.Add('Tool required flag does not match its trusted requirement.') }
            if ($null -ne $tool.versionRequirement -and $tool.versionRequirement -isnot [string]) { continue }
            $actualRequirement = if ($null -eq $tool.versionRequirement) { $null } else { [string]$tool.versionRequirement }
            $expectedRequirement = if ($null -eq $requirement.versionRequirement) { $null } else { [string]$requirement.versionRequirement }
            if (($null -eq $actualRequirement) -ne ($null -eq $expectedRequirement) -or ($null -ne $actualRequirement -and $actualRequirement -cne $expectedRequirement)) { $violations.Add('Tool version requirement does not match its trusted requirement.') }
            if (($null -eq $tool.detectedVersion -or $tool.detectedVersion -is [string]) -and $tool.versionStatus -is [string]) {
                $detectedVersion = if ($null -eq $tool.detectedVersion) { $null } else { [string]$tool.detectedVersion }
                $expectedStatus = Get-OperatorVersionStatus -ToolId ([string]$requirement.id) -DetectedVersion $detectedVersion -Requirement $expectedRequirement
                if ([string]$tool.versionStatus -cne $expectedStatus) { $violations.Add('Tool version status is inconsistent.') }
            }
        }
        foreach ($tool in $tools) {
            if ($null -eq $tool -or $tool -isnot [pscustomobject] -or $null -eq $tool.PSObject.Properties['id'] -or $tool.id -isnot [string]) { continue }
            if (@($requirements | Where-Object { [string]$_.id -ceq [string]$tool.id }).Count -ne 1) { $violations.Add('Environment snapshot contains an unknown tool ID.') }
        }
    }
    catch {
        $violations.Add('Environment snapshot could not be evaluated safely.')
    }
    return [pscustomobject][ordered]@{ isValid = ($violations.Count -eq 0); violations = @($violations.ToArray()) }
}

Export-ModuleMember -Function @(
    'Get-OperatorToolRequirements',
    'Get-OperatorEnvironmentSnapshot',
    'Test-OperatorEnvironmentSnapshot',
    'Find-OperatorProjectLocalSupabaseCli',
    'Get-OperatorAvailablePesterVersions'
)
