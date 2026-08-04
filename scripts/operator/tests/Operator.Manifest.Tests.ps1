. ([IO.Path]::Combine($PSScriptRoot, 'Test.Helpers.ps1'))

Describe 'Operator manifest acceptance' {
    BeforeAll { $manifestModule = Import-D2Module -Name 'Operator.Manifest.psm1'; $orchestrationModule = Import-D2Module -Name 'Operator.Orchestration.psm1' }
    AfterAll { Clear-D2TestState }

    Context 'strict manifest import' {
        It 'accepts the schema-1 production manifest as a closed import contract' {
            $path = Write-D2Manifest -LiteralPath ([IO.Path]::Combine($TestDrive, 'valid.json')) -Manifest (New-D2ManifestObject)
            $actual = Import-OperatorManifest -ManifestPath $path
            @($actual.PSObject.Properties.Name).Count | Should Be 6
            @($actual.PSObject.Properties.Name) -join ',' | Should BeExactly 'Manifest,FullPath,Sha256,SnapshotJson,SchemaVersion,OperatorVersion'
            $actual.SchemaVersion | Should Be 1
            $actual.Sha256 | Should Match '^[a-f0-9]{64}$'
        }

        It 'accepts a manifest at the exact maximum byte size' {
            $path = [IO.Path]::Combine($TestDrive, 'maximum.json'); $json = ConvertTo-Json (New-D2ManifestObject) -Depth 12 -Compress
            $maximum = Get-OperatorMaximumManifestBytes; $bytes = New-Object byte[] $maximum; $encoded = (New-Object Text.UTF8Encoding($false)).GetBytes($json)
            [Array]::Copy($encoded, $bytes, $encoded.Length); for ($index = $encoded.Length; $index -lt $maximum; $index++) { $bytes[$index] = 0x20 }
            [IO.File]::WriteAllBytes($path, $bytes)
            (Import-OperatorManifest -ManifestPath $path).SchemaVersion | Should Be 1
        }

        It 'rejects a manifest one byte above the maximum' {
            $path = [IO.Path]::Combine($TestDrive, 'oversize.json'); [IO.File]::WriteAllBytes($path, (New-Object byte[] ((Get-OperatorMaximumManifestBytes) + 1)))
            { Import-OperatorManifest -ManifestPath $path } | Should Throw
        }

        It 'rejects invalid UTF-8' {
            $path = [IO.Path]::Combine($TestDrive, 'invalid-utf8.json'); [IO.File]::WriteAllBytes($path, [byte[]]@(0x7B, 0x22, 0xC3, 0x28, 0x7D))
            { Import-OperatorManifest -ManifestPath $path } | Should Throw
        }

        It 'rejects duplicate JSON properties' {
            $path = Write-D2DuplicatePropertyManifest -LiteralPath ([IO.Path]::Combine($TestDrive, 'duplicate.json'))
            { Import-OperatorManifest -ManifestPath $path } | Should Throw
        }

        It 'rejects syntactically invalid JSON' {
            $path = Write-D2InvalidJson -LiteralPath ([IO.Path]::Combine($TestDrive, 'invalid.json'))
            { Import-OperatorManifest -ManifestPath $path } | Should Throw
        }
    }

    Context 'closed schema and trusted matrix' {
        $invalidCases = @(
            @{ Name = 'command'; Mutate = { param($m) Add-Member -InputObject $m -NotePropertyName command -NotePropertyValue 'npm test' } },
            @{ Name = 'scriptBlock'; Mutate = { param($m) Add-Member -InputObject $m.stages.SelfTest.checks[0] -NotePropertyName scriptBlock -NotePropertyValue '{ exit }' } },
            @{ Name = 'arguments'; Mutate = { param($m) Add-Member -InputObject $m.stages.SelfTest.checks[0] -NotePropertyName arguments -NotePropertyValue @('--force') } },
            @{ Name = 'url'; Mutate = { param($m) Add-Member -InputObject $m -NotePropertyName url -NotePropertyValue 'https://example.invalid' } },
            @{ Name = 'secret'; Mutate = { param($m) Add-Member -InputObject $m -NotePropertyName secret -NotePropertyValue 'not-a-secret' } },
            @{ Name = 'unknown stage'; Mutate = { param($m) Add-Member -InputObject $m.stages -NotePropertyName Unknown -NotePropertyValue $m.stages.SelfTest } },
            @{ Name = 'empty stage'; Mutate = { param($m) $m.stages.SelfTest.checks = @() } },
            @{ Name = 'timeout profile'; Mutate = { param($m) $m.stages.SelfTest.checks[0].timeoutProfile = 'forever' } },
            @{ Name = 'required value'; Mutate = { param($m) $m.stages.SelfTest.checks[0].required = 'true' } }
        )
        foreach ($invalidCase in $invalidCases) {
            It ('rejects ' + $invalidCase.Name) {
                $manifest = New-D2ManifestObject; & $invalidCase.Mutate $manifest
                $path = Write-D2Manifest -LiteralPath ([IO.Path]::Combine($TestDrive, (($invalidCase.Name -replace ' ', '-') + '.json'))) -Manifest $manifest
                { Import-OperatorManifest -ManifestPath $path } | Should Throw
            }
        }
    }

    Context 'bound manifest integrity' {
        It 'accepts an unchanged imported manifest' {
            $path = Write-D2Manifest -LiteralPath ([IO.Path]::Combine($TestDrive, 'bound.json')) -Manifest (New-D2ManifestObject); $import = Import-OperatorManifest $path
            (Test-OperatorBoundManifestBinding -ManifestImport $import).isValid | Should Be $true
        }

        It 'reports external mutation as invocation integrity failure' {
            $path = Write-D2Manifest -LiteralPath ([IO.Path]::Combine($TestDrive, 'mutated.json')) -Manifest (New-D2ManifestObject); $import = Import-OperatorManifest $path
            [IO.File]::AppendAllText($path, ' ')
            $binding = Test-OperatorBoundManifestBinding -ManifestImport $import
            $binding.isValid | Should Be $false; $binding.errorKind | Should BeExactly 'invocation'; $binding.reasonCode | Should BeExactly 'manifest-hash-mismatch'
        }

        It 'reports a malformed import contract as internal error' {
            $binding = Test-OperatorBoundManifestBinding -ManifestImport ([pscustomobject]@{ Sha256 = ('a' * 64) })
            $binding.isValid | Should Be $false; $binding.errorKind | Should BeExactly 'internal'; $binding.reasonCode | Should BeExactly 'manifest-binding-contract-error'
        }

        It 'preserves a blocked state over a later external mutation' {
            $state = [pscustomobject][ordered]@{ status = 'blocked'; exitCode = [int]20; errorKind = 'none'; reasonCode = 'prior-blocker' }
            $binding = [pscustomobject][ordered]@{ schemaVersion = [int]1; isValid = $false; errorKind = 'invocation'; reasonCode = 'manifest-hash-mismatch' }
            (Merge-OperatorFinalManifestBindingState -CurrentState $state -BindingResult $binding).reasonCode | Should BeExactly 'prior-blocker'
        }

        It 'does not invoke a handler after a binding failure' {
            InModuleScope Operator.Orchestration {
                Mock Test-OperatorBoundManifestBinding { [pscustomobject][ordered]@{ schemaVersion = [int]1; isValid = $false; errorKind = 'invocation'; reasonCode = 'manifest-hash-mismatch' } }
                Mock Get-OperatorCheckRegistration { throw 'handler lookup must not happen' }
                $state = [pscustomobject][ordered]@{ status = 'passed'; exitCode = [int]0; errorKind = 'none'; reasonCode = 'stage-passed' }
                $actual = Merge-M000R1StageManifestBindingState -CurrentState $state -ManifestImport ([pscustomobject]@{})
                $actual.exitCode | Should Be 30
                Assert-MockCalled Get-OperatorCheckRegistration -Times 0 -Exactly
            }
        }
    }
}
