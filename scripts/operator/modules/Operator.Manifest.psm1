Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:MaximumJsonDepth = 32
$script:MaximumManifestBytes = 1048576
$script:SupportedSchemaKeywords = @(
    '$schema', '$id', 'title', 'description', 'type', 'required', 'properties',
    'additionalProperties', 'enum', 'pattern', 'minLength', 'maxLength',
    'minimum', 'minItems', 'maxItems', 'uniqueItems', 'items',
    'minProperties', 'maxProperties'
)

function Get-OperatorManifestSchemaPath {
    return [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', 'schemas', 'manifest-v1.schema.json'))
}

function Get-OperatorResultSchemaPath {
    return [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', 'schemas', 'result-v1.schema.json'))
}

function Get-OperatorMaximumManifestBytes {
    return [int64]$script:MaximumManifestBytes
}

function Get-OperatorFileSha256 {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    $item = Get-Item -LiteralPath $LiteralPath -ErrorAction Stop
    if ($item.PSIsContainer) { throw "Path '$LiteralPath' is not a file." }
    $bytes = [IO.File]::ReadAllBytes($item.FullName)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $hash = $algorithm.ComputeHash($bytes)
        return ([BitConverter]::ToString($hash).Replace('-', '').ToLowerInvariant())
    }
    finally {
        $algorithm.Dispose()
    }
}

function ConvertFrom-OperatorUtf8Bytes {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)
    $offset = 0
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
        $offset = 3
    }
    $encoding = New-Object Text.UTF8Encoding($false, $true)
    try {
        return $encoding.GetString($Bytes, $offset, ($Bytes.Length - $offset))
    }
    catch [Text.DecoderFallbackException] {
        throw 'JSON input is not valid UTF-8.'
    }
}

function Skip-OperatorJsonWhitespace {
    param([string]$Text, [ref]$Index)
    while ($Index.Value -lt $Text.Length) {
        $character = $Text[$Index.Value]
        if ($character -ne ' ' -and $character -ne "`t" -and $character -ne "`r" -and $character -ne "`n") { break }
        $Index.Value++
    }
}

function Read-OperatorJsonStringToken {
    param([string]$Text, [ref]$Index)
    if ($Index.Value -ge $Text.Length -or $Text[$Index.Value] -ne '"') { throw "Expected JSON string at character $($Index.Value)." }
    $start = $Index.Value
    $Index.Value++
    while ($Index.Value -lt $Text.Length) {
        $character = $Text[$Index.Value]
        if ($character -eq '"') {
            $Index.Value++
            $token = $Text.Substring($start, $Index.Value - $start)
            try { return ($token | ConvertFrom-Json -ErrorAction Stop) }
            catch { throw "Invalid JSON string at character $start." }
        }
        if ([int][char]$character -lt 0x20) { throw "Unescaped control character in JSON string at character $($Index.Value)." }
        if ($character -eq '\') {
            $Index.Value++
            if ($Index.Value -ge $Text.Length) { throw "Incomplete JSON escape at character $($Index.Value)." }
            $escape = $Text[$Index.Value]
            if ('"\/bfnrt'.IndexOf($escape) -ge 0) {
                $Index.Value++
                continue
            }
            if ($escape -eq 'u') {
                if (($Index.Value + 4) -ge $Text.Length) { throw "Incomplete Unicode escape at character $($Index.Value)." }
                $hex = $Text.Substring($Index.Value + 1, 4)
                if ($hex -notmatch '^[0-9a-fA-F]{4}$') { throw "Invalid Unicode escape at character $($Index.Value)." }
                $Index.Value += 5
                continue
            }
            throw "Invalid JSON escape at character $($Index.Value)."
        }
        $Index.Value++
    }
    throw "Unterminated JSON string at character $start."
}

function Read-OperatorJsonValue {
    param([string]$Text, [ref]$Index, [int]$Depth, [string]$Path)
    if ($Depth -gt $script:MaximumJsonDepth) { throw "JSON exceeds maximum recursion depth $($script:MaximumJsonDepth) at $Path." }
    Skip-OperatorJsonWhitespace -Text $Text -Index $Index
    if ($Index.Value -ge $Text.Length) { throw "Unexpected end of JSON at $Path." }
    $character = $Text[$Index.Value]

    if ($character -eq '"') { $null = Read-OperatorJsonStringToken -Text $Text -Index $Index; return }
    if ($character -eq '{') {
        $Index.Value++
        $names = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
        Skip-OperatorJsonWhitespace -Text $Text -Index $Index
        if ($Index.Value -lt $Text.Length -and $Text[$Index.Value] -eq '}') { $Index.Value++; return }
        while ($true) {
            Skip-OperatorJsonWhitespace -Text $Text -Index $Index
            $name = [string](Read-OperatorJsonStringToken -Text $Text -Index $Index)
            $propertyPath = if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$') { "$Path.$name" } else { "$Path['$name']" }
            if (-not $names.Add($name)) { throw "Duplicate JSON property '$name' at $propertyPath." }
            Skip-OperatorJsonWhitespace -Text $Text -Index $Index
            if ($Index.Value -ge $Text.Length -or $Text[$Index.Value] -ne ':') { throw "Expected ':' after property at $propertyPath." }
            $Index.Value++
            Read-OperatorJsonValue -Text $Text -Index $Index -Depth ($Depth + 1) -Path $propertyPath
            Skip-OperatorJsonWhitespace -Text $Text -Index $Index
            if ($Index.Value -ge $Text.Length) { throw "Unterminated JSON object at $Path." }
            if ($Text[$Index.Value] -eq '}') { $Index.Value++; return }
            if ($Text[$Index.Value] -ne ',') { throw "Expected ',' or '}' at $Path." }
            $Index.Value++
            Skip-OperatorJsonWhitespace -Text $Text -Index $Index
            if ($Index.Value -lt $Text.Length -and $Text[$Index.Value] -eq '}') { throw "Trailing comma in JSON object at $Path." }
        }
    }
    if ($character -eq '[') {
        $Index.Value++
        $elementIndex = 0
        Skip-OperatorJsonWhitespace -Text $Text -Index $Index
        if ($Index.Value -lt $Text.Length -and $Text[$Index.Value] -eq ']') { $Index.Value++; return }
        while ($true) {
            Read-OperatorJsonValue -Text $Text -Index $Index -Depth ($Depth + 1) -Path "$Path[$elementIndex]"
            $elementIndex++
            Skip-OperatorJsonWhitespace -Text $Text -Index $Index
            if ($Index.Value -ge $Text.Length) { throw "Unterminated JSON array at $Path." }
            if ($Text[$Index.Value] -eq ']') { $Index.Value++; return }
            if ($Text[$Index.Value] -ne ',') { throw "Expected ',' or ']' at $Path." }
            $Index.Value++
            Skip-OperatorJsonWhitespace -Text $Text -Index $Index
            if ($Index.Value -lt $Text.Length -and $Text[$Index.Value] -eq ']') { throw "Trailing comma in JSON array at $Path." }
        }
    }

    foreach ($literal in @('true', 'false', 'null')) {
        if (($Index.Value + $literal.Length) -le $Text.Length -and $Text.Substring($Index.Value, $literal.Length) -ceq $literal) {
            $Index.Value += $literal.Length
            return
        }
    }
    $numberMatch = [regex]::Match($Text.Substring($Index.Value), '^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?')
    if ($numberMatch.Success) { $Index.Value += $numberMatch.Length; return }
    throw "Invalid JSON token at character $($Index.Value) ($Path)."
}

function ConvertFrom-OperatorStrictJson {
    param([Parameter(Mandatory = $true)][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { throw 'JSON input is empty.' }
    $index = 0
    Read-OperatorJsonValue -Text $Text -Index ([ref]$index) -Depth 0 -Path '$'
    Skip-OperatorJsonWhitespace -Text $Text -Index ([ref]$index)
    if ($index -ne $Text.Length) { throw "Unexpected content after JSON value at character $index." }
    try {
        Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop
        $serializer = New-Object Web.Script.Serialization.JavaScriptSerializer
        $serializer.MaxJsonLength = [Math]::Max($Text.Length, 1024)
        return ConvertTo-OperatorPowerShellJsonValue -Value ($serializer.DeserializeObject($Text))
    }
    catch { throw "JSON parsing failed: $($_.Exception.Message)" }
}

function ConvertTo-OperatorPowerShellJsonValue {
    param($Value)
    if ($Value -is [Collections.IDictionary]) {
        $convertedObject = [ordered]@{}
        foreach ($key in $Value.Keys) {
            $convertedObject[[string]$key] = ConvertTo-OperatorPowerShellJsonValue -Value $Value[$key]
        }
        return [pscustomobject]$convertedObject
    }
    if ($Value -is [System.Array] -or ($Value -is [Collections.IList] -and $Value -isnot [string])) {
        $convertedArray = @()
        foreach ($item in $Value) { $convertedArray += ,(ConvertTo-OperatorPowerShellJsonValue -Value $item) }
        return ,$convertedArray
    }
    return $Value
}

function Get-OperatorPropertyNames {
    param($Value)
    if ($Value -is [Collections.IDictionary]) { return ,@($Value.Keys | ForEach-Object { [string]$_ }) }
    return ,@($Value.PSObject.Properties | ForEach-Object { [string]$_.Name })
}

function Get-OperatorPropertyValue {
    param($Value, [string]$Name)
    if ($Value -is [Collections.IDictionary]) {
        $dictionaryValue = $Value[$Name]
        if ($dictionaryValue -is [System.Array]) { return ,$dictionaryValue }
        return $dictionaryValue
    }
    $property = $Value.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    if ($property.Value -is [System.Array]) { return ,$property.Value }
    return $property.Value
}

function Test-OperatorObjectValue {
    param($Value)
    return ($null -ne $Value -and (($Value -is [Collections.IDictionary]) -or ($Value -is [pscustomobject])))
}

function Test-OperatorIntegerValue {
    param($Value)
    return ($Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64])
}

function Assert-OperatorSchemaKeywords {
    param($Schema, [int]$Depth, [string]$Path)
    if ($Depth -gt $script:MaximumJsonDepth) { throw "Schema exceeds maximum recursion depth at $Path." }
    if (-not (Test-OperatorObjectValue -Value $Schema)) { throw "Schema node at $Path must be an object." }
    foreach ($keyword in (Get-OperatorPropertyNames -Value $Schema)) {
        if ($script:SupportedSchemaKeywords -cnotcontains $keyword) { throw "Unsupported schema keyword '$keyword' at $Path." }
    }
    $names = Get-OperatorPropertyNames -Value $Schema
    if ($names -ccontains 'properties') {
        $properties = Get-OperatorPropertyValue -Value $Schema -Name 'properties'
        if (-not (Test-OperatorObjectValue -Value $properties)) { throw "Schema properties at $Path must be an object." }
        foreach ($propertyName in (Get-OperatorPropertyNames -Value $properties)) {
            Assert-OperatorSchemaKeywords -Schema (Get-OperatorPropertyValue -Value $properties -Name $propertyName) -Depth ($Depth + 1) -Path "$Path.properties.$propertyName"
        }
    }
    if ($names -ccontains 'items') {
        Assert-OperatorSchemaKeywords -Schema (Get-OperatorPropertyValue -Value $Schema -Name 'items') -Depth ($Depth + 1) -Path "$Path.items"
    }
}

function Add-OperatorValidationError {
    param([Collections.Generic.List[string]]$Errors, [string]$Message)
    $Errors.Add($Message)
}

function Test-OperatorNumberValue {
    param($Value)
    return (Test-OperatorIntegerValue -Value $Value) -or $Value -is [decimal] -or $Value -is [double] -or $Value -is [single]
}

function ConvertTo-OperatorCanonicalJson {
    param($Value, [int]$Depth = 0)
    if ($Depth -gt $script:MaximumJsonDepth) { throw "Canonical JSON exceeds maximum recursion depth $($script:MaximumJsonDepth)." }
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [bool]) {
        if ($Value) { return 'true' }
        return 'false'
    }
    if ($Value -is [string]) { return (ConvertTo-Json -InputObject $Value -Compress) }
    if (Test-OperatorNumberValue -Value $Value) {
        if ($Value -is [double] -or $Value -is [single]) {
            $number = [double]$Value
            if ([double]::IsNaN($number) -or [double]::IsInfinity($number)) { throw 'Non-finite numbers are not valid JSON values.' }
            return $number.ToString('R', [Globalization.CultureInfo]::InvariantCulture).ToLowerInvariant().Replace('e+', 'e')
        }
        if ($Value -is [decimal]) { return ([decimal]$Value).ToString('G29', [Globalization.CultureInfo]::InvariantCulture) }
        return [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture)
    }
    if (Test-OperatorObjectValue -Value $Value) {
        $names = Get-OperatorPropertyNames -Value $Value
        [Array]::Sort($names, [StringComparer]::Ordinal)
        $parts = @()
        foreach ($name in $names) {
            $canonicalName = ConvertTo-Json -InputObject ([string]$name) -Compress
            $canonicalValue = ConvertTo-OperatorCanonicalJson -Value (Get-OperatorPropertyValue -Value $Value -Name $name) -Depth ($Depth + 1)
            $parts += ($canonicalName + ':' + $canonicalValue)
        }
        return ('{' + ($parts -join ',') + '}')
    }
    if ($Value -is [System.Array] -or ($Value -is [Collections.IList] -and $Value -isnot [string])) {
        $parts = @()
        foreach ($item in $Value) { $parts += ConvertTo-OperatorCanonicalJson -Value $item -Depth ($Depth + 1) }
        return ('[' + ($parts -join ',') + ']')
    }
    throw "Unsupported JSON value type '$($Value.GetType().FullName)'."
}

function Test-OperatorJsonEquivalent {
    param($Left, $Right)
    return ((ConvertTo-OperatorCanonicalJson -Value $Left) -ceq (ConvertTo-OperatorCanonicalJson -Value $Right))
}

function Invoke-OperatorSchemaValidation {
    param($Value, $Schema, [string]$Path, [int]$Depth, [Collections.Generic.List[string]]$Errors)
    if ($Depth -gt $script:MaximumJsonDepth) { Add-OperatorValidationError $Errors "${Path}: maximum recursion depth exceeded."; return }
    $schemaNames = Get-OperatorPropertyNames -Value $Schema

    if ($schemaNames -ccontains 'type') {
        $expected = [string](Get-OperatorPropertyValue -Value $Schema -Name 'type')
        $typeValid = switch -CaseSensitive ($expected) {
            'object' { Test-OperatorObjectValue -Value $Value; break }
            'array' { $Value -is [System.Array]; break }
            'string' { $Value -is [string]; break }
            'integer' { Test-OperatorIntegerValue -Value $Value; break }
            'boolean' { $Value -is [bool]; break }
            default { throw "Unsupported schema type '$expected' at $Path." }
        }
        if (-not $typeValid) { Add-OperatorValidationError $Errors "${Path}: expected type $expected."; return }
    }

    if ($schemaNames -ccontains 'enum') {
        $matched = $false
        foreach ($candidate in (Get-OperatorPropertyValue -Value $Schema -Name 'enum')) {
            if (Test-OperatorJsonEquivalent -Left $Value -Right $candidate) { $matched = $true; break }
        }
        if (-not $matched) { Add-OperatorValidationError $Errors "${Path}: value is not in the allowed enum." }
    }

    if ($Value -is [string]) {
        if ($schemaNames -ccontains 'minLength' -and $Value.Length -lt [int](Get-OperatorPropertyValue $Schema 'minLength')) { Add-OperatorValidationError $Errors "${Path}: string is shorter than minLength." }
        if ($schemaNames -ccontains 'maxLength' -and $Value.Length -gt [int](Get-OperatorPropertyValue $Schema 'maxLength')) { Add-OperatorValidationError $Errors "${Path}: string is longer than maxLength." }
        if ($schemaNames -ccontains 'pattern') {
            $pattern = [string](Get-OperatorPropertyValue $Schema 'pattern')
            if (-not [regex]::IsMatch($Value, $pattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { Add-OperatorValidationError $Errors "${Path}: string does not match the required pattern." }
        }
    }

    if ((Test-OperatorIntegerValue -Value $Value) -and $schemaNames -ccontains 'minimum') {
        if ([decimal]$Value -lt [decimal](Get-OperatorPropertyValue $Schema 'minimum')) { Add-OperatorValidationError $Errors "${Path}: number is below minimum." }
    }

    if (Test-OperatorObjectValue -Value $Value) {
        $valueNames = Get-OperatorPropertyNames -Value $Value
        if ($schemaNames -ccontains 'minProperties' -and $valueNames.Count -lt [int](Get-OperatorPropertyValue $Schema 'minProperties')) { Add-OperatorValidationError $Errors "${Path}: object has fewer than minProperties." }
        if ($schemaNames -ccontains 'maxProperties' -and $valueNames.Count -gt [int](Get-OperatorPropertyValue $Schema 'maxProperties')) { Add-OperatorValidationError $Errors "${Path}: object has more than maxProperties." }
        if ($schemaNames -ccontains 'required') {
            foreach ($requiredName in (Get-OperatorPropertyValue -Value $Schema -Name 'required')) {
                if ($valueNames -cnotcontains [string]$requiredName) { Add-OperatorValidationError $Errors "${Path}: required property '$requiredName' is missing." }
            }
        }
        $schemaProperties = $null
        $knownNames = @()
        if ($schemaNames -ccontains 'properties') {
            $schemaProperties = Get-OperatorPropertyValue -Value $Schema -Name 'properties'
            $knownNames = Get-OperatorPropertyNames -Value $schemaProperties
            foreach ($propertyName in $knownNames) {
                if ($valueNames -ccontains $propertyName) {
                    Invoke-OperatorSchemaValidation -Value (Get-OperatorPropertyValue -Value $Value -Name $propertyName) -Schema (Get-OperatorPropertyValue -Value $schemaProperties -Name $propertyName) -Path "$Path.$propertyName" -Depth ($Depth + 1) -Errors $Errors
                }
            }
        }
        if ($schemaNames -ccontains 'additionalProperties' -and (Get-OperatorPropertyValue -Value $Schema -Name 'additionalProperties') -eq $false) {
            foreach ($valueName in $valueNames) {
                if ($knownNames -cnotcontains $valueName) { Add-OperatorValidationError $Errors "${Path}.${valueName}: additional property is not allowed." }
            }
        }
    }

    if ($Value -is [System.Array]) {
        if ($schemaNames -ccontains 'minItems' -and $Value.Count -lt [int](Get-OperatorPropertyValue $Schema 'minItems')) { Add-OperatorValidationError $Errors "${Path}: array has fewer than minItems." }
        if ($schemaNames -ccontains 'maxItems' -and $Value.Count -gt [int](Get-OperatorPropertyValue $Schema 'maxItems')) { Add-OperatorValidationError $Errors "${Path}: array has more than maxItems." }
        if ($schemaNames -ccontains 'uniqueItems' -and (Get-OperatorPropertyValue $Schema 'uniqueItems') -eq $true) {
            $seen = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
            for ($i = 0; $i -lt $Value.Count; $i++) {
                $canonical = ConvertTo-OperatorCanonicalJson -Value $Value[$i]
                if (-not $seen.Add($canonical)) { Add-OperatorValidationError $Errors "${Path}[$i]: duplicate array item." }
            }
        }
        if ($schemaNames -ccontains 'items') {
            $itemSchema = Get-OperatorPropertyValue -Value $Schema -Name 'items'
            for ($i = 0; $i -lt $Value.Count; $i++) {
                Invoke-OperatorSchemaValidation -Value $Value[$i] -Schema $itemSchema -Path "$Path[$i]" -Depth ($Depth + 1) -Errors $Errors
            }
        }
    }
}

function Read-OperatorSchema {
    param([Parameter(Mandatory = $true)][string]$LiteralPath)
    $item = Get-Item -LiteralPath $LiteralPath -ErrorAction Stop
    if ($item.PSIsContainer) { throw "Schema path '$LiteralPath' is not a file." }
    $text = ConvertFrom-OperatorUtf8Bytes -Bytes ([IO.File]::ReadAllBytes($item.FullName))
    $schema = ConvertFrom-OperatorStrictJson -Text $text
    Assert-OperatorSchemaKeywords -Schema $schema -Depth 0 -Path '$schema'
    return $schema
}

function Test-OperatorJsonSchema {
    param(
        [Parameter(Mandatory = $true)]$InputObject,
        [Parameter(Mandatory = $true)][string]$SchemaPath
    )
    try {
        $schema = Read-OperatorSchema -LiteralPath $SchemaPath
        $errors = New-Object 'Collections.Generic.List[string]'
        Invoke-OperatorSchemaValidation -Value $InputObject -Schema $schema -Path '$' -Depth 0 -Errors $errors
        return [pscustomobject][ordered]@{
            IsValid = ($errors.Count -eq 0)
            Errors = @($errors.ToArray())
        }
    }
    catch {
        $schemaException = New-Object System.InvalidOperationException('Trusted operator schema processing failed.', $_.Exception)
        $schemaException.Data['OperatorErrorKind'] = 'TrustedSchema'
        throw $schemaException
    }
}

function Import-OperatorManifest {
    param([Parameter(Mandatory = $true)][string]$ManifestPath)
    if ([string]::IsNullOrWhiteSpace([string]$ManifestPath)) { throw 'ManifestPath must not be empty.' }
    $item = Get-Item -LiteralPath $ManifestPath -ErrorAction Stop
    if ($item.PSIsContainer) { throw "Manifest path '$ManifestPath' is not a file." }
    if ($item.Length -gt $script:MaximumManifestBytes) { throw "Manifest exceeds the maximum size of $($script:MaximumManifestBytes) bytes." }
    $bytes = [IO.File]::ReadAllBytes($item.FullName)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { $sha256 = [BitConverter]::ToString($algorithm.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
    $text = ConvertFrom-OperatorUtf8Bytes -Bytes $bytes
    $manifest = ConvertFrom-OperatorStrictJson -Text $text
    $validation = Test-OperatorJsonSchema -InputObject $manifest -SchemaPath (Get-OperatorManifestSchemaPath)
    if (-not $validation.IsValid) { throw ('Manifest schema validation failed: ' + ($validation.Errors -join ' ')) }
    $snapshot = ConvertTo-Json -InputObject $manifest -Depth 32
    return [pscustomobject][ordered]@{
        Manifest = $manifest
        FullPath = $item.FullName
        Sha256 = $sha256
        SnapshotJson = $snapshot
        SchemaVersion = [int]$manifest.schemaVersion
        OperatorVersion = [string]$manifest.operatorVersion
    }
}

Export-ModuleMember -Function @(
    'Get-OperatorFileSha256',
    'Test-OperatorJsonSchema',
    'Import-OperatorManifest',
    'Get-OperatorManifestSchemaPath',
    'Get-OperatorResultSchemaPath',
    'Get-OperatorMaximumManifestBytes'
)
