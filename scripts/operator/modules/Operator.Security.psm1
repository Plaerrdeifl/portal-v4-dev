Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ForbiddenProjectRefs = @('tpieykhhawszlzsoflnl', 'wplescvhlgctynkfwvrj')
$script:AllowedGitTargets = @(
    [pscustomobject][ordered]@{ targetId = 'repository-root'; arguments = @('rev-parse', '--show-toplevel') },
    [pscustomobject][ordered]@{ targetId = 'head-sha'; arguments = @('rev-parse', '--verify', 'HEAD') },
    [pscustomobject][ordered]@{ targetId = 'current-branch'; arguments = @('symbolic-ref', '--quiet', '--short', 'HEAD') },
    [pscustomobject][ordered]@{ targetId = 'upstream'; arguments = @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}') },
    [pscustomobject][ordered]@{ targetId = 'remote-urls'; arguments = @('config', '--get-regexp', '^remote\..*\.url$') },
    [pscustomobject][ordered]@{ targetId = 'working-tree-status'; arguments = @('status', '--porcelain=v1', '-z', '--untracked-files=all') }
)

function Get-OperatorValidatedRepositoryRoot {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
    if (-not [IO.Path]::IsPathRooted($RepositoryRoot)) { throw 'Repository root must be absolute.' }
    $root = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/')
    $volumeRoot = [IO.Path]::GetPathRoot($root)
    if ([string]::IsNullOrWhiteSpace($volumeRoot)) { throw 'Repository root is invalid.' }
    $relativeRoot = $root.Substring($volumeRoot.Length)
    $cursor = $volumeRoot
    foreach ($segment in @($relativeRoot -split '[\\/]' | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })) {
        $cursor = [IO.Path]::Combine($cursor, [string]$segment)
        $item = $null
        try { $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop }
        catch { throw 'Repository root must exist as a safe directory.' }
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Repository root must not contain a reparse point.' }
        $cursor = [IO.Path]::GetFullPath([string]$item.FullName).TrimEnd('\', '/')
    }
    $rootItem = $null
    try { $rootItem = Get-Item -LiteralPath $root -Force -ErrorAction Stop }
    catch { throw 'Repository root must exist as a safe directory.' }
    if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Repository root must be a non-reparse directory.' }
    return [IO.Path]::GetFullPath([string]$rootItem.FullName).TrimEnd('\', '/')
}

function Test-OperatorWindowsPathSegment {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Segment)
    if ([string]::IsNullOrEmpty($Segment)) { return $false }
    if ($Segment.EndsWith(' ', [StringComparison]::Ordinal) -or $Segment.EndsWith('.', [StringComparison]::Ordinal)) { return $false }
    $trimmedAlias = $Segment.TrimEnd(' ', '.')
    if ($trimmedAlias -ceq '.' -or $trimmedAlias -ceq '..') { return $false }
    if ([regex]::IsMatch($Segment, '[\x00-\x1f<>:"|?*]', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $false }
    if ([regex]::IsMatch($Segment, '^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$', [Text.RegularExpressions.RegexOptions]::CultureInvariant -bor [Text.RegularExpressions.RegexOptions]::IgnoreCase)) { return $false }
    return $true
}

function Get-OperatorRelativePathFromCanonicalFullPath {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$FullPath
    )
    $root = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/')
    $target = [IO.Path]::GetFullPath($FullPath).TrimEnd('\', '/')
    $rootVolume = [IO.Path]::GetPathRoot($root)
    $targetVolume = [IO.Path]::GetPathRoot($target)
    if (-not [string]::Equals($rootVolume, $targetVolume, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path is outside the repository boundary.' }
    $rootSegments = @($root.Substring($rootVolume.Length) -split '[\\/]' | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })
    $targetSegments = @($target.Substring($targetVolume.Length) -split '[\\/]' | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })
    if ($targetSegments.Count -le $rootSegments.Count) { throw 'Path is outside the repository boundary.' }
    for ($index = 0; $index -lt $rootSegments.Count; $index++) {
        if (-not [string]::Equals([string]$rootSegments[$index], [string]$targetSegments[$index], [StringComparison]::OrdinalIgnoreCase)) { throw 'Path is outside the repository boundary.' }
    }
    return (@($targetSegments[$rootSegments.Count..($targetSegments.Count - 1)]) -join '/')
}

function New-OperatorPathPolicy {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
    $root = Get-OperatorValidatedRepositoryRoot -RepositoryRoot $RepositoryRoot
    return [pscustomobject][ordered]@{
        schemaVersion = 1
        repositoryRoot = $root
        allowedPrefixes = @('scripts/operator/', 'docs/project/', 'docs/modules/M000/R1/')
    }
}

function Resolve-OperatorRepositoryRelativePath {
    param(
        [Parameter(Mandatory = $true)]$Policy,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$RelativePath
    )
    if ([string]::IsNullOrWhiteSpace($RelativePath)) { throw 'Repository-relative path must not be empty.' }
    if ($RelativePath.IndexOf([char]0) -ge 0) { throw 'Repository-relative path contains a prohibited control character.' }
    if ($RelativePath.StartsWith('\\', [StringComparison]::Ordinal) -or $RelativePath.StartsWith('//', [StringComparison]::Ordinal) -or $RelativePath.StartsWith('\\?\', [StringComparison]::Ordinal) -or $RelativePath.StartsWith('\\.\', [StringComparison]::Ordinal)) { throw 'UNC and device paths are not permitted.' }
    if ([IO.Path]::IsPathRooted($RelativePath) -or [regex]::IsMatch($RelativePath, '^[A-Za-z]:', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Absolute paths and drive-qualified paths are not permitted.' }
    if ($RelativePath.IndexOf(':') -ge 0) { throw 'Alternate data streams and colon-qualified paths are not permitted.' }
    $segments = @($RelativePath -split '[\\/]')
    foreach ($segment in $segments) {
        if (-not (Test-OperatorWindowsPathSegment -Segment ([string]$segment))) { throw 'Repository-relative path contains an unsafe Windows path segment.' }
        if ($segment -ceq '.' -or $segment -ceq '..') { throw 'Current and parent path segments are not permitted.' }
    }

    if ($null -eq $Policy -or $null -eq $Policy.PSObject.Properties['repositoryRoot'] -or $Policy.repositoryRoot -isnot [string]) { throw 'Repository path policy is malformed.' }
    $root = Get-OperatorValidatedRepositoryRoot -RepositoryRoot ([string]$Policy.repositoryRoot)
    $normalizedRelative = ($segments -join '/')
    try {
        $candidate = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $normalizedRelative.Replace('/', [IO.Path]::DirectorySeparatorChar)))
        $textualRelative = Get-OperatorRelativePathFromCanonicalFullPath -RepositoryRoot $root -FullPath $candidate
    }
    catch { throw 'Repository-relative path could not be canonicalized safely.' }
    if (-not [string]::Equals($textualRelative, $normalizedRelative, [StringComparison]::Ordinal)) { throw 'Repository-relative path is a normalization alias.' }

    $cursor = $root
    for ($index = 0; $index -lt $segments.Count; $index++) {
        $segment = [string]$segments[$index]
        $nextPath = [IO.Path]::GetFullPath([IO.Path]::Combine($cursor, $segment))
        if ([IO.Directory]::Exists($cursor)) {
            $matches = @(Get-ChildItem -LiteralPath $cursor -Force -ErrorAction Stop | Where-Object { [string]::Equals([string]$_.Name, $segment, [StringComparison]::OrdinalIgnoreCase) })
            if ($matches.Count -gt 1) { throw 'Repository path could not be resolved unambiguously.' }
            if ($matches.Count -eq 0) {
                if ([IO.File]::Exists($nextPath) -or [IO.Directory]::Exists($nextPath)) { throw 'Repository-relative path is a filesystem alias.' }
                $cursor = $nextPath
                continue
            }
            $item = $matches[0]
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Repository path traverses a reparse point.' }
            if ($index -lt ($segments.Count - 1) -and -not $item.PSIsContainer) { throw 'Repository path traverses a non-directory item.' }
            $cursor = [IO.Path]::GetFullPath([string]$item.FullName).TrimEnd('\', '/')
        }
        else { $cursor = $nextPath }
    }
    $canonicalRelative = Get-OperatorRelativePathFromCanonicalFullPath -RepositoryRoot $root -FullPath $cursor
    if (-not [string]::Equals($canonicalRelative, $normalizedRelative, [StringComparison]::Ordinal)) { throw 'Repository-relative path is a filesystem alias.' }

    return [pscustomobject][ordered]@{
        relativePath = $canonicalRelative
        fullPath = $cursor
        exists = ([IO.File]::Exists($cursor) -or [IO.Directory]::Exists($cursor))
    }
}

function Get-OperatorPathClassification {
    param(
        [Parameter(Mandatory = $true)]$Policy,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$RelativePath
    )
    try {
        $resolved = Resolve-OperatorRepositoryRelativePath -Policy $Policy -RelativePath $RelativePath
    }
    catch {
        return [pscustomobject][ordered]@{ classification = 'unsafe'; relativePath = $null; description = 'Path is unsafe or escapes the repository boundary.' }
    }
    $path = [string]$resolved.relativePath
    if ($path -ceq '.gitignore') { return [pscustomobject][ordered]@{ classification = 'blocked'; relativePath = $path; description = '.gitignore requires a separate explicit approval.' } }
    if ($path -ceq '.git' -or $path.StartsWith('.git/', [StringComparison]::OrdinalIgnoreCase)) { return [pscustomobject][ordered]@{ classification = 'blocked'; relativePath = $path; description = 'Git metadata is protected.' } }
    foreach ($prefix in @($Policy.allowedPrefixes)) {
        $prefixValue = [string]$prefix
        $prefixRoot = $prefixValue.TrimEnd('/')
        if ($path -ceq $prefixRoot -or $path.StartsWith($prefixValue, [StringComparison]::Ordinal)) {
            return [pscustomobject][ordered]@{ classification = 'allowed'; relativePath = $path; description = 'Path is inside an approved package-B area.' }
        }
    }
    return [pscustomobject][ordered]@{ classification = 'blocked'; relativePath = $path; description = 'Path is not explicitly allowed by package B.' }
}

function Test-OperatorPathAllowed {
    param(
        [Parameter(Mandatory = $true)]$Policy,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$RelativePath
    )
    $classification = Get-OperatorPathClassification -Policy $Policy -RelativePath $RelativePath
    return [pscustomobject][ordered]@{
        isAllowed = ([string]$classification.classification -ceq 'allowed')
        classification = [string]$classification.classification
        relativePath = $classification.relativePath
        description = [string]$classification.description
    }
}

function Test-OperatorChangedPathSet {
    param(
        [Parameter(Mandatory = $true)]$Policy,
        [Parameter(Mandatory = $true)][string[]]$RelativePaths
    )
    $results = @()
    foreach ($path in @($RelativePaths | Sort-Object -CaseSensitive -Unique)) {
        $results += Test-OperatorPathAllowed -Policy $Policy -RelativePath ([string]$path)
    }
    return [pscustomobject][ordered]@{ isAllowed = (@($results | Where-Object { -not $_.isAllowed }).Count -eq 0); paths = @($results) }
}

function Get-OperatorSecretHintRules {
    return @(
        [pscustomobject][ordered]@{ ruleId = 'PRIVATE_KEY_BLOCK'; severity = 'blocked'; description = 'A private-key block may be present.' },
        [pscustomobject][ordered]@{ ruleId = 'JWT_TOKEN'; severity = 'blocked'; description = 'A JWT-like token may be present.' },
        [pscustomobject][ordered]@{ ruleId = 'SUPABASE_TOKEN'; severity = 'blocked'; description = 'A Supabase access token may be present.' },
        [pscustomobject][ordered]@{ ruleId = 'GITHUB_TOKEN'; severity = 'blocked'; description = 'A GitHub token may be present.' },
        [pscustomobject][ordered]@{ ruleId = 'URL_CREDENTIALS'; severity = 'blocked'; description = 'Credentials may be embedded in a URL.' },
        [pscustomobject][ordered]@{ ruleId = 'PASSWORD_CONNECTION_STRING'; severity = 'blocked'; description = 'A connection string may contain a password.' },
        [pscustomobject][ordered]@{ ruleId = 'SENSITIVE_ASSIGNMENT'; severity = 'blocked'; description = 'A sensitive variable may contain a non-placeholder value.' }
    )
}

function Test-OperatorPlaceholderValue {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
    $trimmed = $Value.Trim().Trim('"', "'")
    if ([string]::IsNullOrWhiteSpace($trimmed)) { return $true }
    if ([regex]::IsMatch($trimmed, '^\$\{[A-Za-z_][A-Za-z0-9_]*\}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $true }
    if ([regex]::IsMatch($trimmed, '^\$env:[A-Za-z_][A-Za-z0-9_]*$', [Text.RegularExpressions.RegexOptions]::CultureInvariant -bor [Text.RegularExpressions.RegexOptions]::IgnoreCase)) { return $true }
    if ([regex]::IsMatch($trimmed, '^<[^>]*(?:placeholder|example|variable)[^>]*>$', [Text.RegularExpressions.RegexOptions]::CultureInvariant -bor [Text.RegularExpressions.RegexOptions]::IgnoreCase)) { return $true }
    if ([regex]::IsMatch($trimmed, '^(?:CHANGEME|example|example-value|test-only|dummy|dummy-value)$', [Text.RegularExpressions.RegexOptions]::CultureInvariant -bor [Text.RegularExpressions.RegexOptions]::IgnoreCase)) { return $true }
    if ([regex]::IsMatch($trimmed, '^(?:test-only|dummy|example)[-_][A-Za-z0-9._-]+$', [Text.RegularExpressions.RegexOptions]::CultureInvariant -bor [Text.RegularExpressions.RegexOptions]::IgnoreCase)) { return $true }
    return $false
}

function New-OperatorSecretFinding {
    param(
        [Parameter(Mandatory = $true)][string]$RuleId,
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][int]$LineNumber
    )
    $rule = @(Get-OperatorSecretHintRules | Where-Object { [string]$_.ruleId -ceq $RuleId })
    if ($rule.Count -ne 1) { throw 'Trusted secret rule lookup failed.' }
    return [pscustomobject][ordered]@{
        ruleId = $RuleId
        relativePath = $RelativePath
        lineNumber = $LineNumber
        severity = [string]$rule[0].severity
        description = [string]$rule[0].description
    }
}

function ConvertFrom-OperatorStrictTextBytes {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][byte[]]$Bytes)
    if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
        $encoding = New-Object Text.UnicodeEncoding($false, $true, $true)
        return $encoding.GetString($Bytes, 2, $Bytes.Length - 2)
    }
    if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) {
        $encoding = New-Object Text.UnicodeEncoding($true, $true, $true)
        return $encoding.GetString($Bytes, 2, $Bytes.Length - 2)
    }
    $offset = 0
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) { $offset = 3 }
    $encoding = New-Object Text.UTF8Encoding($false, $true)
    return $encoding.GetString($Bytes, $offset, $Bytes.Length - $offset)
}

function Read-OperatorBoundedFileBytes {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][ValidateRange(1, 1048576)][int]$MaximumBytes
    )
    $stream = $null
    try {
        $stream = [IO.File]::Open($LiteralPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        $buffer = New-Object byte[] ($MaximumBytes + 1)
        $totalRead = 0
        while ($totalRead -lt $buffer.Length) {
            $read = $stream.Read($buffer, $totalRead, $buffer.Length - $totalRead)
            if ($read -eq 0) { break }
            $totalRead += $read
        }
        if ($totalRead -gt $MaximumBytes) {
            return [pscustomobject][ordered]@{ isTooLarge = $true; bytes = $null }
        }
        $bytes = New-Object byte[] $totalRead
        if ($totalRead -gt 0) { [Array]::Copy($buffer, 0, $bytes, 0, $totalRead) }
        return [pscustomobject][ordered]@{ isTooLarge = $false; bytes = $bytes }
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Test-OperatorFileForSecretHints {
    param(
        [Parameter(Mandatory = $true)]$Policy,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )
    $resolved = Resolve-OperatorRepositoryRelativePath -Policy $Policy -RelativePath $RelativePath
    if (-not [IO.File]::Exists([string]$resolved.fullPath)) {
        return [pscustomobject][ordered]@{ status = 'skipped'; relativePath = [string]$resolved.relativePath; findings = @(); description = 'File is missing or is not a regular file.' }
    }
    $item = Get-Item -LiteralPath ([string]$resolved.fullPath) -Force -ErrorAction Stop
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        return [pscustomobject][ordered]@{ status = 'skipped'; relativePath = [string]$resolved.relativePath; findings = @(); description = 'Directories and reparse points are not scanned.' }
    }
    if ([int64]$item.Length -gt 1048576) {
        return [pscustomobject][ordered]@{ status = 'skipped'; relativePath = [string]$resolved.relativePath; findings = @(); description = 'File exceeds the secret-scan size limit.' }
    }
    try {
        $boundedRead = Read-OperatorBoundedFileBytes -LiteralPath $item.FullName -MaximumBytes 1048576
    }
    catch {
        return [pscustomobject][ordered]@{ status = 'skipped'; relativePath = [string]$resolved.relativePath; findings = @(); description = 'File could not be read safely.' }
    }
    if ($boundedRead.isTooLarge) {
        return [pscustomobject][ordered]@{ status = 'skipped'; relativePath = [string]$resolved.relativePath; findings = @(); description = 'File exceeds the secret-scan size limit.' }
    }
    $bytes = [byte[]]$boundedRead.bytes
    try {
        $text = ConvertFrom-OperatorStrictTextBytes -Bytes $bytes
    }
    catch {
        return [pscustomobject][ordered]@{ status = 'skipped'; relativePath = [string]$resolved.relativePath; findings = @(); description = 'File is binary or is not valid supported text.' }
    }
    if ($text.IndexOf([char]0) -ge 0) {
        return [pscustomobject][ordered]@{ status = 'skipped'; relativePath = [string]$resolved.relativePath; findings = @(); description = 'File appears to be binary.' }
    }

    $findings = New-Object 'Collections.Generic.List[object]'
    $seen = @{}
    $lines = @($text -split "`r?`n", -1)
    for ($index = 0; $index -lt $lines.Count; $index++) {
        $line = [string]$lines[$index]
        $lineNumber = $index + 1
        $ruleIds = New-Object 'Collections.Generic.List[string]'
        if ([regex]::IsMatch($line, '-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $ruleIds.Add('PRIVATE_KEY_BLOCK') }
        if ([regex]::IsMatch($line, '(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $ruleIds.Add('JWT_TOKEN') }
        if ([regex]::IsMatch($line, '(?<![A-Za-z0-9_])(?:sbp_|sb_secret_)[A-Za-z0-9_-]{12,}', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $ruleIds.Add('SUPABASE_TOKEN') }
        if ([regex]::IsMatch($line, '(?<![A-Za-z0-9_])(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}', [Text.RegularExpressions.RegexOptions]::CultureInvariant) -or [regex]::IsMatch($line, '(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{20,}', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $ruleIds.Add('GITHUB_TOKEN') }
        $urlCredentials = [regex]::Match($line, '[A-Za-z][A-Za-z0-9+.-]{0,31}://[^\s/:@]+:([^\s/@]+)@', [Text.RegularExpressions.RegexOptions]::CultureInvariant)
        if ($urlCredentials.Success -and -not (Test-OperatorPlaceholderValue -Value $urlCredentials.Groups[1].Value)) { $ruleIds.Add('URL_CREDENTIALS') }
        $connectionPassword = [regex]::Match($line, '(?i)(?:^|[;\s])(?:Password|Pwd)\s*=\s*([^;\s]+)', [Text.RegularExpressions.RegexOptions]::CultureInvariant)
        if ($connectionPassword.Success -and -not (Test-OperatorPlaceholderValue -Value $connectionPassword.Groups[1].Value)) { $ruleIds.Add('PASSWORD_CONNECTION_STRING') }
        $assignment = [regex]::Match($line, '(?i)(?:^|[\s,{;])(?:["'']?)(password|passwd|secret|token|api_key|private_key|service_role)(?:["'']?)\s*(?:=|:)\s*(.+?)\s*(?:[,;}]|$)', [Text.RegularExpressions.RegexOptions]::CultureInvariant)
        if ($assignment.Success -and -not (Test-OperatorPlaceholderValue -Value $assignment.Groups[2].Value)) { $ruleIds.Add('SENSITIVE_ASSIGNMENT') }
        foreach ($ruleId in @($ruleIds | Select-Object -Unique)) {
            $key = "$ruleId`n$lineNumber"
            if (-not $seen.ContainsKey($key)) {
                $seen[$key] = $true
                $findings.Add((New-OperatorSecretFinding -RuleId $ruleId -RelativePath ([string]$resolved.relativePath) -LineNumber $lineNumber))
            }
        }
    }
    return [pscustomobject][ordered]@{
        status = if ($findings.Count -eq 0) { 'clear' } else { 'blocked' }
        relativePath = [string]$resolved.relativePath
        findings = @($findings.ToArray())
        description = if ($findings.Count -eq 0) { 'No secret hints detected.' } else { 'One or more secret hints require review.' }
    }
}

function Test-OperatorSecretHints {
    param(
        [Parameter(Mandatory = $true)]$Policy,
        [Parameter(Mandatory = $true)][string[]]$RelativePaths
    )
    $files = @()
    $findings = @()
    foreach ($path in @($RelativePaths | Sort-Object -CaseSensitive -Unique)) {
        $result = Test-OperatorFileForSecretHints -Policy $Policy -RelativePath ([string]$path)
        $files += [pscustomobject][ordered]@{ relativePath = $result.relativePath; status = $result.status; description = $result.description }
        $findings += @($result.findings)
    }
    return [pscustomobject][ordered]@{ status = if ($findings.Count -eq 0) { 'clear' } else { 'blocked' }; findings = @($findings); files = @($files) }
}

function Get-OperatorForbiddenRemoteProjectRefs {
    return @($script:ForbiddenProjectRefs)
}

function Test-OperatorLocalDatabaseHost {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$HostValue)
    $host = $HostValue.Trim().Trim('"', "'")
    return $host -ceq 'localhost' -or $host -ceq '127.0.0.1' -or $host -ceq '::1' -or $host -ceq '[::1]'
}

function Test-OperatorValueForRemoteConnection {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
    $matches = New-Object 'Collections.Generic.List[string]'
    foreach ($projectRef in $script:ForbiddenProjectRefs) {
        if ($Value.IndexOf($projectRef, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $matches.Add('forbidden-project-ref') }
    }
    $uriMatches = [regex]::Matches($Value, '(?i)(?:https?|postgres(?:ql)?):\/\/[^\s"'']+', [Text.RegularExpressions.RegexOptions]::CultureInvariant)
    foreach ($uriMatch in $uriMatches) {
        $uri = $null
        if ([Uri]::TryCreate($uriMatch.Value, [UriKind]::Absolute, [ref]$uri)) {
            $host = [string]$uri.Host
            $isLocal = $host -ceq 'localhost' -or $host -ceq '127.0.0.1' -or $host -ceq '::1'
            if (-not $isLocal -and (($uri.Scheme -ceq 'postgres' -or $uri.Scheme -ceq 'postgresql') -or $host.EndsWith('.supabase.co', [StringComparison]::OrdinalIgnoreCase) -or $host.IndexOf('.pooler.supabase.com', [StringComparison]::OrdinalIgnoreCase) -ge 0)) {
                $matches.Add('remote-database-target')
            }
        }
    }
    $hostMatches = [regex]::Matches($Value, '(?i)(?:^|;)\s*(?:Host|Server|Data\s+Source|Address|Addr|Network\s+Address)\s*=\s*([^;]*)', [Text.RegularExpressions.RegexOptions]::CultureInvariant)
    foreach ($hostMatch in $hostMatches) {
        $hostValue = [string]$hostMatch.Groups[1].Value
        if (-not [string]::IsNullOrWhiteSpace($hostValue) -and -not (Test-OperatorLocalDatabaseHost -HostValue $hostValue)) {
            $matches.Add('remote-database-target')
        }
    }
    if ([regex]::IsMatch($Value, '(?i)(?:^|\s)--project-ref(?:=|\s+)(?:tpieykhhawszlzsoflnl|wplescvhlgctynkfwvrj)(?:\s|$)', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { $matches.Add('forbidden-project-argument') }
    return ,@($matches | Sort-Object -Unique)
}

function Test-OperatorLocalConnectionMetadata {
    param([Parameter(Mandatory = $true)][object[]]$Metadata)
    $findings = @()
    foreach ($item in $Metadata) {
        if ($null -eq $item -or $item -isnot [pscustomobject]) { throw 'Connection metadata item is malformed.' }
        $propertyNames = @($item.PSObject.Properties.Name)
        if ($propertyNames.Count -ne 2 -or $propertyNames -cnotcontains 'sourceId' -or $propertyNames -cnotcontains 'value') { throw 'Connection metadata item is malformed.' }
        if ($item.sourceId -isnot [string] -or -not [regex]::IsMatch([string]$item.sourceId, '^[a-z0-9][a-z0-9._-]{0,63}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Connection metadata item is malformed.' }
        if ($item.value -isnot [string]) { throw 'Connection metadata item is malformed.' }
        $safeSourceId = [string]$item.sourceId
        $categories = Test-OperatorValueForRemoteConnection -Value ([string]$item.value)
        foreach ($category in $categories) {
            $findings += [pscustomobject][ordered]@{ sourceId = $safeSourceId; category = [string]$category; description = 'Local mode forbids this remote connection target.' }
        }
    }
    return [pscustomobject][ordered]@{ status = if ($findings.Count -eq 0) { 'clear' } else { 'blocked' }; findings = @($findings) }
}

function Test-OperatorLocalEnvironmentVariables {
    param([Parameter(Mandatory = $true)][Collections.IDictionary]$Variables)
    $findings = @()
    foreach ($name in @($Variables.Keys | Sort-Object)) {
        $categories = Test-OperatorValueForRemoteConnection -Value ([string]$Variables[$name])
        foreach ($category in $categories) {
            $findings += [pscustomobject][ordered]@{ variableName = [string]$name; category = [string]$category; description = 'Environment variable points to a forbidden remote target.' }
        }
    }
    return [pscustomobject][ordered]@{ status = if ($findings.Count -eq 0) { 'clear' } else { 'blocked' }; findings = @($findings) }
}

function Test-OperatorSupabaseLinkState {
    param([Parameter(Mandatory = $true)]$Policy)
    $findings = @()
    $files = @()
    foreach ($relativePath in @('supabase/.temp/project-ref', '.supabase/project-ref')) {
        $resolved = Resolve-OperatorRepositoryRelativePath -Policy $Policy -RelativePath $relativePath
        if (-not [IO.File]::Exists([string]$resolved.fullPath)) {
            $files += [pscustomobject][ordered]@{ relativePath = $relativePath; status = 'missing' }
            continue
        }
        $item = Get-Item -LiteralPath ([string]$resolved.fullPath) -Force -ErrorAction Stop
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [int64]$item.Length -gt 256) {
            $files += [pscustomobject][ordered]@{ relativePath = $relativePath; status = 'blocked' }
            $findings += [pscustomobject][ordered]@{ relativePath = $relativePath; category = 'unsafe-link-file'; description = 'Supabase link state is not a small regular file.' }
            continue
        }
        try {
            $boundedRead = Read-OperatorBoundedFileBytes -LiteralPath $item.FullName -MaximumBytes 256
            if ($boundedRead.isTooLarge) { $value = $null } else { $value = (ConvertFrom-OperatorStrictTextBytes -Bytes ([byte[]]$boundedRead.bytes)).Trim() }
        }
        catch { $value = $null }
        if ($null -eq $value) {
            $files += [pscustomobject][ordered]@{ relativePath = $relativePath; status = 'blocked' }
            $findings += [pscustomobject][ordered]@{ relativePath = $relativePath; category = 'invalid-link-file'; description = 'Supabase link state is not valid text.' }
            continue
        }
        $isForbidden = $script:ForbiddenProjectRefs -ccontains $value
        $files += [pscustomobject][ordered]@{ relativePath = $relativePath; status = if ($isForbidden) { 'blocked' } else { 'clear' } }
        if ($isForbidden) { $findings += [pscustomobject][ordered]@{ relativePath = $relativePath; category = 'forbidden-project-ref'; description = 'Supabase link state points to a forbidden remote project.' } }
    }
    return [pscustomobject][ordered]@{ status = if ($findings.Count -eq 0) { 'clear' } else { 'blocked' }; findings = @($findings); files = @($files) }
}

function Get-OperatorAllowedReadOnlyGitTargets {
    $copy = @()
    foreach ($target in $script:AllowedGitTargets) { $copy += [pscustomobject][ordered]@{ targetId = [string]$target.targetId; arguments = @($target.arguments) } }
    return $copy
}

function Test-OperatorGitTargetAllowed {
    param([Parameter(Mandatory = $true)][string]$TargetId)
    $matches = @($script:AllowedGitTargets | Where-Object { [string]$_.targetId -ceq $TargetId })
    return [pscustomobject][ordered]@{ isAllowed = ($matches.Count -eq 1); targetId = $TargetId; description = if ($matches.Count -eq 1) { 'Registered read-only Git target.' } else { 'Git target is not registered for package B.' } }
}

function Test-OperatorGitArgumentsReadOnly {
    param(
        [Parameter(Mandatory = $true)][string]$TargetId,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $matches = @($script:AllowedGitTargets | Where-Object { [string]$_.targetId -ceq $TargetId })
    $allowed = $matches.Count -eq 1
    if ($allowed) {
        $expected = @($matches[0].arguments)
        if ($Arguments.Count -ne $expected.Count) { $allowed = $false }
        else {
            for ($index = 0; $index -lt $Arguments.Count; $index++) {
                if ([string]$Arguments[$index] -cne [string]$expected[$index]) { $allowed = $false; break }
            }
        }
    }
    return [pscustomobject][ordered]@{ isAllowed = $allowed; targetId = $TargetId; description = if ($allowed) { 'Arguments exactly match the registered read-only Git target.' } else { 'Arguments are not an exact registered read-only Git operation.' } }
}

Export-ModuleMember -Function @(
    'New-OperatorPathPolicy',
    'Resolve-OperatorRepositoryRelativePath',
    'Test-OperatorPathAllowed',
    'Test-OperatorChangedPathSet',
    'Get-OperatorPathClassification',
    'Get-OperatorSecretHintRules',
    'Test-OperatorSecretHints',
    'Test-OperatorFileForSecretHints',
    'Get-OperatorForbiddenRemoteProjectRefs',
    'Test-OperatorLocalConnectionMetadata',
    'Test-OperatorLocalEnvironmentVariables',
    'Test-OperatorSupabaseLinkState',
    'Get-OperatorAllowedReadOnlyGitTargets',
    'Test-OperatorGitTargetAllowed',
    'Test-OperatorGitArgumentsReadOnly'
)
