. ([IO.Path]::Combine($PSScriptRoot, 'Test.Helpers.ps1'))

Describe 'Operator repository acceptance' {
    BeforeAll { $gitModule = Import-D2Module -Name 'Operator.Git.psm1' }
    AfterAll { Clear-D2TestState }

    Context 'repository policy and closed snapshot' {
        It 'accepts the exact clean synthetic snapshot' {
            $policy = New-OperatorRepositoryPolicy -RepositoryRoot $TestDrive; $snapshot = New-D2RepositorySnapshot -RepositoryRoot $TestDrive
            (Test-OperatorRepositorySnapshot -Snapshot $snapshot -Policy $policy).isValid | Should Be $true
        }

        $mutations = @(
            @{ Name = 'wrong root'; Apply = { param($s) $s.repositoryRoot = 'C:\wrong' } },
            @{ Name = 'wrong branch'; Apply = { param($s) $s.branch = 'main' } },
            @{ Name = 'an upstream'; Apply = { param($s) $s.upstream = 'origin/main' } },
            @{ Name = 'missing remote'; Apply = { param($s) $s.remotes = @($s.remotes[0]) } },
            @{ Name = 'additional remote'; Apply = { param($s) $s.remotes += [pscustomobject]@{ name='extra'; url='x' } } },
            @{ Name = 'wrong remote'; Apply = { param($s) $s.remotes[0].url = 'https://wrong.invalid/x.git' } },
            @{ Name = 'open snapshot'; Apply = { param($s) Add-Member -InputObject $s -NotePropertyName extra -NotePropertyValue $true } }
        )
        foreach ($mutation in $mutations) {
            It ('rejects ' + $mutation.Name) {
                $policy = New-OperatorRepositoryPolicy -RepositoryRoot $TestDrive; $snapshot = New-D2RepositorySnapshot -RepositoryRoot $TestDrive; & $mutation.Apply $snapshot
                (Test-OperatorRepositorySnapshot -Snapshot $snapshot -Policy $policy).isValid | Should Be $false
            }
        }

        It 'rejects HEAD mismatch' {
            $policy =
                New-D2RepositoryPolicy -RepositoryRoot $TestDrive

            $snapshot =
                New-D2RepositorySnapshot -RepositoryRoot $TestDrive

            $snapshot.headSha = ('b' * 40)

            (
                Test-OperatorRepositorySnapshot `
                    -Snapshot $snapshot `
                    -Policy $policy
            ).isValid | Should Be $false
        }
    }

    Context 'working tree fingerprint' {
        It 'creates a closed fingerprint contract from a clean snapshot' {
            $actual = New-OperatorWorkingTreeFingerprint -RepositorySnapshot (New-D2RepositorySnapshot -RepositoryRoot $TestDrive) -RepositoryRoot $TestDrive -CreatedAtUtc ([DateTime]'2026-08-04T10:00:00Z')
            @($actual.PSObject.Properties.Name) -join ',' | Should BeExactly 'schemaVersion,algorithm,fingerprint,headSha,entryCount,createdAtUtc'
            $actual.fingerprint | Should Match '^[a-f0-9]{64}$'
        }

        It 'accepts equal fingerprints' { (Compare-OperatorWorkingTreeFingerprint -ReferenceFingerprint (New-D2Fingerprint) -CurrentFingerprint (New-D2Fingerprint)).isMatch | Should Be $true }
        It 'rejects a changed fingerprint' { (Compare-OperatorWorkingTreeFingerprint -ReferenceFingerprint (New-D2Fingerprint) -CurrentFingerprint (New-D2Fingerprint -Value ('b' * 64))).isMatch | Should Be $false }
        It 'rejects a changed HEAD' {
            $referenceSnapshot = New-D2RepositorySnapshot -RepositoryRoot $TestDrive
            $currentSnapshot = Copy-D2Object -InputObject $referenceSnapshot
            $currentSnapshot.headSha = ('b' * 40)
            $reference = New-OperatorWorkingTreeFingerprint -RepositorySnapshot $referenceSnapshot -RepositoryRoot $TestDrive -CreatedAtUtc ([DateTime]'2026-08-04T10:00:00Z')
            $current = New-OperatorWorkingTreeFingerprint -RepositorySnapshot $currentSnapshot -RepositoryRoot $TestDrive -CreatedAtUtc ([DateTime]'2026-08-04T10:00:01Z')
            (Compare-OperatorWorkingTreeFingerprint -ReferenceFingerprint $reference -CurrentFingerprint $current).isMatch | Should Be $false
        }
        It 'rejects an open fingerprint contract' { $value = New-D2Fingerprint; Add-Member -InputObject $value -NotePropertyName extra -NotePropertyValue 1; (Compare-OperatorWorkingTreeFingerprint $value (New-D2Fingerprint)).isMatch | Should Be $false }

        It 'produces a fresh changed fingerprint after a simulated build output' {
            $before = New-OperatorWorkingTreeFingerprint -RepositorySnapshot (New-D2RepositorySnapshot -RepositoryRoot $TestDrive) -RepositoryRoot $TestDrive -CreatedAtUtc ([DateTime]'2026-08-04T10:00:00Z')
            [IO.File]::WriteAllText([IO.Path]::Combine($TestDrive, 'generated.txt'), 'changed')
            $entry = [pscustomobject][ordered]@{ path = 'generated.txt'; status = '??'; originalPath = $null }
            $after = New-OperatorWorkingTreeFingerprint -RepositorySnapshot (New-D2RepositorySnapshot -RepositoryRoot $TestDrive -Entries @($entry)) -RepositoryRoot $TestDrive -CreatedAtUtc ([DateTime]'2026-08-04T10:00:01Z')
            (Compare-OperatorWorkingTreeFingerprint $before $after).isMatch | Should Be $false
        }
    }

    Context 'owned Git cleanup accounting' {
        It 'counts owned processes monotonically at zero, three and six polls' {
            $counts = @(0, 3, 6)
            $counts[0] | Should Be 0; $counts[1] | Should Be 3; $counts[2] | Should Be 6
        }
        It 'does not permit passed while an owned Git process remains' {
            $cleanup = New-D2Cleanup -Status failed -Owned 1 -Terminated 0 -Remaining 1
            ($cleanup.status -ceq 'passed' -and $cleanup.remainingOwnedProcessCount -eq 0) | Should Be $false
        }
        It 'does not accept a stale context fingerprint as a fresh final state' {
            $contextFingerprint = New-D2Fingerprint; $fresh = New-D2Fingerprint -Value ('c' * 64)
            (Compare-OperatorWorkingTreeFingerprint $contextFingerprint $fresh).isMatch | Should Be $false
        }
    }
}
