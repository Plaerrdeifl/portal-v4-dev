. ([IO.Path]::Combine($PSScriptRoot, 'Test.Helpers.ps1'))

Describe 'Operator security acceptance' {
    BeforeAll { $securityModule = Import-D2Module -Name 'Operator.Security.psm1'; $allowed = @('scripts/operator/checks/M000.R1.Checks.psm1','scripts/operator/modules/Operator.Orchestration.psm1','scripts/operator/manifests/M000-R1.json','scripts/operator/portal-operator.ps1','scripts/operator/modules/Operator.Reporting.psm1','scripts/operator/tests/Test.Helpers.ps1','scripts/operator/tests/Operator.Manifest.Tests.ps1','scripts/operator/tests/Operator.Repository.Tests.ps1','scripts/operator/tests/Operator.Registry.Tests.ps1','scripts/operator/tests/Operator.Security.Tests.ps1','scripts/operator/tests/Operator.Reporting.Tests.ps1','scripts/operator/tests/Operator.Process.Tests.ps1','scripts/operator/tests/Operator.Orchestration.Tests.ps1','scripts/operator/tests/portal-operator.Tests.ps1','docs/project/operator-framework-contracts-v1.md','docs/modules/M000/R1/M000-R1-D.md','docs/modules/M000/R1/M000-R1-COMPLETION.md') }
    AfterEach { Restore-D2Environment }
    AfterAll { Clear-D2TestState }

    Context 'exact D path scope' {
        It 'contains exactly 17 ordinal distinct paths' { $allowed.Count | Should Be 17; @($allowed | Sort-Object -CaseSensitive -Unique).Count | Should Be 17 }
        foreach ($path in $allowed) { It ('allows D path ' + $path) { $policy = New-OperatorPathPolicy -RepositoryRoot $script:D2TestRoot; (Test-OperatorPathAllowed -Policy $policy -RelativePath $path).isAllowed | Should Be $true } }
        It 'rejects any additional path from the exact D set' { ($allowed -ccontains 'scripts/operator/tests/extra.Tests.ps1') | Should Be $false }
        It 'rejects a prefix confusion' { (Test-OperatorPathAllowed (New-OperatorPathPolicy $script:D2TestRoot) 'scripts/operator-evil/file.ps1').isAllowed | Should Be $false }
        It 'normalizes slash direction while preserving ordinal relative spelling' { (Resolve-OperatorRepositoryRelativePath (New-OperatorPathPolicy $script:D2TestRoot) 'scripts\operator\portal-operator.ps1').relativePath | Should BeExactly 'scripts/operator/portal-operator.ps1' }
    }

    Context 'path attacks and prohibited locations' {
        $attacks = @('../outside.txt','C:\absolute.txt','\\server\share\x','\\?\C:\device.txt','file.txt:ads')
        foreach ($path in $attacks) { It ('blocks ' + $path) { $policy = New-OperatorPathPolicy -RepositoryRoot $script:D2TestRoot; { Resolve-OperatorRepositoryRelativePath -Policy $policy -RelativePath $path } | Should Throw } }
        $prohibited = @('tests/x.ps1','package.json','package-lock.json','.gitignore','.git/config','supabase/config.toml')
        foreach ($path in $prohibited) { It ('classifies prohibited path ' + $path) { (Test-OperatorPathAllowed (New-OperatorPathPolicy $script:D2TestRoot) $path).isAllowed | Should Be $false } }
        It 'rejects a reparse file or segment when available' {
            $policy = New-OperatorPathPolicy -RepositoryRoot $script:D2TestRoot
            $classification = Get-OperatorPathClassification -Policy $policy -RelativePath 'scripts/operator/tests'
            $classification.classification | Should Not BeExactly 'outside-repository'
        }
    }

    Context 'local-only connection isolation' {
        It 'blocks DEV and PROD connection metadata' {
            $metadata = @([pscustomobject][ordered]@{ sourceId='dev'; value='postgresql://user:pass@db.example.com/db' }, [pscustomobject][ordered]@{ sourceId='prod'; value='https://x.supabase.co' })
            (Test-OperatorLocalConnectionMetadata $metadata).status | Should BeExactly 'blocked'
        }
        It 'blocks DEV and PROD environment values and restores them' {
            Set-D2EnvironmentValue -Name 'D2_DEV_DATABASE_URL' -Value 'postgresql://u:p@db.example.com/db'; Set-D2EnvironmentValue -Name 'D2_PROD_SUPABASE_URL' -Value 'https://x.supabase.co'
            $values = @{ D2_DEV_DATABASE_URL = $env:D2_DEV_DATABASE_URL; D2_PROD_SUPABASE_URL = $env:D2_PROD_SUPABASE_URL }
            (Test-OperatorLocalEnvironmentVariables $values).status | Should BeExactly 'blocked'
        }
        It 'accepts localhost connection values' { (Test-OperatorLocalEnvironmentVariables @{ DATABASE_URL='postgresql://u:p@localhost/db' }).status | Should BeExactly 'clear' }
        It 'reports a forbidden Supabase link state from an isolated root' {
            $root = [IO.Path]::Combine($TestDrive, 'repo'); [IO.Directory]::CreateDirectory([IO.Path]::Combine($root, 'supabase', '.temp')) | Out-Null
            [IO.File]::WriteAllText([IO.Path]::Combine($root, 'supabase', '.temp', 'project-ref'), 'tpieykhhawszlzsoflnl')
            (Test-OperatorSupabaseLinkState (New-OperatorPathPolicy $root)).status | Should BeExactly 'blocked'
        }
    }

    Context 'secret hints and safe logs' {
        It 'detects a secret hint in an isolated allowed file' {
            $root = [IO.Path]::Combine($TestDrive, 'secret-root'); [IO.Directory]::CreateDirectory([IO.Path]::Combine($root, 'scripts', 'operator')) | Out-Null
            [IO.File]::WriteAllText([IO.Path]::Combine($root, 'scripts', 'operator', 'sample.txt'), 'token=ghp_123456789012345678901234567890')
            (Test-OperatorFileForSecretHints (New-OperatorPathPolicy $root) 'scripts/operator/sample.txt').status | Should BeExactly 'blocked'
        }
        It 'redacts reserved success markers' { (Protect-OperatorLogText 'V4_M000_R1_LOCAL_OK') | Should BeExactly '[REDACTED:reserved-marker]' }
        It 'redacts tokens and produces safe logs' { $safe = Protect-OperatorLogText 'token=ghp_123456789012345678901234567890'; $safe | Should Match '\[REDACTED:'; (Test-OperatorLogTextSafe $safe) | Should Be $true }
        It 'rejects unsafe raw logs' { (Test-OperatorLogTextSafe 'V4_M000_R1_SELFTEST_OK') | Should Be $false }
        It 'removes control sequences' {
            $escape = [string][char]27
            (Protect-OperatorLogText ($escape + '[31mred' + $escape + '[0m')) | Should BeExactly 'red'
        }
    }
}
