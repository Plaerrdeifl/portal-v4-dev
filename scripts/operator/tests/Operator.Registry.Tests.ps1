. ([IO.Path]::Combine($PSScriptRoot, 'Test.Helpers.ps1'))

Describe 'Operator registry acceptance' {
    BeforeEach { Remove-D2Modules; $coreModule = Import-D2Module -Name 'Operator.Core.psm1'; $processModule = Import-D2Module -Name 'Operator.Process.psm1'; $checksModule = Import-D2ChecksModule }
    AfterEach { Clear-D2TestState }

    Context 'trusted process target registry' {
        It 'contains exactly 13 targets in ordinal order' {
            $expected = @('npm.test','npm.check-frontend','npm.check-static','npm.build','fixture.exit-success','fixture.stderr-success','fixture.exit-failure','fixture.health-ready','fixture.health-failure','fixture.timeout','fixture.child-tree','fixture.secret-output','fixture.large-output')
            $actual = @(Get-OperatorProcessTargetRegistrySnapshot)
            $actual.Count | Should Be 13; (@($actual.targetId) -join ',') | Should BeExactly ($expected -join ',')
        }
        It 'assigns local-build only to npm.build and inherit to all other targets' {
            $actual = @(Get-OperatorProcessTargetRegistrySnapshot)
            (@($actual | Where-Object { $_.targetId -ceq 'npm.build' })).Count | Should Be 1
            (@($actual | Where-Object { $_.targetId -ceq 'npm.build' }))[0].environmentProfile | Should BeExactly 'local-build'
            @($actual | Where-Object { $_.targetId -cne 'npm.build' }).Count | Should Be 12
            @($actual | Where-Object { $_.targetId -cne 'npm.build' -and $_.environmentProfile -cne 'inherit' }).Count | Should Be 0
        }
        It 'returns immutable registry copies' {
            $first = @(Get-OperatorProcessTargetRegistrySnapshot); $first[0].targetId = 'tampered'; $first[0].allowedStages[0] = 'SelfTest'; $first[0].environmentProfile = 'local-build'
            $second = @(Get-OperatorProcessTargetRegistrySnapshot); $second[0].targetId | Should BeExactly 'npm.test'; $second[0].allowedStages[0] | Should BeExactly 'LocalVerify'; $second[0].environmentProfile | Should BeExactly 'inherit'
        }
        It 'rejects a missing environment profile in the trusted registry' {
            InModuleScope Operator.Process {
                $registration = $script:ProcessTargetRegistry[0]
                $profile = [string]$registration.environmentProfile
                try {
                    $registration.PSObject.Properties.Remove('environmentProfile')
                    { Assert-OperatorProcessTargetRegistry } | Should Throw
                }
                finally {
                    if ($null -eq $registration.PSObject.Properties['environmentProfile']) { Add-Member -InputObject $registration -NotePropertyName environmentProfile -NotePropertyValue $profile }
                }
            }
        }
        It 'rejects an unknown environment profile in the trusted registry' {
            InModuleScope Operator.Process {
                $registration = $script:ProcessTargetRegistry[0]
                $profile = [string]$registration.environmentProfile
                try {
                    $registration.environmentProfile = 'unknown'
                    { Assert-OperatorProcessTargetRegistry } | Should Throw
                }
                finally { $registration.environmentProfile = $profile }
            }
        }
    }

    Context 'trusted check registry' {
        It 'registers exactly 20 checks' {
            (Register-M000R1Checks).count | Should Be 20
            $snapshot = Get-OperatorCheckRegistrySnapshot
            $snapshot.Count | Should Be 20
        }
        It 'permits idempotent registration in the same module instance' { [void](Register-M000R1Checks); (Register-M000R1Checks).count | Should Be 20 }

        It 'keeps exactly 19 ordinal-unique D paths inside the checks module' {
            InModuleScope M000.R1.Checks {
                $paths = @($script:AllowedDPaths)
                $ordinalPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
                $paths.Count | Should Be 19
                foreach ($path in $paths) { $ordinalPaths.Add([string]$path) | Should Be $true }
                $ordinalPaths.Count | Should Be 19
                $ordinalPaths.Contains('scripts/operator/Operator.ProcessWorker.ps1') | Should Be $true
                $ordinalPaths.Contains('scripts/operator/modules/Operator.Process.psm1') | Should Be $true
            }
        }

        It 'rejects a missing known registration as internal binding error' {
            $definition = Get-M000R1CheckDefinition -CheckId 'repository.policy' -TargetId 'operator.repository'
            (Test-M000R1CheckRegistrationBinding $definition.checkId $definition.targetId $null).reasonCode | Should BeExactly 'registry-registration-missing'
        }

        It 'rejects differing allowed stages' {
            [void](Register-M000R1Checks); $registration = Get-OperatorCheckRegistration 'repository.policy' 'operator.repository'; $registration.AllowedStages = @('Preflight')
            (Test-M000R1CheckRegistrationBinding 'repository.policy' 'operator.repository' $registration).reasonCode | Should BeExactly 'registry-allowed-stages-invalid'
        }

        It 'rejects a differing target' {
            [void](Register-M000R1Checks); $registration = Get-OperatorCheckRegistration 'repository.policy' 'operator.repository'; $registration.TargetId = 'operator.wrong'
            (Test-M000R1CheckRegistrationBinding 'repository.policy' 'operator.repository' $registration).reasonCode | Should BeExactly 'registry-registration-identity-invalid'
        }

        It 'rejects a foreign handler even with identical source text and never executes it' {
            [void](Register-M000R1Checks); $registration = Get-OperatorCheckRegistration 'repository.policy' 'operator.repository'; $script:executed = $false
            $registration.Handler = [scriptblock]::Create($registration.Handler.ToString())
            (Test-M000R1CheckRegistrationBinding 'repository.policy' 'operator.repository' $registration).reasonCode | Should BeExactly 'registry-handler-invalid'
            $script:executed | Should Be $false
        }

        It 'rejects an arbitrary foreign handler' {
            [void](Register-M000R1Checks); $registration = Get-OperatorCheckRegistration 'repository.policy' 'operator.repository'; $registration.Handler = { throw 'must never execute' }
            (Test-M000R1CheckRegistrationBinding 'repository.policy' 'operator.repository' $registration).reasonCode | Should BeExactly 'registry-handler-invalid'
        }
    }

    Context 'early manifest rejection matrix' {
        $cases = @(
            @{ Name='unknown check'; Check='unknown.check'; Target='operator.repository'; Stage='Preflight'; Timeout='standard'; Required=$true },
            @{ Name='unknown target'; Check='repository.policy'; Target='unknown.target'; Stage='Preflight'; Timeout='standard'; Required=$true },
            @{ Name='stage'; Check='repository.policy'; Target='operator.repository'; Stage='SelfTest'; Timeout='standard'; Required=$true },
            @{ Name='timeout'; Check='repository.policy'; Target='operator.repository'; Stage='Preflight'; Timeout='long'; Required=$true },
            @{ Name='required'; Check='repository.policy'; Target='operator.repository'; Stage='Preflight'; Timeout='standard'; Required=$false }
        )
        foreach ($case in $cases) {
            It ('blocks ' + $case.Name + ' without creating a run directory') {
                $definition = Get-M000R1CheckDefinition -CheckId $case.Check -TargetId $case.Target
                $allowed = $null -ne $definition -and @($definition.allowedStages) -ccontains $case.Stage -and @($definition.allowedTimeoutProfiles) -ccontains $case.Timeout -and [bool]$definition.required -eq [bool]$case.Required
                $allowed | Should Be $false
                (Test-Path -LiteralPath ([IO.Path]::Combine($TestDrive, 'runs'))) | Should Be $false
            }
        }
    }
}
