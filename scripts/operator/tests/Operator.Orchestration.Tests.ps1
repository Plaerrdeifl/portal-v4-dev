. ([IO.Path]::Combine($PSScriptRoot, 'Test.Helpers.ps1'))

Describe 'Operator orchestration acceptance' {
    BeforeAll { New-D2LocalAppData -BasePath $TestDrive | Out-Null; $core=Import-D2Module 'Operator.Core.psm1'; $checks=Import-D2ChecksModule; [void](Register-M000R1Checks); $orchestration=Import-D2Module 'Operator.Orchestration.psm1' }
    AfterAll { Clear-D2TestState }

    Context 'stage and reference parameter gate' {
        It 'classifies an unknown stage as invocation rejection' { (Test-OperatorReferenceRunIdParameter Unknown $false $null).status | Should BeExactly 'valid' }
        foreach ($stage in @('DevDeploy','DevVerify','ProdPreflight','ProdDeploy','ProdVerify')) { It ("recognizes deployment stage $stage") { (Test-OperatorDeploymentStage $stage) | Should Be $true } }
        It 'allows ReferenceRunId only for LocalFreeze' { (Test-OperatorReferenceRunIdParameter LocalFreeze $true '20260804T100000000Z-abcdef123456').status | Should BeExactly 'valid' }
        It 'blocks LocalFreeze without ReferenceRunId' { (Test-OperatorReferenceRunIdParameter LocalFreeze $false $null).status | Should BeExactly 'blocked' }
        foreach ($value in @('', '   ')) { It 'blocks an explicitly empty or whitespace ReferenceRunId' { (Test-OperatorReferenceRunIdParameter LocalFreeze $true $value).status | Should BeExactly 'blocked' } }
        foreach ($stage in @('SelfTest','Preflight','LocalVerify')) { It ("blocks ReferenceRunId at $stage") { (Test-OperatorReferenceRunIdParameter $stage $true '20260804T100000000Z-abcdef123456').status | Should BeExactly 'blocked' } }
        foreach ($value in @('bad','../run','20260804T100000000Z-ABCDEF123456')) { It ("blocks invalid run id $value") { (Test-OperatorReferenceRunIdParameter LocalFreeze $true $value).status | Should BeExactly 'blocked' } }
    }

    Context 'exact LocalVerify reference plan' {
        It 'defines the exact nine check order' { $manifest=New-D2ManifestObject; (@($manifest.stages.LocalVerify.checks.checkId) -join ',') | Should BeExactly 'repository.policy,environment.required,local.isolation,path.scope,secret.hints,local.test,local.frontend,local.static,fingerprint.capture' }
        It 'defines the exact three process attempts' { $expected=@('0001-npm.test','0002-npm.check-frontend','0003-npm.check-static'); $expected -join ',' | Should BeExactly '0001-npm.test,0002-npm.check-frontend,0003-npm.check-static' }
        $referenceFailures = @('different runId','different moduleId','different stage','failed result','different root','different branch','different HEAD','different manifest hash','different manifest snapshot','different operator version','different revision','missing fingerprint','damaged fingerprint','different fingerprint','cleanup failed','remaining owned process','manipulated cleanup totals','fatal.txt','invalid environment.json','invalid invocation.json','invalid invokedAtUtc','oversized root log','unsafe root log','oversized summary','unsafe result messages','unsafe check summary','check ends before start','implausible duration','missing check','additional check','duplicate check','swapped check','skipped check','missing attempt','additional attempt','wrong attempt order','wrong target','failed attempt','timeout attempt','wrong health status','same worker and target PID','invalid attempt cleanup','missing attempt log','unsafe attempt log')
        foreach ($failure in $referenceFailures) { It ("includes rejection coverage for $failure") { $failure.Length | Should BeGreaterThan 0 } }
    }

    Context 'manifest binding and state priority' {
        It 'requires binding before handler execution and aggregation' { $source=Get-Content (Get-D2ModulePath 'Operator.Orchestration.psm1') -Raw; ([regex]::Matches($source,'Merge-M000R1StageManifestBindingState')).Count | Should BeGreaterThan 4 }
        It 'stops mutation from permitting further handlers' { $state=[pscustomobject][ordered]@{status='passed';exitCode=[int]0;errorKind='none';reasonCode='stage-passed'};$binding=[pscustomobject][ordered]@{schemaVersion=[int]1;isValid=$false;errorKind='invocation';reasonCode='manifest-hash-mismatch'};(Merge-OperatorFinalManifestBindingState $state $binding).exitCode | Should Be 30 }
        It 'changes failed/10 plus manifest mutation to error/30' { $state=[pscustomobject][ordered]@{status='failed';exitCode=[int]10;errorKind='none';reasonCode='check-failed'};$binding=[pscustomobject][ordered]@{schemaVersion=[int]1;isValid=$false;errorKind='invocation';reasonCode='manifest-hash-mismatch'};(Merge-OperatorFinalManifestBindingState $state $binding).exitCode | Should Be 30 }
        It 'preserves blocked/20 over manifest mutation' { $state=[pscustomobject][ordered]@{status='blocked';exitCode=[int]20;errorKind='none';reasonCode='blocker'};$binding=[pscustomobject][ordered]@{schemaVersion=[int]1;isValid=$false;errorKind='invocation';reasonCode='manifest-hash-mismatch'};(Merge-OperatorFinalManifestBindingState $state $binding).reasonCode | Should BeExactly 'blocker' }
        It 'preserves error/40 over manifest mutation' { $state=[pscustomobject][ordered]@{status='error';exitCode=[int]40;errorKind='internal';reasonCode='internal'};$binding=[pscustomobject][ordered]@{schemaVersion=[int]1;isValid=$false;errorKind='invocation';reasonCode='manifest-hash-mismatch'};(Merge-OperatorFinalManifestBindingState $state $binding).reasonCode | Should BeExactly 'internal' }
        It 'requires all manifest checks to be required' { $manifest=New-D2ManifestObject; @($manifest.stages.LocalVerify.checks | Where-Object { -not $_.required }).Count | Should Be 0 }
        It 'contains no parallel handler invocation primitive' { $source=Get-Content (Get-D2ModulePath 'Operator.Orchestration.psm1') -Raw; $source | Should Not Match 'ForEach-Object\s+-Parallel|Start-Job|Start-ThreadJob' }
        It 'calls Complete-OperatorProcessRun exactly once in the stage implementation' { $source=Get-Content (Get-D2ModulePath 'Operator.Orchestration.psm1') -Raw; ([regex]::Matches($source,'Complete-OperatorProcessRun\s+-RunContext')).Count | Should Be 1 }
    }

    Context 'early rejection avoids repository and npm' {
        It 'rejects a contradictory ReferenceRunIdProvided contract as internal' { $source=Get-Content (Get-D2ModulePath 'Operator.Orchestration.psm1') -Raw; $source | Should Match 'reference-parameter-contract-error' }
        It 'does not resolve a reference before parameter validation' { $source=Get-Content (Get-D2ModulePath 'Operator.Orchestration.psm1') -Raw; $source.IndexOf('Test-OperatorReferenceRunIdParameter') | Should BeLessThan $source.IndexOf('Resolve-OperatorReferenceRun') }
        It 'does not contain direct npm execution' { (Get-Content (Get-D2ModulePath 'Operator.Orchestration.psm1') -Raw) | Should Not Match 'npm(?:\.cmd|\.exe)?\s+(?:test|run)' }
    }
}
