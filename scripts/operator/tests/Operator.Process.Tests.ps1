. ([IO.Path]::Combine($PSScriptRoot, 'Test.Helpers.ps1'))

Describe 'Operator process acceptance' {
    BeforeAll {
        $localAppData = New-D2LocalAppData -BasePath $TestDrive
        $processModule = Import-D2Module -Name 'Operator.Process.psm1'
        $reportingModule = Import-D2Module -Name 'Operator.Reporting.psm1'
    }

    AfterEach { Stop-D2OwnedProcesses }
    AfterAll { Clear-D2TestState }

    Context 'registry and allowlists' {
        It 'contains the exact 13 targets' {
            @(Get-OperatorProcessTargetRegistrySnapshot).Count | Should Be 13
        }

        It 'returns immutable copies' {
            $a = @(Get-OperatorProcessTargetRegistrySnapshot)
            $a[0].targetId = 'changed'
            (@(Get-OperatorProcessTargetRegistrySnapshot))[0].targetId |
                Should BeExactly 'npm.test'
        }

        It 'enforces target, stage and timeout allowlists' {
            (Test-OperatorProcessTargetAllowed 'fixture.exit-success' 'SelfTest' 'short').isAllowed |
                Should Be $true
            (Test-OperatorProcessTargetAllowed 'fixture.exit-success' 'LocalVerify' 'short').isAllowed |
                Should Be $false
            (Test-OperatorProcessTargetAllowed 'fixture.exit-success' 'SelfTest' 'long').isAllowed |
                Should Be $false
        }

        It 'rejects an unknown target without run directory, gate or PID' {
            $before = @(Get-ChildItem $localAppData -Recurse -ErrorAction SilentlyContinue).Count
            $result = Invoke-OperatorProcessTarget $null $script:D2TestRoot SelfTest 'unknown.target' short
            $result.status | Should BeExactly 'blocked'
            $result.processStarted | Should Be $false
            $result.PSObject.Properties['workerPid'] | Should Be $null
            @(Get-ChildItem $localAppData -Recurse -ErrorAction SilentlyContinue).Count |
                Should Be $before
        }
    }

    Context 'real fixture targets' {
        BeforeEach {
            $context = New-D2RunContext -LocalAppData $localAppData
            Initialize-OperatorProcessRunReports $context
            $processesRoot = [IO.Path]::Combine($context.RunDirectory, 'processes')
        }

        AfterEach {
            try {
                Complete-OperatorProcessRun $context | Out-Null
            }
            catch {
                Write-Verbose 'Process test final cleanup was already completed or rejected.'
            }
        }

        It 'accepts exit-success' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.exit-success short
            $result.status | Should BeExactly 'passed'
            $result.exitCode | Should Be 0
        }

        It 'separates stdout and stderr for stderr-success' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.stderr-success short
            $directory = Get-ChildItem -LiteralPath $processesRoot -Directory |
                Sort-Object Name |
                Select-Object -First 1
            (Get-Content ([IO.Path]::Combine($directory.FullName, 'stdout.log')) -Raw) |
                Should Match 'stdout-only'
            (Get-Content ([IO.Path]::Combine($directory.FullName, 'stderr.log')) -Raw) |
                Should Match 'stderr-only'
            $result.status | Should BeExactly 'passed'
        }

        It 'captures exit-failure with exit code 7' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.exit-failure short
            $result.status | Should BeExactly 'failed'
            $result.exitCode | Should Be 7
        }

        It 'accepts health-ready' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.health-ready short
            $result.status | Should BeExactly 'passed'
            $result.healthStatus | Should BeExactly 'passed'
        }

        It 'detects health-failure' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.health-failure short
            $result.status | Should BeExactly 'failed'
            $result.healthStatus | Should BeExactly 'failed'
        }

        It 'times out and cleans the owned process tree' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.timeout short
            $result.timedOut | Should Be $true
            $result.status | Should Not BeExactly 'passed'
            $result.cleanup.remainingOwnedProcessCount | Should Be 0
        }

        It 'terminates the complete owned child tree' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.child-tree short
            $result.timedOut | Should Be $true
            $result.cleanup.remainingOwnedProcessCount | Should Be 0
            $result.cleanup.ownedProcessCount | Should BeGreaterThan 1
            $result.cleanup.terminatedProcessCount | Should BeGreaterThan 0
        }

        It 'keeps an unrelated controlled sentinel alive' {
            $harness = [IO.Path]::Combine($TestDrive, 'sentinel.ps1')
            [IO.File]::WriteAllText($harness, 'Start-Sleep -Seconds 60')
            $sentinel = Add-D2OwnedProcess (
                Start-Process `
                    -FilePath ([IO.Path]::Combine($PSHOME, 'powershell.exe')) `
                    -ArgumentList @('-NoProfile', '-NonInteractive', '-File', $harness) `
                    -WindowStyle Hidden `
                    -PassThru
            )
            $null = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.exit-success short
            $sentinel.Refresh()
            $sentinel.HasExited | Should Be $false
        }

        It 'redacts secret output and reserved markers' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.secret-output short
            $directory = Get-ChildItem -LiteralPath $processesRoot -Directory |
                Sort-Object Name |
                Select-Object -First 1
            $logs =
                (Get-Content ([IO.Path]::Combine($directory.FullName, 'stdout.log')) -Raw) +
                (Get-Content ([IO.Path]::Combine($directory.FullName, 'stderr.log')) -Raw)
            $logs | Should Not Match 'ghp_'
            $logs | Should Not Match 'V4_M000_R1_SELFTEST_OK'
            $logs | Should Match '\[REDACTED:'
            $result.status | Should BeExactly 'passed'
        }

        It 'bounds large output and writes the full truncation marker' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.large-output standard
            $result.stdoutTruncated | Should Be $true
            $directory = Get-ChildItem -LiteralPath $processesRoot -Directory |
                Sort-Object Name |
                Select-Object -First 1
            $log = Get-Content ([IO.Path]::Combine($directory.FullName, 'stdout.log')) -Raw
            $log.Length | Should BeLessThan 5242881
            $log | Should Match '\[TRUNCATED:stream-limit\]'
        }

        It 'returns a closed process report with consistent PIDs and cleanup' {
            $result = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.exit-success short
            @($result.PSObject.Properties.Name) -join ',' |
                Should BeExactly 'schemaVersion,sequence,targetId,status,exitCode,startedAtUtc,finishedAtUtc,durationMs,workerPid,targetPid,timedOut,healthStatus,stdoutTruncated,stderrTruncated,cleanup'
            $result.workerPid | Should Not Be $null
            $result.targetPid | Should Not Be $null
            $result.workerPid | Should Not Be $result.targetPid
            (Test-OperatorProcessReportContract $result) | Should Be $true
        }

        It 'creates a gapless 0001 and 0002 sequence' {
            $null = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.exit-success short
            $null = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.stderr-success short
            (@(
                Get-ChildItem -LiteralPath $processesRoot -Directory |
                    Sort-Object Name
            ).Name -join ',') |
                Should BeExactly '0001-fixture.exit-success,0002-fixture.stderr-success'
        }

        It 'rejects a missing log file in the attempt set' {
            $null = Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.exit-success short
            $directory = Get-ChildItem -LiteralPath $processesRoot -Directory |
                Sort-Object Name |
                Select-Object -First 1
            Remove-Item -LiteralPath ([IO.Path]::Combine($directory.FullName, 'stdout.log')) -Force
            {
                Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.stderr-success short
            } | Should Throw
        }

        It 'rejects an additional malformed attempt' {
            [IO.Directory]::CreateDirectory($processesRoot) | Out-Null
            [IO.Directory]::CreateDirectory(
                [IO.Path]::Combine($processesRoot, '0002-fixture.exit-success')
            ) | Out-Null
            {
                Invoke-OperatorProcessTarget $context $script:D2TestRoot SelfTest fixture.exit-success short
            } | Should Throw
        }

        It 'blocks repeated run initialization' {
            { Initialize-OperatorProcessRunReports $context } | Should Throw
        }
    }

    Context 'report and cleanup invariants' {
        It 'rejects a manipulated attempt report' {
            $report = [pscustomobject][ordered]@{
                schemaVersion = [int]1
                sequence = [int]1
                targetId = 'fixture.exit-success'
                status = 'passed'
                exitCode = [int]0
                startedAtUtc = '2026-08-04T10:00:00.000Z'
                finishedAtUtc = '2026-08-04T10:00:01.000Z'
                durationMs = [int64]1000
                workerPid = [int]10
                targetPid = [int]10
                timedOut = $false
                healthStatus = 'not-configured'
                stdoutTruncated = $false
                stderrTruncated = $false
                cleanup = (New-D2Cleanup)
            }
            (Test-OperatorProcessReportContract $report) | Should Be $false
        }

        It 'prevents passed when cleanup or job cleanup fails' {
            $result = New-D2Result -CleanupStatus failed -Owned 1 -Remaining 1
            (Test-OperatorResultSemantics $result).IsValid | Should Be $false
        }
    }
}
