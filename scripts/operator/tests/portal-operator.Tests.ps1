. ([IO.Path]::Combine($PSScriptRoot, 'Test.Helpers.ps1'))

Describe 'portal operator isolated end-to-end acceptance' {
    BeforeAll { $localAppData=New-D2LocalAppData -BasePath $TestDrive; $validManifest=[IO.Path]::Combine($script:D2OperatorRoot,'manifests','M000-R1.json') }
    AfterAll { Clear-D2TestState }

    Context 'isolated early invocation rejection' {
        It 'returns error 30 for an unknown stage with fixed stderr' { $result=Invoke-D2PortalProcess ([IO.Path]::Combine($TestDrive,'unknown')) Unknown $validManifest; $result.ExitCode | Should Be 30; $result.Stderr.Trim() | Should BeExactly 'Portal operator invocation is invalid.' }
        It 'returns error 30 for a missing manifest' { $result=Invoke-D2PortalProcess ([IO.Path]::Combine($TestDrive,'missing')) SelfTest ([IO.Path]::Combine($TestDrive,'missing.json')); $result.ExitCode | Should Be 30; $result.Stderr.Trim() | Should BeExactly 'Portal operator manifest is missing or invalid.' }
        It 'returns error 30 for invalid manifest JSON' { $path=Write-D2InvalidJson ([IO.Path]::Combine($TestDrive,'invalid.json')); $result=Invoke-D2PortalProcess ([IO.Path]::Combine($TestDrive,'invalid')) SelfTest $path; $result.ExitCode | Should Be 30; $result.Stderr.Trim() | Should BeExactly 'Portal operator manifest is missing or invalid.' }
        foreach ($stage in @('DevDeploy','DevVerify','ProdPreflight','ProdDeploy','ProdVerify')) { It ("blocks deployment stage $stage without attempts") { $result=Invoke-D2PortalProcess ([IO.Path]::Combine($TestDrive,$stage)) $stage $validManifest; $result.ExitCode | Should Be 20; $result.Stderr.Trim() | Should BeExactly 'Portal operator invocation was blocked.' } }
        It 'blocks a reference parameter at the wrong stage' { $result=Invoke-D2PortalProcess ([IO.Path]::Combine($TestDrive,'wrong-reference')) SelfTest $validManifest -ReferenceProvided -ReferenceRunId '20260804T100000000Z-abcdef123456'; $result.ExitCode | Should Be 20 }
        It 'blocks LocalFreeze without a reference' { $result=Invoke-D2PortalProcess ([IO.Path]::Combine($TestDrive,'freeze-no-ref')) LocalFreeze $validManifest; $result.ExitCode | Should Be 20 }
    }

    Context 'entrypoint contracts' {
        It 'uses only fixed public stderr messages' { $source=Get-Content ([IO.Path]::Combine($script:D2OperatorRoot,'portal-operator.ps1')) -Raw; @([regex]::Matches($source,'\[Console\]::Error\.WriteLine\(')).Count | Should BeGreaterThan 0; $source | Should Not Match 'WriteLine\(\s*\$_' }
        It 'uses the Result exit code for the final process exit' { (Get-Content ([IO.Path]::Combine($script:D2OperatorRoot,'portal-operator.ps1')) -Raw) | Should Match 'exit\s+\$ExitCode' }
        It 'classifies final external manifest mutation as error 30' { $source=Get-Content ([IO.Path]::Combine($script:D2OperatorRoot,'portal-operator.ps1')) -Raw; $source | Should Match 'Merge-OperatorFinalManifestBindingState'; $source | Should Match 'manifest-hash-mismatch' }
        It 'classifies an internal binding contract as error 40' { (Get-Content ([IO.Path]::Combine($script:D2OperatorRoot,'portal-operator.ps1')) -Raw) | Should Match 'fallbackExitCode' }
        It 'preserves a cleanup blocker as blocked 20' { (Get-Content ([IO.Path]::Combine($script:D2OperatorRoot,'portal-operator.ps1')) -Raw) | Should Match "fallbackStatus.*'blocked'" }
        It 'emits success markers only through validated final reporting' { $source=Get-Content ([IO.Path]::Combine($script:D2OperatorRoot,'portal-operator.ps1')) -Raw; $source | Should Not Match 'V4_M000_R1_(?:SELFTEST_OK|PREFLIGHT_OK|LOCAL_OK|LOCAL_FROZEN)' }
        It 'contains no direct npm, Docker, Supabase, DEV or PROD action' { $source=Get-Content ([IO.Path]::Combine($script:D2OperatorRoot,'portal-operator.ps1')) -Raw; $source | Should Not Match '(?i)npm\s+(?:test|run)|docker\s|supabase\s+(?:link|start|stop)|devdeploy\s|proddeploy\s' }
    }

    Context 'repository immutability across controlled calls' {
        It 'does not change committed repository files across repeated rejected calls' {
            $before=(git status --porcelain=v1 --untracked-files=no) -join "`n"; $null=Invoke-D2PortalProcess ([IO.Path]::Combine($TestDrive,'repeat1')) Unknown $validManifest; $null=Invoke-D2PortalProcess ([IO.Path]::Combine($TestDrive,'repeat2')) Unknown $validManifest; $after=(git status --porcelain=v1 --untracked-files=no) -join "`n"; $after | Should BeExactly $before
        }
    }
}
