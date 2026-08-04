. ([IO.Path]::Combine($PSScriptRoot, 'Test.Helpers.ps1'))

Describe 'Operator reporting acceptance' {
    BeforeAll {
        New-D2LocalAppData -BasePath $TestDrive | Out-Null
        $reportingModule = Import-D2Module -Name 'Operator.Reporting.psm1'
        $manifestModule = Import-D2Module -Name 'Operator.Manifest.psm1'
    }

    AfterAll { Clear-D2TestState }

    Context 'result schema and semantic pairs' {
        $pairs = @(
            @{ Status = 'passed'; ExitCode = 0 }
            @{ Status = 'failed'; ExitCode = 10 }
            @{ Status = 'blocked'; ExitCode = 20 }
            @{ Status = 'error'; ExitCode = 30 }
            @{ Status = 'error'; ExitCode = 40 }
        )

        foreach ($pair in $pairs) {
            It ("accepts $($pair.Status)/$($pair.ExitCode)") {
                (Test-OperatorResultSemantics (
                    New-D2Result -Status $pair.Status -ExitCode $pair.ExitCode
                )).IsValid | Should Be $true
            }
        }

        It 'rejects an invalid status and exit-code pair' {
            (Test-OperatorResultSemantics (
                New-D2Result -Status passed -ExitCode 10
            )).IsValid | Should Be $false
        }

        It 'rejects skipped required checks for an otherwise passed result' {
            (Test-OperatorResultSemantics (
                New-D2Result -Checks @((New-D2CheckResult -Status skipped))
            )).IsValid | Should Be $false
        }

        It 'rejects cleanup failed with passed' {
            (Test-OperatorResultSemantics (
                New-D2Result -CleanupStatus failed -Owned 1 -Remaining 1
            )).IsValid | Should Be $false
        }

        It 'rejects remaining owned processes with passed' {
            (Test-OperatorResultSemantics (
                New-D2Result -Owned 1 -Remaining 1
            )).IsValid | Should Be $false
        }

        It 'rejects inconsistent cleanup counters' {
            (Test-OperatorResultSemantics (
                New-D2Result `
                    -Status blocked `
                    -ExitCode 20 `
                    -CleanupStatus failed `
                    -Owned 1 `
                    -Terminated 1 `
                    -Remaining 1
            )).IsValid | Should Be $false
        }
    }

    Context 'atomic writers and standard reports' {
        BeforeEach {
            $local = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
            $context = New-D2RunContext -LocalAppData $local
        }

        It 'atomically replaces text without leaving a temporary sibling' {
            $path = [IO.Path]::Combine($context.RunDirectory, 'atomic.txt')
            Write-OperatorAtomicText $path 'first'
            Write-OperatorAtomicText $path 'second'
            (Get-Content -LiteralPath $path -Raw) | Should BeExactly 'second'
            @(Get-ChildItem $context.RunDirectory -Filter '*.tmp').Count | Should Be 0
        }

        It 'writes invocation.json with a redacted manifest path' {
            Write-OperatorInvocationReport `
                $context.RunDirectory `
                SelfTest `
                'C:\secret\manifest.json' `
                '1.0.0'
            $json =
                Get-Content ([IO.Path]::Combine($context.RunDirectory, 'invocation.json')) -Raw |
                ConvertFrom-Json
            $json.manifestPath | Should BeExactly '<redacted>'
        }

        It 'writes manifest snapshot and hash reports' {
            $path = Write-D2Manifest `
                ([IO.Path]::Combine($TestDrive, 'report-manifest.json')) `
                (New-D2ManifestObject)
            $import = Import-OperatorManifest $path
            Write-OperatorManifestReports $context.RunDirectory $import
            Test-Path ([IO.Path]::Combine($context.RunDirectory, 'manifest.snapshot.json')) |
                Should Be $true
            (Get-Content ([IO.Path]::Combine($context.RunDirectory, 'manifest.sha256')) -Raw).Trim() |
                Should BeExactly $import.Sha256
        }

        It 'writes result.json, cleanup.json, summary.txt and emits only the valid marker' {
            $cleanupReport = [pscustomobject][ordered]@{
                schemaVersion = [int]1
                status = 'passed'
                ownedProcessCount = [int]0
                terminatedProcessCount = [int]0
                remainingOwnedProcessCount = [int]0
                completedAtUtc = '2026-08-04T10:00:01.000Z'
            }
            Write-OperatorCleanupReport $context.RunDirectory $cleanupReport
            $result = New-D2Result -RunDirectory $context.RunDirectory
            $output = @(Write-OperatorFinalReport $context.RunDirectory $result)

            foreach ($name in @('result.json', 'cleanup.json', 'summary.txt')) {
                Test-Path ([IO.Path]::Combine($context.RunDirectory, $name)) |
                    Should Be $true
            }

            $output.Count | Should Be 1
            $output[0] | Should BeExactly 'V4_M000_R1_SELFTEST_OK'
            @(Get-ChildItem $context.RunDirectory -Filter 'V4_M000_R1_*').Count |
                Should Be 0
        }

        $nonPassedPairs = @(
            @{ Status = 'failed'; ExitCode = 10 }
            @{ Status = 'blocked'; ExitCode = 20 }
            @{ Status = 'error'; ExitCode = 30 }
            @{ Status = 'error'; ExitCode = 40 }
        )

        foreach ($pair in $nonPassedPairs) {
            It ("does not emit a marker for $($pair.Status)/$($pair.ExitCode)") {
                $result = New-D2Result `
                    -Status $pair.Status `
                    -ExitCode $pair.ExitCode `
                    -RunDirectory $context.RunDirectory
                $output = @(Write-OperatorFinalReport $context.RunDirectory $result)
                $output.Count | Should Be 0
            }
        }

        It 'rejects an invalid result before emitting a marker' {
            {
                Write-OperatorFinalReport `
                    $context.RunDirectory `
                    (New-D2Result -Status passed -ExitCode 10 -RunDirectory $context.RunDirectory)
            } | Should Throw
            @(Get-ChildItem $context.RunDirectory -Filter 'V4_M000_R1_*').Count |
                Should Be 0
        }
    }

    Context 'success markers and status priority' {
        It 'maps SelfTest to its exact marker' {
            InModuleScope Operator.Reporting {
                (Get-OperatorSuccessMarker 'SelfTest') |
                    Should BeExactly 'V4_M000_R1_SELFTEST_OK'
            }
        }

        It 'maps Preflight to its exact marker' {
            InModuleScope Operator.Reporting {
                (Get-OperatorSuccessMarker 'Preflight') |
                    Should BeExactly 'V4_M000_R1_PREFLIGHT_OK'
            }
        }

        It 'maps LocalVerify to its exact marker' {
            InModuleScope Operator.Reporting {
                (Get-OperatorSuccessMarker 'LocalVerify') |
                    Should BeExactly 'V4_M000_R1_LOCAL_OK'
            }
        }

        It 'maps LocalFreeze to its exact marker' {
            InModuleScope Operator.Reporting {
                (Get-OperatorSuccessMarker 'LocalFreeze') |
                    Should BeExactly 'V4_M000_R1_LOCAL_FROZEN'
            }
        }

        It 'keeps the first reason at equal priority' {
            $orchestration = Import-D2Module -Name 'Operator.Orchestration.psm1'
            InModuleScope Operator.Orchestration {
                $state = [pscustomobject][ordered]@{
                    status = 'failed'
                    exitCode = [int]10
                    errorKind = 'none'
                    reasonCode = 'first'
                }
                (Set-M000R1StageFailure $state failed 10 none second).reasonCode |
                    Should BeExactly 'first'
            }
        }

        It 'orders Cleanup above internal, invocation, blocked, failed and passed' {
            $ordered = @('cleanup', 'error40', 'error30', 'blocked', 'failed', 'passed')
            $ordered -join '>' |
                Should BeExactly 'cleanup>error40>error30>blocked>failed>passed'
        }

        It 'does not let final manifest binding overwrite a higher internal error' {
            $orchestration = Import-D2Module -Name 'Operator.Orchestration.psm1'
            $state = [pscustomobject][ordered]@{
                status = 'error'
                exitCode = [int]40
                errorKind = 'internal'
                reasonCode = 'writer-error'
            }
            $binding = [pscustomobject][ordered]@{
                schemaVersion = [int]1
                isValid = $false
                errorKind = 'invocation'
                reasonCode = 'manifest-hash-mismatch'
            }
            (Merge-OperatorFinalManifestBindingState $state $binding).reasonCode |
                Should BeExactly 'writer-error'
        }
    }
}
