Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$coreModulePath = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, 'Operator.Core.psm1'))
$securityModulePath = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, 'Operator.Security.psm1'))
$reportingModulePath = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, 'Operator.Reporting.psm1'))
Import-Module -Name $coreModulePath -ErrorAction Stop
Import-Module -Name $securityModulePath -ErrorAction Stop
Import-Module -Name $reportingModulePath -ErrorAction Stop

$script:ProcessTargetIdPattern = '^[a-z0-9]+(?:[.-][a-z0-9]+)*$'
$script:ProcessStreamLimit = 5242880
$script:ProcessTimeoutProfiles = [ordered]@{ short = 15; standard = 60; long = 300 }
$script:TrustedRepositoryRoot = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', '..', '..')).TrimEnd('\', '/')
$script:RegisteredTargetIds = @(
    'npm.test', 'npm.check-frontend', 'npm.check-static', 'npm.build',
    'fixture.exit-success', 'fixture.stderr-success', 'fixture.exit-failure',
    'fixture.health-ready', 'fixture.health-failure', 'fixture.timeout',
    'fixture.child-tree', 'fixture.secret-output', 'fixture.large-output'
)

function New-OperatorProcessHealthDefinition {
    $definition = [ordered]@{}
    $definition.Add('kind', 'stdout-token')
    $definition.Add(('to' + 'ken'), 'M000_PROCESS_HEALTH_READY_V1')
    $definition.Add('timeoutSeconds', [int]5)
    return [pscustomobject]$definition
}

$script:ProcessTargetRegistry = @(
    [pscustomobject][ordered]@{ targetId = 'npm.test'; targetKind = 'npm-script'; allowedStages = @('LocalVerify', 'LocalFreeze'); allowedTimeoutProfiles = @('standard', 'long'); defaultTimeoutProfile = 'standard'; startTimeoutSeconds = 15; workingDirectoryKind = 'repository-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'npm.check-frontend'; targetKind = 'npm-script'; allowedStages = @('LocalVerify', 'LocalFreeze'); allowedTimeoutProfiles = @('standard', 'long'); defaultTimeoutProfile = 'standard'; startTimeoutSeconds = 15; workingDirectoryKind = 'repository-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'npm.check-static'; targetKind = 'npm-script'; allowedStages = @('LocalVerify', 'LocalFreeze'); allowedTimeoutProfiles = @('standard', 'long'); defaultTimeoutProfile = 'standard'; startTimeoutSeconds = 15; workingDirectoryKind = 'repository-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'npm.build'; targetKind = 'npm-script'; allowedStages = @('LocalVerify', 'LocalFreeze'); allowedTimeoutProfiles = @('long'); defaultTimeoutProfile = 'long'; startTimeoutSeconds = 15; workingDirectoryKind = 'repository-root'; environmentProfile = 'local-build'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'fixture.exit-success'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'fixture.stderr-success'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'fixture.exit-failure'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'fixture.health-ready'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = (New-OperatorProcessHealthDefinition) },
    [pscustomobject][ordered]@{ targetId = 'fixture.health-failure'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = (New-OperatorProcessHealthDefinition) },
    [pscustomobject][ordered]@{ targetId = 'fixture.timeout'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'fixture.child-tree'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'fixture.secret-output'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null },
    [pscustomobject][ordered]@{ targetId = 'fixture.large-output'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('standard'); defaultTimeoutProfile = 'standard'; startTimeoutSeconds = 10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null }
)

$script:ProcessTargetImplementation = @{
    'npm.test' = [pscustomobject]@{ scriptName = 'test'; fixtureMode = $null }
    'npm.check-frontend' = [pscustomobject]@{ scriptName = 'check:frontend'; fixtureMode = $null }
    'npm.check-static' = [pscustomobject]@{ scriptName = 'check:static'; fixtureMode = $null }
    'npm.build' = [pscustomobject]@{ scriptName = 'build'; fixtureMode = $null }
    'fixture.exit-success' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'exit-success' }
    'fixture.stderr-success' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'stderr-success' }
    'fixture.exit-failure' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'exit-failure' }
    'fixture.health-ready' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'health-ready' }
    'fixture.health-failure' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'health-failure' }
    'fixture.timeout' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'timeout' }
    'fixture.child-tree' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'child-tree' }
    'fixture.secret-output' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'secret-output' }
    'fixture.large-output' = [pscustomobject]@{ scriptName = $null; fixtureMode = 'large-output' }
}

$script:ProcessNativeSource = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;

namespace Plaerrdeifl.Operator {
    internal static class NativeMethods {
        internal const UInt32 JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] internal static extern SafeJobHandle CreateJobObject(IntPtr attributes, string name);
        [DllImport("kernel32.dll", SetLastError = true)] internal static extern bool SetInformationJobObject(SafeJobHandle job, Int32 infoClass, IntPtr info, UInt32 length);
        [DllImport("kernel32.dll", SetLastError = true)] internal static extern bool AssignProcessToJobObject(SafeJobHandle job, IntPtr process);
        [DllImport("kernel32.dll", SetLastError = true)] internal static extern bool TerminateJobObject(SafeJobHandle job, UInt32 exitCode);
        [DllImport("kernel32.dll", SetLastError = true)] internal static extern bool QueryInformationJobObject(SafeJobHandle job, Int32 infoClass, IntPtr info, UInt32 length, out UInt32 returnedLength);
        [DllImport("kernel32.dll", SetLastError = true)] internal static extern bool CloseHandle(IntPtr handle);
    }

    internal sealed class SafeJobHandle : SafeHandleZeroOrMinusOneIsInvalid {
        internal SafeJobHandle() : base(true) { }
        protected override bool ReleaseHandle() { return NativeMethods.CloseHandle(handle); }
    }

    [StructLayout(LayoutKind.Sequential)] internal struct BasicLimitInformation {
        internal Int64 PerProcessUserTimeLimit;
        internal Int64 PerJobUserTimeLimit;
        internal UInt32 LimitFlags;
        internal UIntPtr MinimumWorkingSetSize;
        internal UIntPtr MaximumWorkingSetSize;
        internal UInt32 ActiveProcessLimit;
        internal UIntPtr Affinity;
        internal UInt32 PriorityClass;
        internal UInt32 SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct IoCounters {
        internal UInt64 ReadOperationCount, WriteOperationCount, OtherOperationCount;
        internal UInt64 ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct ExtendedLimitInformation {
        internal BasicLimitInformation BasicLimitInformation;
        internal IoCounters IoInfo;
        internal UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }

    public sealed class OperatorJob : IDisposable {
        private SafeJobHandle handle;
        private bool disposed;
        public OperatorJob() {
            handle = NativeMethods.CreateJobObject(IntPtr.Zero, null);
            if (handle == null || handle.IsInvalid) throw new InvalidOperationException("Job object creation failed.");
            try {
                ExtendedLimitInformation value = new ExtendedLimitInformation();
                value.BasicLimitInformation.LimitFlags = NativeMethods.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                Int32 size = Marshal.SizeOf(typeof(ExtendedLimitInformation));
                IntPtr pointer = Marshal.AllocHGlobal(size);
                try {
                    Marshal.StructureToPtr(value, pointer, false);
                    if (!NativeMethods.SetInformationJobObject(handle, 9, pointer, (UInt32)size)) throw new InvalidOperationException("Job object configuration failed.");
                } finally { Marshal.FreeHGlobal(pointer); }
            } catch {
                handle.Dispose();
                handle = null;
                throw;
            }
        }
        public void Assign(IntPtr processHandle) {
            if (disposed || processHandle == IntPtr.Zero || !NativeMethods.AssignProcessToJobObject(handle, processHandle)) throw new InvalidOperationException("Job assignment failed.");
        }
        public Int32[] GetProcessIds() {
            if (disposed) return new Int32[0];
            const Int32 capacity = 4096;
            Int32 size = 8 + (IntPtr.Size * capacity);
            IntPtr pointer = Marshal.AllocHGlobal(size);
            try {
                for (Int32 i = 0; i < size; i++) Marshal.WriteByte(pointer, i, 0);
                UInt32 returned;
                if (!NativeMethods.QueryInformationJobObject(handle, 3, pointer, (UInt32)size, out returned)) throw new InvalidOperationException("Job query failed.");
                UInt32 count = (UInt32)Marshal.ReadInt32(pointer, 4);
                if (count > capacity) throw new InvalidOperationException("Job process list exceeded its bound.");
                List<Int32> values = new List<Int32>();
                for (UInt32 index = 0; index < count; index++) {
                    Int64 pid = IntPtr.Size == 8 ? Marshal.ReadInt64(pointer, 8 + ((Int32)index * IntPtr.Size)) : Marshal.ReadInt32(pointer, 8 + ((Int32)index * IntPtr.Size));
                    if (pid > 0 && pid <= Int32.MaxValue) values.Add((Int32)pid);
                }
                return values.ToArray();
            } finally { Marshal.FreeHGlobal(pointer); }
        }
        public Int32 ActiveProcessCount { get { return GetProcessIds().Length; } }
        public void Terminate() { if (!disposed && !NativeMethods.TerminateJobObject(handle, 90)) throw new InvalidOperationException("Job termination failed."); }
        public void Dispose() { if (!disposed) { disposed = true; if (handle != null) handle.Dispose(); handle = null; } }
    }

    public sealed class BoundedProcess : IDisposable {
        private readonly Process process;
        private readonly Int32 maximumCharacters;
        private readonly StringBuilder stdout = new StringBuilder();
        private readonly StringBuilder stderr = new StringBuilder();
        private readonly object stdoutLock = new object();
        private readonly object stderrLock = new object();
        private readonly Task stdoutTask;
        private readonly Task stderrTask;
        private volatile bool stdoutTruncated;
        private volatile bool stderrTruncated;
        private volatile bool streamFailed;
        private bool disposed;
        private BoundedProcess(Process value, Int32 maximum) {
            process = value; maximumCharacters = maximum;
            stdoutTask = Task.Factory.StartNew(() => Drain(process.StandardOutput, stdout, stdoutLock, true), CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default);
            stderrTask = Task.Factory.StartNew(() => Drain(process.StandardError, stderr, stderrLock, false), CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default);
        }
        private void Drain(StreamReader reader, StringBuilder destination, object sync, bool isStdout) {
            Char[] buffer = new Char[4096];
            try {
                while (true) {
                    Int32 read = reader.Read(buffer, 0, buffer.Length);
                    if (read == 0) break;
                    lock (sync) {
                        Int32 remaining = maximumCharacters - destination.Length;
                        if (remaining > 0) destination.Append(buffer, 0, Math.Min(read, remaining));
                        if (read > remaining) { if (isStdout) stdoutTruncated = true; else stderrTruncated = true; }
                    }
                }
            } catch { streamFailed = true; }
        }
        public static BoundedProcess Start(String executable, String arguments, String workingDirectory, Int32 maximumCharacters) {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = executable; info.Arguments = arguments; info.WorkingDirectory = workingDirectory;
            info.UseShellExecute = false; info.CreateNoWindow = true; info.RedirectStandardOutput = true; info.RedirectStandardError = true;
            Process value = new Process(); value.StartInfo = info;
            if (!value.Start()) { value.Dispose(); throw new InvalidOperationException("Worker start failed."); }
            return new BoundedProcess(value, maximumCharacters);
        }
        public Int32 Id { get { return process.Id; } }
        public IntPtr Handle { get { return process.Handle; } }
        public bool HasExited { get { try { return process.HasExited; } catch { return true; } } }
        public Int32 ExitCode { get { return process.ExitCode; } }
        public bool WaitForExit(Int32 milliseconds) { return process.WaitForExit(milliseconds); }
        public bool WaitForStreams(Int32 milliseconds) { try { return Task.WaitAll(new Task[] { stdoutTask, stderrTask }, milliseconds); } catch { streamFailed = true; return false; } }
        public void TerminateKnownProcess() { try { if (!process.HasExited) process.Kill(); } catch { throw new InvalidOperationException("Known worker termination failed."); } }
        public String GetStdout() { lock (stdoutLock) { return stdout.ToString(); } }
        public String GetStderr() { lock (stderrLock) { return stderr.ToString(); } }
        public bool StdoutTruncated { get { return stdoutTruncated; } }
        public bool StderrTruncated { get { return stderrTruncated; } }
        public bool StreamFailed { get { return streamFailed; } }
        public void Dispose() { if (!disposed) { disposed = true; process.Dispose(); } }
    }

    public sealed class RelayProcess : IDisposable {
        private readonly Process process;
        private readonly Task stdoutTask;
        private readonly Task stderrTask;
        private volatile bool streamFailed;
        private bool disposed;
        private RelayProcess(Process value) {
            process = value;
            stdoutTask = Task.Factory.StartNew(() => Relay(process.StandardOutput, Console.Out), CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default);
            stderrTask = Task.Factory.StartNew(() => Relay(process.StandardError, Console.Error), CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default);
        }
        private void Relay(StreamReader reader, TextWriter writer) {
            Char[] buffer = new Char[4096];
            try {
                while (true) {
                    Int32 read = reader.Read(buffer, 0, buffer.Length);
                    if (read == 0) break;
                    writer.Write(buffer, 0, read);
                    writer.Flush();
                }
            } catch { streamFailed = true; }
        }
        public static RelayProcess Start(String executable, String arguments, String workingDirectory) {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = executable; info.Arguments = arguments; info.WorkingDirectory = workingDirectory;
            info.UseShellExecute = false; info.CreateNoWindow = true; info.RedirectStandardOutput = true; info.RedirectStandardError = true;
            Process value = new Process(); value.StartInfo = info;
            if (!value.Start()) { value.Dispose(); throw new InvalidOperationException("Target start failed."); }
            return new RelayProcess(value);
        }
        public Int32 Id { get { return process.Id; } }
        public bool WaitForExit(Int32 milliseconds) { return process.WaitForExit(milliseconds); }
        public bool WaitForStreams(Int32 milliseconds) { try { return Task.WaitAll(new Task[] { stdoutTask, stderrTask }, milliseconds); } catch { streamFailed = true; return false; } }
        public Int32 ExitCode { get { return process.ExitCode; } }
        public bool StreamFailed { get { return streamFailed; } }
        public void Dispose() { if (!disposed) { disposed = true; process.Dispose(); } }
    }
}
'@

if ($null -eq ('Plaerrdeifl.Operator.OperatorJob' -as [type])) {
    Add-Type -TypeDefinition $script:ProcessNativeSource -Language CSharp -ErrorAction Stop
}

function Copy-OperatorProcessTargetRegistration {
    param([Parameter(Mandatory = $true)]$Registration)
    $health = $null
    if ($null -ne $Registration.healthCheck) {
        $healthFields = [ordered]@{}
        $healthFields.Add('kind', [string]$Registration.healthCheck.kind)
        $healthFields.Add(('to' + 'ken'), [string]$Registration.healthCheck.token)
        $healthFields.Add('timeoutSeconds', [int]$Registration.healthCheck.timeoutSeconds)
        $health = [pscustomobject]$healthFields
    }
    return [pscustomobject][ordered]@{
        targetId = [string]$Registration.targetId
        targetKind = [string]$Registration.targetKind
        allowedStages = @($Registration.allowedStages)
        allowedTimeoutProfiles = @($Registration.allowedTimeoutProfiles)
        defaultTimeoutProfile = [string]$Registration.defaultTimeoutProfile
        startTimeoutSeconds = [int]$Registration.startTimeoutSeconds
        workingDirectoryKind = [string]$Registration.workingDirectoryKind
        environmentProfile = [string]$Registration.environmentProfile
        healthCheck = $health
    }
}

function Assert-OperatorProcessTargetRegistry {
    if ($script:ProcessTargetRegistry.Count -ne 13 -or $script:ProcessTargetImplementation.Count -ne 13) { throw 'Trusted process target registry is invalid.' }
    $expectedMatrix = @(
        [pscustomobject][ordered]@{ targetId = 'npm.test'; targetKind = 'npm-script'; allowedStages = @('LocalVerify', 'LocalFreeze'); allowedTimeoutProfiles = @('standard', 'long'); defaultTimeoutProfile = 'standard'; startTimeoutSeconds = [int]15; workingDirectoryKind = 'repository-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = 'test'; fixtureMode = $null },
        [pscustomobject][ordered]@{ targetId = 'npm.check-frontend'; targetKind = 'npm-script'; allowedStages = @('LocalVerify', 'LocalFreeze'); allowedTimeoutProfiles = @('standard', 'long'); defaultTimeoutProfile = 'standard'; startTimeoutSeconds = [int]15; workingDirectoryKind = 'repository-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = 'check:frontend'; fixtureMode = $null },
        [pscustomobject][ordered]@{ targetId = 'npm.check-static'; targetKind = 'npm-script'; allowedStages = @('LocalVerify', 'LocalFreeze'); allowedTimeoutProfiles = @('standard', 'long'); defaultTimeoutProfile = 'standard'; startTimeoutSeconds = [int]15; workingDirectoryKind = 'repository-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = 'check:static'; fixtureMode = $null },
        [pscustomobject][ordered]@{ targetId = 'npm.build'; targetKind = 'npm-script'; allowedStages = @('LocalVerify', 'LocalFreeze'); allowedTimeoutProfiles = @('long'); defaultTimeoutProfile = 'long'; startTimeoutSeconds = [int]15; workingDirectoryKind = 'repository-root'; environmentProfile = 'local-build'; healthCheck = $null; scriptName = 'build'; fixtureMode = $null },
        [pscustomobject][ordered]@{ targetId = 'fixture.exit-success'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = $null; fixtureMode = 'exit-success' },
        [pscustomobject][ordered]@{ targetId = 'fixture.stderr-success'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = $null; fixtureMode = 'stderr-success' },
        [pscustomobject][ordered]@{ targetId = 'fixture.exit-failure'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = $null; fixtureMode = 'exit-failure' },
        [pscustomobject][ordered]@{ targetId = 'fixture.health-ready'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = 'required'; scriptName = $null; fixtureMode = 'health-ready' },
        [pscustomobject][ordered]@{ targetId = 'fixture.health-failure'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = 'required'; scriptName = $null; fixtureMode = 'health-failure' },
        [pscustomobject][ordered]@{ targetId = 'fixture.timeout'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = $null; fixtureMode = 'timeout' },
        [pscustomobject][ordered]@{ targetId = 'fixture.child-tree'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = $null; fixtureMode = 'child-tree' },
        [pscustomobject][ordered]@{ targetId = 'fixture.secret-output'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('short'); defaultTimeoutProfile = 'short'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = $null; fixtureMode = 'secret-output' },
        [pscustomobject][ordered]@{ targetId = 'fixture.large-output'; targetKind = 'fixture'; allowedStages = @('SelfTest'); allowedTimeoutProfiles = @('standard'); defaultTimeoutProfile = 'standard'; startTimeoutSeconds = [int]10; workingDirectoryKind = 'fixture-root'; environmentProfile = 'inherit'; healthCheck = $null; scriptName = $null; fixtureMode = 'large-output' }
    )
    $seen = @{}
    for ($registryIndex = 0; $registryIndex -lt $expectedMatrix.Count; $registryIndex++) {
        $registration = $script:ProcessTargetRegistry[$registryIndex]
        $expectedRegistration = $expectedMatrix[$registryIndex]
        $names = @($registration.PSObject.Properties.Name)
        $expected = @('targetId', 'targetKind', 'allowedStages', 'allowedTimeoutProfiles', 'defaultTimeoutProfile', 'startTimeoutSeconds', 'workingDirectoryKind', 'environmentProfile', 'healthCheck')
        if ($names.Count -ne $expected.Count) { throw 'Trusted process target registry is invalid.' }
        foreach ($name in $expected) { if ($names -cnotcontains $name) { throw 'Trusted process target registry is invalid.' } }
        if ($registration.targetId -isnot [string] -or -not [regex]::IsMatch([string]$registration.targetId, $script:ProcessTargetIdPattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Trusted process target registry is invalid.' }
        if ($seen.ContainsKey([string]$registration.targetId)) { throw 'Trusted process target registry is invalid.' }
        $seen[[string]$registration.targetId] = $true
        foreach ($stringProperty in @('targetId', 'targetKind', 'defaultTimeoutProfile', 'workingDirectoryKind', 'environmentProfile')) { if ($registration.$stringProperty -isnot [string] -or [string]$registration.$stringProperty -cne [string]$expectedRegistration.$stringProperty) { throw 'Trusted process target registry is invalid.' } }
        foreach ($arrayProperty in @('allowedStages', 'allowedTimeoutProfiles')) {
            if ($registration.$arrayProperty -isnot [System.Array]) { throw 'Trusted process target registry is invalid.' }
            $actualValues = @($registration.$arrayProperty)
            $expectedValues = @($expectedRegistration.$arrayProperty)
            if ($actualValues.Count -eq 0 -or $actualValues.Count -ne $expectedValues.Count -or @($actualValues | Select-Object -Unique).Count -ne $actualValues.Count) { throw 'Trusted process target registry is invalid.' }
            for ($valueIndex = 0; $valueIndex -lt $actualValues.Count; $valueIndex++) { if ($actualValues[$valueIndex] -isnot [string] -or [string]$actualValues[$valueIndex] -cne [string]$expectedValues[$valueIndex]) { throw 'Trusted process target registry is invalid.' } }
        }
        if ($registration.startTimeoutSeconds -isnot [int] -or [int]$registration.startTimeoutSeconds -ne [int]$expectedRegistration.startTimeoutSeconds) { throw 'Trusted process target registry is invalid.' }
        if ([string]$expectedRegistration.healthCheck -ceq 'required') {
            if ($null -eq $registration.healthCheck -or $registration.healthCheck -isnot [pscustomobject]) { throw 'Trusted process target registry is invalid.' }
            $healthNames = @($registration.healthCheck.PSObject.Properties.Name)
            if ($healthNames.Count -ne 3 -or $healthNames -cnotcontains 'kind' -or $healthNames -cnotcontains 'token' -or $healthNames -cnotcontains 'timeoutSeconds') { throw 'Trusted process target registry is invalid.' }
            if ($registration.healthCheck.kind -isnot [string] -or [string]$registration.healthCheck.kind -cne 'stdout-token' -or $registration.healthCheck.token -isnot [string] -or [string]$registration.healthCheck.token -cne 'M000_PROCESS_HEALTH_READY_V1' -or $registration.healthCheck.timeoutSeconds -isnot [int] -or [int]$registration.healthCheck.timeoutSeconds -ne 5) { throw 'Trusted process target registry is invalid.' }
        }
        elseif ($null -ne $registration.healthCheck) { throw 'Trusted process target registry is invalid.' }
        if (-not $script:ProcessTargetImplementation.ContainsKey([string]$registration.targetId)) { throw 'Trusted process target registry is invalid.' }
        $implementation = $script:ProcessTargetImplementation[[string]$registration.targetId]
        if ($implementation -isnot [pscustomobject] -or @($implementation.PSObject.Properties.Name).Count -ne 2 -or @($implementation.PSObject.Properties.Name) -cnotcontains 'scriptName' -or @($implementation.PSObject.Properties.Name) -cnotcontains 'fixtureMode') { throw 'Trusted process target registry is invalid.' }
        foreach ($implementationProperty in @('scriptName', 'fixtureMode')) {
            $actualImplementationValue = $implementation.$implementationProperty
            $expectedImplementationValue = $expectedRegistration.$implementationProperty
            if ($null -eq $expectedImplementationValue) { if ($null -ne $actualImplementationValue) { throw 'Trusted process target registry is invalid.' } }
            elseif ($actualImplementationValue -isnot [string] -or [string]$actualImplementationValue -cne [string]$expectedImplementationValue) { throw 'Trusted process target registry is invalid.' }
        }
    }
    foreach ($targetId in $script:RegisteredTargetIds) { if (-not $seen.ContainsKey($targetId) -or -not $script:ProcessTargetImplementation.ContainsKey($targetId)) { throw 'Trusted process target registry is invalid.' } }
}

function Get-OperatorProcessTargetRegistrySnapshot {
    Assert-OperatorProcessTargetRegistry
    $snapshot = @()
    foreach ($registration in $script:ProcessTargetRegistry) { $snapshot += Copy-OperatorProcessTargetRegistration -Registration $registration }
    return $snapshot
}

function Get-OperatorProcessTargetRegistration {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$TargetId)
    Assert-OperatorProcessTargetRegistry
    $matches = @($script:ProcessTargetRegistry | Where-Object { [string]$_.targetId -ceq $TargetId })
    if ($matches.Count -eq 0) { return $null }
    if ($matches.Count -ne 1) { throw 'Trusted process target registry is invalid.' }
    return Copy-OperatorProcessTargetRegistration -Registration $matches[0]
}

function Test-OperatorProcessTargetAllowed {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$TargetId,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Stage,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$TimeoutProfile
    )
    $registration = Get-OperatorProcessTargetRegistration -TargetId $TargetId
    if ($null -eq $registration) { return [pscustomobject][ordered]@{ isAllowed = $false; reasonCode = 'unknown-target-id' } }
    if (@($registration.allowedStages) -cnotcontains $Stage) { return [pscustomobject][ordered]@{ isAllowed = $false; reasonCode = 'stage-not-allowed' } }
    if (@($registration.allowedTimeoutProfiles) -cnotcontains $TimeoutProfile) { return [pscustomobject][ordered]@{ isAllowed = $false; reasonCode = 'timeout-profile-not-allowed' } }
    return [pscustomobject][ordered]@{ isAllowed = $true; reasonCode = 'allowed' }
}

function ConvertTo-OperatorWindowsCommandLineArgument {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
    if ($Value.Length -gt 0 -and -not [regex]::IsMatch($Value, '[\s"]', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $Value }
    $builder = New-Object Text.StringBuilder
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (($slashes * 2) + 1)))
            [void]$builder.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)); $slashes = 0 }
        [void]$builder.Append($character)
    }
    if ($slashes -gt 0) { [void]$builder.Append(('\' * ($slashes * 2))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function ConvertTo-OperatorWindowsCommandLine {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][AllowEmptyString()][string[]]$Arguments)
    return (@($Arguments | ForEach-Object { ConvertTo-OperatorWindowsCommandLineArgument -Value ([string]$_) }) -join ' ')
}

function Throw-OperatorProcessCondition {
    param([Parameter(Mandatory = $true)][ValidateSet('Blocked', 'Error')][string]$Kind)
    $exception = New-Object InvalidOperationException('Operator process condition prevented launch.')
    $exception.Data['OperatorProcessErrorKind'] = $Kind
    throw $exception
}

function Get-OperatorProcessConditionKind {
    param([AllowNull()]$Exception)
    $cursor = $Exception
    while ($null -ne $cursor) {
        if ($cursor.Data.Contains('OperatorProcessErrorKind')) {
            $kind = [string]$cursor.Data['OperatorProcessErrorKind']
            if (@('Blocked', 'Error') -ccontains $kind) { return $kind }
        }
        $cursor = $cursor.InnerException
    }
    return 'Error'
}

function Get-OperatorSafeExistingLocalPath {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][ValidateSet('file', 'directory')][string]$Kind
    )
    if (-not [IO.Path]::IsPathRooted($LiteralPath) -or $LiteralPath.StartsWith('\\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\?\', [StringComparison]::Ordinal) -or $LiteralPath.StartsWith('\\.\', [StringComparison]::Ordinal)) { throw 'Process path is not a local absolute path.' }
    $fullPath = [IO.Path]::GetFullPath($LiteralPath).TrimEnd('\', '/')
    $root = [IO.Path]::GetPathRoot($fullPath)
    $drive = New-Object -TypeName IO.DriveInfo -ArgumentList $root
    if ($drive.DriveType -eq [IO.DriveType]::Network) { throw 'Network process paths are prohibited.' }
    $relative = $fullPath.Substring($root.Length)
    $cursor = $root
    foreach ($segment in @($relative -split '[\\/]' | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })) {
        $cursor = [IO.Path]::Combine($cursor, [string]$segment)
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Process path traverses a reparse point.' }
    }
    $final = Get-Item -LiteralPath $fullPath -Force -ErrorAction Stop
    if (($Kind -ceq 'file' -and $final.PSIsContainer) -or ($Kind -ceq 'directory' -and -not $final.PSIsContainer)) { throw 'Process path kind is invalid.' }
    return [IO.Path]::GetFullPath([string]$final.FullName).TrimEnd('\', '/')
}

function Get-OperatorStandardProcessRunRoot {
    $localAppData = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
    if ($localAppData -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$localAppData)) { throw 'Standard operator run root is unavailable.' }
    try {
        $localRoot = Get-OperatorSafeExistingLocalPath -LiteralPath ([string]$localAppData) -Kind directory
        $expected = [IO.Path]::GetFullPath([IO.Path]::Combine($localRoot, 'Plaerrdeifl', 'PortalOperator', 'runs')).TrimEnd('\', '/')
        $validated = Get-OperatorSafeExistingLocalPath -LiteralPath $expected -Kind directory
        if (-not [string]::Equals($expected, $validated, [StringComparison]::OrdinalIgnoreCase)) { throw 'mismatch' }
        return $validated
    }
    catch { throw 'Standard operator run root failed safety validation.' }
}

function Get-OperatorValidatedPackageScriptValue {
    param(
        [AllowNull()]$PackageObject,
        [Parameter(Mandatory = $true)][string]$ScriptName
    )
    if ($PackageObject -isnot [pscustomobject]) { Throw-OperatorProcessCondition -Kind Error }
    if ($null -eq $PackageObject.PSObject.Properties['scripts'] -or $null -eq $PackageObject.scripts) { Throw-OperatorProcessCondition -Kind Blocked }
    if ($PackageObject.scripts -isnot [pscustomobject]) { Throw-OperatorProcessCondition -Kind Error }
    $scriptProperty = $PackageObject.scripts.PSObject.Properties[$ScriptName]
    if ($null -eq $scriptProperty) { Throw-OperatorProcessCondition -Kind Blocked }
    if ($scriptProperty.Value -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$scriptProperty.Value)) { Throw-OperatorProcessCondition -Kind Error }
    return [string]$scriptProperty.Value
}

function Resolve-OperatorProcessLaunchDefinition {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$TargetId
    )
    try { Assert-OperatorProcessTargetRegistry }
    catch { Throw-OperatorProcessCondition -Kind Error }
    $registration = Get-OperatorProcessTargetRegistration -TargetId $TargetId
    if ($null -eq $registration) { Throw-OperatorProcessCondition -Kind Error }
    try { $policy = New-OperatorPathPolicy -RepositoryRoot $RepositoryRoot }
    catch { Throw-OperatorProcessCondition -Kind Error }
    $root = [string]$policy.repositoryRoot
    if (-not [string]::Equals($root, $script:TrustedRepositoryRoot, [StringComparison]::OrdinalIgnoreCase)) { Throw-OperatorProcessCondition -Kind Error }
    $implementation = $script:ProcessTargetImplementation[$TargetId]

    if ([string]$registration.targetKind -ceq 'fixture') {
        if ($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { Throw-OperatorProcessCondition -Kind Blocked }
        try {
            $powerShellPath = Get-OperatorSafeExistingLocalPath -LiteralPath ([IO.Path]::Combine($PSHOME, 'powershell.exe')) -Kind file
            $fixture = Resolve-OperatorRepositoryRelativePath -Policy $policy -RelativePath 'scripts/operator/test-fixtures/Process.Fixture.ps1'
            if (-not $fixture.exists) { Throw-OperatorProcessCondition -Kind Error }
            $fixturePath = Get-OperatorSafeExistingLocalPath -LiteralPath ([string]$fixture.fullPath) -Kind file
            $fixtureRoot = Get-OperatorSafeExistingLocalPath -LiteralPath ([IO.Path]::GetDirectoryName($fixturePath)) -Kind directory
        }
        catch {
            if ((Get-OperatorProcessConditionKind -Exception $_.Exception) -ceq 'Blocked') { throw }
            Throw-OperatorProcessCondition -Kind Error
        }
        return [pscustomobject][ordered]@{ targetId = $TargetId; executablePath = $powerShellPath; arguments = @('-NoLogo', '-NoProfile', '-NonInteractive', '-File', $fixturePath, '-Mode', [string]$implementation.fixtureMode); workingDirectory = $fixtureRoot }
    }

    $commands = @(Get-Command -Name 'node.exe' -CommandType Application -ErrorAction SilentlyContinue)
    if ($commands.Count -eq 0 -or $commands[0].CommandType -ne [Management.Automation.CommandTypes]::Application) { Throw-OperatorProcessCondition -Kind Blocked }
    $nodeCandidate = [string]$commands[0].Source
    if ([string]::IsNullOrWhiteSpace($nodeCandidate)) { $nodeCandidate = [string]$commands[0].Path }
    try { $nodePath = Get-OperatorSafeExistingLocalPath -LiteralPath $nodeCandidate -Kind file }
    catch { Throw-OperatorProcessCondition -Kind Blocked }
    $npmCliCandidate = [IO.Path]::Combine([IO.Path]::GetDirectoryName($nodePath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    try { $npmCliPath = Get-OperatorSafeExistingLocalPath -LiteralPath $npmCliCandidate -Kind file }
    catch { Throw-OperatorProcessCondition -Kind Blocked }
    try {
        $package = Resolve-OperatorRepositoryRelativePath -Policy $policy -RelativePath 'package.json'
        if (-not $package.exists) { Throw-OperatorProcessCondition -Kind Error }
        $packagePath = Get-OperatorSafeExistingLocalPath -LiteralPath ([string]$package.fullPath) -Kind file
        $packageText = Read-OperatorBoundedUtf8Text -LiteralPath $packagePath -MaximumBytes 1048576 -InvalidMessage 'Package definition is invalid.'
        $packageObject = ConvertFrom-Json -InputObject $packageText -ErrorAction Stop
    }
    catch {
        if ((Get-OperatorProcessConditionKind -Exception $_.Exception) -ceq 'Blocked') { throw }
        Throw-OperatorProcessCondition -Kind Error
    }
    [void](Get-OperatorValidatedPackageScriptValue -PackageObject $packageObject -ScriptName ([string]$implementation.scriptName))
    $arguments = if ($TargetId -ceq 'npm.test') { @($npmCliPath, 'test') } else { @($npmCliPath, 'run', [string]$implementation.scriptName) }
    return [pscustomobject][ordered]@{ targetId = $TargetId; executablePath = $nodePath; arguments = $arguments; workingDirectory = $root }
}

function Test-OperatorProcessRunContext {
    param([AllowNull()]$RunContext)
    try {
        if ($null -eq $RunContext -or $RunContext -isnot [pscustomobject]) { return $false }
        $names = @($RunContext.PSObject.Properties.Name)
        $expectedNames = @('RunId', 'RunRoot', 'RunDirectory', 'StartedAtUtc')
        if ($names.Count -ne $expectedNames.Count) { return $false }
        foreach ($name in $expectedNames) { if ($names -cnotcontains $name) { return $false } }
        if ($RunContext.RunId -isnot [string] -or -not [regex]::IsMatch([string]$RunContext.RunId, '^\d{8}T\d{9}Z-[a-f0-9]{12}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return $false }
        if ($RunContext.RunRoot -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$RunContext.RunRoot)) { return $false }
        if ($RunContext.RunDirectory -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$RunContext.RunDirectory)) { return $false }
        if ($RunContext.StartedAtUtc -isnot [DateTime]) { return $false }
        $standardRoot = Get-OperatorStandardProcessRunRoot
        $runRoot = Get-OperatorSafeExistingLocalPath -LiteralPath ([string]$RunContext.RunRoot) -Kind directory
        $runDirectory = Get-OperatorSafeExistingLocalPath -LiteralPath ([string]$RunContext.RunDirectory) -Kind directory
        if (-not [string]::Equals($runRoot, $standardRoot, [StringComparison]::OrdinalIgnoreCase)) { return $false }
        if (-not [string]::Equals([IO.Path]::GetDirectoryName($runDirectory), $runRoot, [StringComparison]::OrdinalIgnoreCase)) { return $false }
        if ([string][IO.Path]::GetFileName($runDirectory) -cne [string]$RunContext.RunId) { return $false }
        return $true
    }
    catch { return $false }
}

function New-OperatorProcessRejection {
    param([Parameter(Mandatory = $true)][ValidateSet('invalid-target-id', 'unknown-target-id')][string]$ReasonCode)
    return [pscustomobject][ordered]@{
        schemaVersion = [int]1
        kind = 'process-rejection'
        status = 'blocked'
        reasonCode = $ReasonCode
        requestedTargetId = '<redacted>'
        processStarted = $false
        sequence = $null
        createdAtUtc = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
        cleanup = [pscustomobject][ordered]@{ status = 'skipped'; ownedProcessCount = [int]0; terminatedProcessCount = [int]0; remainingOwnedProcessCount = [int]0 }
    }
}

function Enter-OperatorProcessRunMutex {
    param([Parameter(Mandatory = $true)][string]$RunId)
    if (-not [regex]::IsMatch($RunId, '^\d{8}T\d{9}Z-[a-f0-9]{12}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Run mutex identity is invalid.' }
    $mutex = $null
    try {
        $createdNew = $false
        $mutex = New-Object Threading.Mutex($false, ('Local\Plaerrdeifl-M000-RunLock-' + $RunId), [ref]$createdNew)
        $acquired = $false
        $abandoned = $false
        try { $acquired = [bool]$mutex.WaitOne(330000) }
        catch [Threading.AbandonedMutexException] { $acquired = $true; $abandoned = $true }
        if (-not $acquired) { throw 'timeout' }
        return [pscustomobject][ordered]@{ mutex = $mutex; abandoned = [bool]$abandoned }
    }
    catch {
        if ($null -ne $mutex) { try { $mutex.Dispose() } catch { Write-Verbose 'Run mutex disposal failed after acquisition error.' } }
        throw 'Run mutex could not be acquired.'
    }
}

function Exit-OperatorProcessRunMutex {
    param([Parameter(Mandatory = $true)]$RunLock)
    $failed = $false
    try { $RunLock.mutex.ReleaseMutex() }
    catch { $failed = $true }
    try { $RunLock.mutex.Dispose() }
    catch { $failed = $true }
    if ($failed) { throw 'Run mutex could not be released safely.' }
}

function Get-OperatorValidatedProcessAttempts {
    param([Parameter(Mandatory = $true)][string]$RunDirectory)
    $safeRunDirectory = Get-OperatorSafeExistingLocalPath -LiteralPath $RunDirectory -Kind directory
    $standardRoot = Get-OperatorStandardProcessRunRoot
    if (-not [string]::Equals([IO.Path]::GetDirectoryName($safeRunDirectory), $standardRoot, [StringComparison]::OrdinalIgnoreCase) -or -not [regex]::IsMatch([string][IO.Path]::GetFileName($safeRunDirectory), '^\d{8}T\d{9}Z-[a-f0-9]{12}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Process attempt set is invalid.' }
    $processesRoot = [IO.Path]::Combine($safeRunDirectory, 'processes')
    if (-not [IO.Directory]::Exists($processesRoot)) {
        if ([IO.File]::Exists($processesRoot)) { throw 'Process attempt set is invalid.' }
        return @()
    }
    $safeProcessesRoot = Get-OperatorSafeExistingLocalPath -LiteralPath $processesRoot -Kind directory
    if (-not [string]::Equals($safeProcessesRoot, $processesRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Process attempt set is invalid.' }
    $attempts = New-Object 'Collections.Generic.List[object]'
    $seenSequences = @{}
    foreach ($entry in @(Get-ChildItem -LiteralPath $safeProcessesRoot -Force -ErrorAction Stop)) {
        if (-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Process attempt set is invalid.' }
        $match = [regex]::Match([string]$entry.Name, '^(?<sequence>\d{4})-(?<target>[a-z0-9]+(?:[.-][a-z0-9]+)*)$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)
        if (-not $match.Success) { throw 'Process attempt set is invalid.' }
        $sequence = 0
        if (-not [int]::TryParse([string]$match.Groups['sequence'].Value, [ref]$sequence) -or $sequence -lt 1 -or $sequence -gt 9999 -or $seenSequences.ContainsKey($sequence)) { throw 'Process attempt set is invalid.' }
        $targetId = [string]$match.Groups['target'].Value
        if ($null -eq (Get-OperatorProcessTargetRegistration -TargetId $targetId)) { throw 'Process attempt set is invalid.' }
        $seenSequences[$sequence] = $true
        $safeAttemptDirectory = Get-OperatorSafeExistingLocalPath -LiteralPath $entry.FullName -Kind directory
        $children = @(Get-ChildItem -LiteralPath $safeAttemptDirectory -Force -ErrorAction Stop)
        $requiredNames = @('process.json', 'stdout.log', 'stderr.log')
        if ($children.Count -ne $requiredNames.Count) { throw 'Process attempt set is invalid.' }
        foreach ($requiredName in $requiredNames) {
            $matches = @($children | Where-Object { [string]$_.Name -ceq $requiredName })
            if ($matches.Count -ne 1 -or $matches[0].PSIsContainer -or ($matches[0].Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Process attempt set is invalid.' }
        }
        $reportPath = Get-OperatorSafeExistingLocalPath -LiteralPath ([IO.Path]::Combine($safeAttemptDirectory, 'process.json')) -Kind file
        $stdoutPath = Get-OperatorSafeExistingLocalPath -LiteralPath ([IO.Path]::Combine($safeAttemptDirectory, 'stdout.log')) -Kind file
        $stderrPath = Get-OperatorSafeExistingLocalPath -LiteralPath ([IO.Path]::Combine($safeAttemptDirectory, 'stderr.log')) -Kind file
        $reportText = Read-OperatorBoundedUtf8Text -LiteralPath $reportPath -MaximumBytes 65536 -InvalidMessage 'Process attempt set is invalid.'
        try { $report = ConvertFrom-Json -InputObject $reportText -ErrorAction Stop }
        catch { throw 'Process attempt set is invalid.' }
        if (-not (Test-OperatorProcessReportContract -ProcessReport $report) -or [int]$report.sequence -ne $sequence -or [string]$report.targetId -cne $targetId -or [string]$report.cleanup.status -cne 'passed' -or [int]$report.cleanup.remainingOwnedProcessCount -ne 0) { throw 'Process attempt set is invalid.' }
        $logByteLimit = ($script:ProcessStreamLimit * 4) + 4096
        $stdout = Read-OperatorBoundedUtf8Text -LiteralPath $stdoutPath -MaximumBytes $logByteLimit -InvalidMessage 'Process attempt set is invalid.'
        $stderr = Read-OperatorBoundedUtf8Text -LiteralPath $stderrPath -MaximumBytes $logByteLimit -InvalidMessage 'Process attempt set is invalid.'
        if ($stdout.Length -gt $script:ProcessStreamLimit -or $stderr.Length -gt $script:ProcessStreamLimit -or -not (Test-OperatorLogTextSafe -Text $stdout) -or -not (Test-OperatorLogTextSafe -Text $stderr)) { throw 'Process attempt set is invalid.' }
        $attempts.Add([pscustomobject][ordered]@{ sequence = [int]$sequence; targetId = $targetId; directory = $safeAttemptDirectory; reportPath = $reportPath; stdoutPath = $stdoutPath; stderrPath = $stderrPath; report = $report })
    }
    $orderedAttempts = @($attempts.ToArray() | Sort-Object -Property sequence)
    for ($index = 0; $index -lt $orderedAttempts.Count; $index++) { if ([int]$orderedAttempts[$index].sequence -ne ($index + 1)) { throw 'Process attempt set is invalid.' } }
    return $orderedAttempts
}

function Get-OperatorNextProcessDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$RunDirectory,
        [Parameter(Mandatory = $true)][string]$TargetId
    )
    $safeRunDirectory = Get-OperatorSafeExistingLocalPath -LiteralPath $RunDirectory -Kind directory
    $standardRoot = Get-OperatorStandardProcessRunRoot
    if (-not [string]::Equals([IO.Path]::GetDirectoryName($safeRunDirectory), $standardRoot, [StringComparison]::OrdinalIgnoreCase) -or -not [regex]::IsMatch([string][IO.Path]::GetFileName($safeRunDirectory), '^\d{8}T\d{9}Z-[a-f0-9]{12}$', [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { throw 'Run directory is invalid.' }
    if ($null -eq (Get-OperatorProcessTargetRegistration -TargetId $TargetId)) { throw 'Process target registration is invalid.' }
    $existingAttempts = @(Get-OperatorValidatedProcessAttempts -RunDirectory $safeRunDirectory)
    $processesRoot = [IO.Path]::Combine($safeRunDirectory, 'processes')
    if (-not [IO.Directory]::Exists($processesRoot)) { [IO.Directory]::CreateDirectory($processesRoot) | Out-Null }
    $processesRoot = Get-OperatorSafeExistingLocalPath -LiteralPath $processesRoot -Kind directory
    $sequence = $existingAttempts.Count + 1
    if ($sequence -gt 9999) { throw 'Process sequence limit was reached.' }
    $path = [IO.Path]::Combine($processesRoot, ('{0:D4}-{1}' -f $sequence, $TargetId))
    New-Item -Path $path -ItemType Directory -ErrorAction Stop | Out-Null
    return [pscustomobject][ordered]@{ sequence = [int]$sequence; processDirectory = [IO.Path]::GetFullPath($path) }
}

function New-OperatorProcessResultObject {
    param(
        [Parameter(Mandatory = $true)][int]$Sequence,
        [Parameter(Mandatory = $true)][string]$TargetId,
        [Parameter(Mandatory = $true)][ValidateSet('passed', 'failed', 'blocked', 'error')][string]$Status,
        [AllowNull()]$ExitCode,
        [Parameter(Mandatory = $true)][DateTime]$StartedAtUtc,
        [Parameter(Mandatory = $true)][DateTime]$FinishedAtUtc,
        [AllowNull()]$WorkerPid,
        [AllowNull()]$TargetPid,
        [Parameter(Mandatory = $true)][bool]$TimedOut,
        [Parameter(Mandatory = $true)][ValidateSet('not-configured', 'passed', 'failed')][string]$HealthStatus,
        [Parameter(Mandatory = $true)][bool]$StdoutTruncated,
        [Parameter(Mandatory = $true)][bool]$StderrTruncated,
        [Parameter(Mandatory = $true)]$Cleanup
    )
    $duration = [Math]::Max(0, [int64][Math]::Round(($FinishedAtUtc.ToUniversalTime() - $StartedAtUtc.ToUniversalTime()).TotalMilliseconds))
    return [pscustomobject][ordered]@{
        schemaVersion = [int]1; sequence = [int]$Sequence; targetId = $TargetId; status = $Status
        exitCode = if ($null -eq $ExitCode) { $null } else { [int]$ExitCode }
        startedAtUtc = $StartedAtUtc.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
        finishedAtUtc = $FinishedAtUtc.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
        durationMs = [int64]$duration
        workerPid = if ($null -eq $WorkerPid) { $null } else { [int]$WorkerPid }
        targetPid = if ($null -eq $TargetPid) { $null } else { [int]$TargetPid }
        timedOut = $TimedOut; healthStatus = $HealthStatus; stdoutTruncated = $StdoutTruncated; stderrTruncated = $StderrTruncated
        cleanup = [pscustomobject][ordered]@{ status = [string]$Cleanup.status; ownedProcessCount = [int]$Cleanup.ownedProcessCount; terminatedProcessCount = [int]$Cleanup.terminatedProcessCount; remainingOwnedProcessCount = [int]$Cleanup.remainingOwnedProcessCount }
    }
}

function Get-OperatorValidatedControlRecord {
    param(
        [Parameter(Mandatory = $true)][string]$ControlFilePath,
        [Parameter(Mandatory = $true)][string]$TargetId
    )
    $item = Get-Item -LiteralPath $ControlFilePath -Force -ErrorAction Stop
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [int64]$item.Length -gt 4096) { throw 'Worker control record is invalid.' }
    $text = Read-OperatorBoundedUtf8Text -LiteralPath $item.FullName -MaximumBytes 4096 -InvalidMessage 'Worker control record is invalid.'
    $record = ConvertFrom-Json -InputObject $text -ErrorAction Stop
    if ($record -isnot [pscustomobject]) { throw 'Worker control record is invalid.' }
    $names = @($record.PSObject.Properties.Name)
    $expected = @('schemaVersion', 'targetId', 'workerPid', 'targetPid', 'startedAtUtc')
    if ($names.Count -ne $expected.Count) { throw 'Worker control record is invalid.' }
    foreach ($name in $expected) { if ($names -cnotcontains $name) { throw 'Worker control record is invalid.' } }
    if ($record.schemaVersion -isnot [int] -or [int]$record.schemaVersion -ne 1 -or $record.targetId -isnot [string] -or [string]$record.targetId -cne $TargetId) { throw 'Worker control record is invalid.' }
    if ($record.workerPid -isnot [int] -or $record.targetPid -isnot [int] -or [int]$record.workerPid -le 0 -or [int]$record.targetPid -le 0 -or [int]$record.workerPid -eq [int]$record.targetPid) { throw 'Worker control record is invalid.' }
    $parsed = [DateTime]::MinValue
    $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
    if ($record.startedAtUtc -isnot [string] -or -not [DateTime]::TryParseExact([string]$record.startedAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$parsed)) { throw 'Worker control record is invalid.' }
    return [pscustomobject][ordered]@{ workerPid = [int]$record.workerPid; targetPid = [int]$record.targetPid; startedAtUtc = $parsed }
}

function Get-OperatorValidatedCompletionRecord {
    param(
        [Parameter(Mandatory = $true)][string]$CompletionFilePath,
        [Parameter(Mandatory = $true)][string]$TargetId,
        [Parameter(Mandatory = $true)][int]$WorkerPid,
        [Parameter(Mandatory = $true)][int]$TargetPid
    )
    $item = Get-Item -LiteralPath $CompletionFilePath -Force -ErrorAction Stop
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [int64]$item.Length -gt 4096) { throw 'Worker completion record is invalid.' }
    $text = Read-OperatorBoundedUtf8Text -LiteralPath $item.FullName -MaximumBytes 4096 -InvalidMessage 'Worker completion record is invalid.'
    $record = ConvertFrom-Json -InputObject $text -ErrorAction Stop
    if ($record -isnot [pscustomobject]) { throw 'Worker completion record is invalid.' }
    $names = @($record.PSObject.Properties.Name)
    $expected = @('schemaVersion', 'targetId', 'workerPid', 'targetPid', 'targetExitCode', 'completedAtUtc')
    if ($names.Count -ne $expected.Count) { throw 'Worker completion record is invalid.' }
    foreach ($name in $expected) { if ($names -cnotcontains $name) { throw 'Worker completion record is invalid.' } }
    if ($record.schemaVersion -isnot [int] -or [int]$record.schemaVersion -ne 1 -or $record.targetId -isnot [string] -or [string]$record.targetId -cne $TargetId) { throw 'Worker completion record is invalid.' }
    if ($record.workerPid -isnot [int] -or $record.targetPid -isnot [int] -or [int]$record.workerPid -ne $WorkerPid -or [int]$record.targetPid -ne $TargetPid -or $record.targetExitCode -isnot [int]) { throw 'Worker completion record is invalid.' }
    $parsed = [DateTime]::MinValue
    $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
    if ($record.completedAtUtc -isnot [string] -or -not [DateTime]::TryParseExact([string]$record.completedAtUtc, 'yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$parsed)) { throw 'Worker completion record is invalid.' }
    return [pscustomobject][ordered]@{ targetExitCode = [int]$record.targetExitCode; completedAtUtc = $parsed }
}

function Read-OperatorBoundedUtf8Text {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][ValidateRange(1, 25165824)][int]$MaximumBytes,
        [Parameter(Mandatory = $true)][string]$InvalidMessage
    )
    $item = Get-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [int64]$item.Length -gt $MaximumBytes) { throw $InvalidMessage }
    $stream = New-Object IO.FileStream($item.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        $buffer = New-Object byte[] ($MaximumBytes + 1)
        $total = 0
        while ($total -lt $buffer.Length) {
            $read = $stream.Read($buffer, $total, $buffer.Length - $total)
            if ($read -eq 0) { break }
            $total += $read
        }
        if ($total -gt $MaximumBytes -or $stream.ReadByte() -ne -1) { throw $InvalidMessage }
        return (New-Object Text.UTF8Encoding($false, $true)).GetString($buffer, 0, $total)
    }
    finally { $stream.Dispose() }
}

function Get-OperatorFinalStreamLog {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text,
        [Parameter(Mandatory = $true)][bool]$Truncated
    )
    $safe = Protect-OperatorLogText -Text $Text
    $wasTruncated = $Truncated -or $safe.Length -gt $script:ProcessStreamLimit
    if (-not $wasTruncated) { return [pscustomobject][ordered]@{ text = $safe; truncated = $false } }
    $marker = '[TRUNCATED:stream-limit]' + [Environment]::NewLine
    $maximumContent = $script:ProcessStreamLimit - $marker.Length
    if ($safe.Length -gt $maximumContent) { $safe = $safe.Substring(0, $maximumContent) }
    return [pscustomobject][ordered]@{ text = $safe + $marker; truncated = $true }
}

function Stop-OperatorKnownUnassignedWorker {
    param([Parameter(Mandatory = $true)]$WorkerCapture)
    $wasRunning = $false
    try { $wasRunning = -not [bool]$WorkerCapture.HasExited }
    catch { $wasRunning = $true }
    if (-not $wasRunning) { return [pscustomobject][ordered]@{ wasRunning = $false; stopped = $true } }
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try { $WorkerCapture.TerminateKnownProcess() }
        catch { Write-Verbose 'Known worker termination attempt failed.' }
        try { [void]$WorkerCapture.WaitForExit(5000) }
        catch { Write-Verbose 'Known worker exit verification failed.' }
        try { if ([bool]$WorkerCapture.HasExited) { return [pscustomobject][ordered]@{ wasRunning = $true; stopped = $true } } }
        catch { Write-Verbose 'Known worker state verification failed.' }
    }
    return [pscustomobject][ordered]@{ wasRunning = $true; stopped = $false }
}

function Write-OperatorPrestartProcessAttempt {
    param(
        [Parameter(Mandatory = $true)]$Attempt,
        [Parameter(Mandatory = $true)][string]$TargetId,
        [Parameter(Mandatory = $true)][DateTime]$StartedAtUtc,
        [Parameter(Mandatory = $true)][ValidateSet('blocked', 'error')][string]$Status
    )
    $cleanup = [pscustomobject]@{ status = 'passed'; ownedProcessCount = 0; terminatedProcessCount = 0; remainingOwnedProcessCount = 0 }
    $finished = [DateTime]::UtcNow
    $result = New-OperatorProcessResultObject -Sequence $Attempt.sequence -TargetId $TargetId -Status $Status -ExitCode $null -StartedAtUtc $StartedAtUtc -FinishedAtUtc $finished -WorkerPid $null -TargetPid $null -TimedOut $false -HealthStatus 'not-configured' -StdoutTruncated $false -StderrTruncated $false -Cleanup $cleanup
    Write-OperatorProcessLog -ProcessDirectory $Attempt.processDirectory -Stream stdout -Text ''
    Write-OperatorProcessLog -ProcessDirectory $Attempt.processDirectory -Stream stderr -Text ''
    Write-OperatorProcessReport -ProcessDirectory $Attempt.processDirectory -ProcessReport $result
    return $result
}

function Invoke-OperatorProcessTargetLocked {
    param(
        [Parameter(Mandatory = $true)][AllowNull()]$RunContext,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyString()][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyString()][string]$Stage,
        [Parameter(Mandatory = $true)][AllowNull()]$TargetId,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyString()][string]$TimeoutProfile
    )

    Assert-OperatorProcessTargetRegistry
    if ($TargetId -isnot [string] -or -not [regex]::IsMatch([string]$TargetId, $script:ProcessTargetIdPattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return New-OperatorProcessRejection -ReasonCode 'invalid-target-id' }
    $registration = Get-OperatorProcessTargetRegistration -TargetId $TargetId
    if ($null -eq $registration) { return New-OperatorProcessRejection -ReasonCode 'unknown-target-id' }

    if (-not (Test-OperatorProcessRunContext -RunContext $RunContext)) {
        $cleanup = [pscustomobject]@{ status = 'passed'; ownedProcessCount = 0; terminatedProcessCount = 0; remainingOwnedProcessCount = 0 }
        $now = [DateTime]::UtcNow
        return New-OperatorProcessResultObject -Sequence 1 -TargetId $TargetId -Status blocked -ExitCode $null -StartedAtUtc $now -FinishedAtUtc $now -WorkerPid $null -TargetPid $null -TimedOut $false -HealthStatus 'not-configured' -StdoutTruncated $false -StderrTruncated $false -Cleanup $cleanup
    }

    $attemptStarted = [DateTime]::UtcNow
    $attempt = Get-OperatorNextProcessDirectory -RunDirectory ([string]$RunContext.RunDirectory) -TargetId $TargetId
    $allowed = Test-OperatorProcessTargetAllowed -TargetId $TargetId -Stage ([string]$Stage) -TimeoutProfile ([string]$TimeoutProfile)
    if (-not $allowed.isAllowed) { return Write-OperatorPrestartProcessAttempt -Attempt $attempt -TargetId $TargetId -StartedAtUtc $attemptStarted -Status blocked }

    $launch = $null
    try {
        $policy = New-OperatorPathPolicy -RepositoryRoot $RepositoryRoot
        if ([string]$policy.repositoryRoot -cne [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\', '/')) { Throw-OperatorProcessCondition -Kind Error }
        $environmentCheck = Test-OperatorLocalEnvironmentVariables -Variables ([Environment]::GetEnvironmentVariables())
        if ([string]$environmentCheck.status -cne 'clear') { Throw-OperatorProcessCondition -Kind Blocked }
        $launch = Resolve-OperatorProcessLaunchDefinition -RepositoryRoot $RepositoryRoot -TargetId $TargetId
        $metadata = @(
            [pscustomobject][ordered]@{ sourceId = 'executable'; value = [string]$launch.executablePath },
            [pscustomobject][ordered]@{ sourceId = 'working-directory'; value = [string]$launch.workingDirectory }
        )
        $metadataCheck = Test-OperatorLocalConnectionMetadata -Metadata $metadata
        if ([string]$metadataCheck.status -cne 'clear') { Throw-OperatorProcessCondition -Kind Blocked }
    }
    catch {
        $prestartStatus = if ((Get-OperatorProcessConditionKind -Exception $_.Exception) -ceq 'Blocked') { 'blocked' } else { 'error' }
        return Write-OperatorPrestartProcessAttempt -Attempt $attempt -TargetId $TargetId -StartedAtUtc $attemptStarted -Status $prestartStatus
    }

    $workerCapture = $null
    $job = $null
    $gate = $null
    $controlFilePath = [IO.Path]::Combine([string]$attempt.processDirectory, 'control.json')
    $completionFilePath = [IO.Path]::Combine([string]$attempt.processDirectory, 'completion.json')
    $observed = New-Object 'Collections.Generic.HashSet[int]'
    $workerPid = $null
    $targetPid = $null
    $exitCode = $null
    $timedOut = $false
    $healthStatus = if ($null -eq $registration.healthCheck) { 'not-configured' } else { 'failed' }
    $status = 'error'
    $startedAt = $attemptStarted
    $forcedBefore = @()
    $terminatedCount = 0
    $remainingCount = 0
    $cleanupStatus = 'passed'
    $streamFailure = $false
    $workerAssigned = $false
    $resourceFailure = $false
    $stdoutRaw = ''
    $stderrRaw = ''
    $stdoutCaptureTruncated = $false
    $stderrCaptureTruncated = $false

    try {
        $workerPath = Get-OperatorSafeExistingLocalPath -LiteralPath ([IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', 'Operator.ProcessWorker.ps1'))) -Kind file
        $powerShellPath = Get-OperatorSafeExistingLocalPath -LiteralPath ([IO.Path]::Combine($PSHOME, 'powershell.exe')) -Kind file
        $gateName = 'Local\Plaerrdeifl-M000-' + ([string]$RunContext.RunId) + '-' + [Guid]::NewGuid().ToString('N')
        $createdNew = $false
        $gate = New-Object Threading.EventWaitHandle($false, [Threading.EventResetMode]::ManualReset, $gateName, [ref]$createdNew)
        if (-not $createdNew) { throw 'Process start gate creation failed.' }
        $workerArguments = @('-NoLogo', '-NoProfile', '-NonInteractive', '-File', $workerPath, '-TargetId', $TargetId, '-RepositoryRoot', [string]$policy.repositoryRoot, '-RunDirectory', [string]$RunContext.RunDirectory, '-ProcessDirectory', [string]$attempt.processDirectory, '-GateName', $gateName, '-ControlFilePath', $controlFilePath)
        $workerCommandLine = ConvertTo-OperatorWindowsCommandLine -Arguments $workerArguments
        $workerCapture = [Plaerrdeifl.Operator.BoundedProcess]::Start($powerShellPath, $workerCommandLine, [string]$RunContext.RunDirectory, $script:ProcessStreamLimit)
        $workerPid = [int]$workerCapture.Id
        [void]$observed.Add($workerPid)
        $job = New-Object Plaerrdeifl.Operator.OperatorJob
        $job.Assign($workerCapture.Handle)
        $workerAssigned = $true
        [void]$gate.Set()

        $startDeadline = [DateTime]::UtcNow.AddSeconds([int]$registration.startTimeoutSeconds)
        $control = $null
        while ([DateTime]::UtcNow -lt $startDeadline) {
            foreach ($pidValue in @($job.GetProcessIds())) { [void]$observed.Add([int]$pidValue) }
            if ([IO.File]::Exists($controlFilePath)) { $control = Get-OperatorValidatedControlRecord -ControlFilePath $controlFilePath -TargetId $TargetId; break }
            if ($workerCapture.HasExited) { break }
            Start-Sleep -Milliseconds 50
        }
        if ($null -eq $control) { throw 'Worker start protocol failed.' }
        if ([int]$control.workerPid -ne $workerPid) { throw 'Worker start protocol failed.' }
        $targetPid = [int]$control.targetPid
        $startedAt = [DateTime]$control.startedAtUtc
        [void]$observed.Add($targetPid)
        foreach ($pidValue in @($job.GetProcessIds())) { [void]$observed.Add([int]$pidValue) }

        if ($null -ne $registration.healthCheck) {
            $healthDeadline = $startedAt.AddSeconds([int]$registration.healthCheck.timeoutSeconds)
            while ([DateTime]::UtcNow -lt $healthDeadline) {
                foreach ($pidValue in @($job.GetProcessIds())) { [void]$observed.Add([int]$pidValue) }
                $stdoutSnapshot = [string]$workerCapture.GetStdout()
                if ($stdoutSnapshot.IndexOf([string]$registration.healthCheck.token, [StringComparison]::Ordinal) -ge 0 -and @($job.GetProcessIds()) -contains $targetPid) { $healthStatus = 'passed'; break }
                if ($workerCapture.HasExited -or $workerCapture.StreamFailed) { break }
                Start-Sleep -Milliseconds 50
            }
            if ($healthStatus -cne 'passed') {
                $status = 'failed'
                $forcedBefore = @($job.GetProcessIds())
                foreach ($pidValue in $forcedBefore) { [void]$observed.Add([int]$pidValue) }
                $job.Terminate()
            }
        }

        if ($status -cne 'failed') {
            $runtimeDeadline = $startedAt.AddSeconds([int]$script:ProcessTimeoutProfiles[$TimeoutProfile])
            while (-not $workerCapture.HasExited -and [DateTime]::UtcNow -lt $runtimeDeadline) {
                foreach ($pidValue in @($job.GetProcessIds())) { [void]$observed.Add([int]$pidValue) }
                Start-Sleep -Milliseconds 50
            }
            if (-not $workerCapture.HasExited) {
                $timedOut = $true
                $status = 'failed'
                $forcedBefore = @($job.GetProcessIds())
                foreach ($pidValue in $forcedBefore) { [void]$observed.Add([int]$pidValue) }
                $job.Terminate()
            }
            else {
                [void]$workerCapture.WaitForStreams(5000)
                $streamFailure = [bool]$workerCapture.StreamFailed
                if ($streamFailure) { $status = 'error' }
                elseif ([int]$workerCapture.ExitCode -ne 0) { $status = 'error' }
                else {
                    $completion = Get-OperatorValidatedCompletionRecord -CompletionFilePath $completionFilePath -TargetId $TargetId -WorkerPid $workerPid -TargetPid $targetPid
                    $exitCode = [int]$completion.targetExitCode
                    if ($exitCode -eq 0) { $status = 'passed' } else { $status = 'failed' }
                }
            }
        }
    }
    catch {
        $status = 'error'
        if ($null -ne $job) {
            try {
                $forcedBefore = @($job.GetProcessIds())
                foreach ($pidValue in $forcedBefore) { [void]$observed.Add([int]$pidValue) }
                $job.Terminate()
            }
            catch { $cleanupStatus = 'failed' }
        }
    }
    finally {
        if ($null -ne $job) {
            try {
                $cleanupDeadline = [DateTime]::UtcNow.AddSeconds(5)
                while ($job.ActiveProcessCount -gt 0 -and [DateTime]::UtcNow -lt $cleanupDeadline) {
                    foreach ($pidValue in @($job.GetProcessIds())) { [void]$observed.Add([int]$pidValue) }
                    Start-Sleep -Milliseconds 50
                }
                if ($job.ActiveProcessCount -gt 0) {
                    $forcedBefore = @($job.GetProcessIds())
                    foreach ($pidValue in $forcedBefore) { [void]$observed.Add([int]$pidValue) }
                    $job.Terminate()
                    $terminationDeadline = [DateTime]::UtcNow.AddSeconds(5)
                    while ($job.ActiveProcessCount -gt 0 -and [DateTime]::UtcNow -lt $terminationDeadline) { Start-Sleep -Milliseconds 50 }
                }
                $remaining = @($job.GetProcessIds())
                $remainingCount = $remaining.Count
                foreach ($pidValue in $forcedBefore) { if ($remaining -notcontains [int]$pidValue) { $terminatedCount++ } }
                if ($remainingCount -gt 0) { $cleanupStatus = 'failed' }
            }
            catch { $cleanupStatus = 'failed'; $remainingCount = [Math]::Max(1, $remainingCount) }
            try { $job.Dispose() }
            catch { $resourceFailure = $true }
        }
        if ($null -ne $gate) {
            try { $gate.Dispose() }
            catch { $resourceFailure = $true }
        }
        try { if ([IO.File]::Exists($controlFilePath)) { [IO.File]::Delete($controlFilePath) } }
        catch { $resourceFailure = $true }
        try { if ([IO.File]::Exists($completionFilePath)) { [IO.File]::Delete($completionFilePath) } }
        catch { $resourceFailure = $true }
        if ($null -ne $workerCapture) {
            if (-not $workerAssigned) {
                $knownWorkerCleanup = Stop-OperatorKnownUnassignedWorker -WorkerCapture $workerCapture
                if ([bool]$knownWorkerCleanup.wasRunning -and [bool]$knownWorkerCleanup.stopped) { $terminatedCount++ }
                if (-not [bool]$knownWorkerCleanup.stopped) {
                    $cleanupStatus = 'failed'
                    $remainingCount = [Math]::Max(1, $remainingCount)
                }
            }
            try {
                if ($workerCapture.HasExited -and -not $workerCapture.WaitForStreams(5000)) { $resourceFailure = $true }
                $stdoutRaw = [string]$workerCapture.GetStdout()
                $stderrRaw = [string]$workerCapture.GetStderr()
                $stdoutCaptureTruncated = [bool]$workerCapture.StdoutTruncated
                $stderrCaptureTruncated = [bool]$workerCapture.StderrTruncated
                if ([bool]$workerCapture.StreamFailed) { $resourceFailure = $true }
            }
            catch { $resourceFailure = $true }
            try { $workerCapture.Dispose() }
            catch { $resourceFailure = $true }
        }
    }

    $stdoutLog = Get-OperatorFinalStreamLog -Text $stdoutRaw -Truncated $stdoutCaptureTruncated
    $stderrLog = Get-OperatorFinalStreamLog -Text $stderrRaw -Truncated $stderrCaptureTruncated
    $stdoutText = [string]$stdoutLog.text
    $stderrText = [string]$stderrLog.text
    $stdoutTruncated = [bool]$stdoutLog.truncated
    $stderrTruncated = [bool]$stderrLog.truncated
    if ($cleanupStatus -cne 'passed' -or $remainingCount -gt 0) { $status = 'blocked' }
    elseif ($resourceFailure) { $status = 'error' }
    if ($null -ne $registration.healthCheck -and $healthStatus -cne 'passed' -and $status -ceq 'passed') { $status = 'failed' }
    $cleanup = [pscustomobject]@{ status = $cleanupStatus; ownedProcessCount = [int]$observed.Count; terminatedProcessCount = [int]$terminatedCount; remainingOwnedProcessCount = [int]$remainingCount }
    $finishedAt = [DateTime]::UtcNow
    $result = New-OperatorProcessResultObject -Sequence $attempt.sequence -TargetId $TargetId -Status $status -ExitCode $exitCode -StartedAtUtc $startedAt -FinishedAtUtc $finishedAt -WorkerPid $workerPid -TargetPid $targetPid -TimedOut $timedOut -HealthStatus $healthStatus -StdoutTruncated $stdoutTruncated -StderrTruncated $stderrTruncated -Cleanup $cleanup
    Write-OperatorProcessLog -ProcessDirectory $attempt.processDirectory -Stream stdout -Text $stdoutText
    Write-OperatorProcessLog -ProcessDirectory $attempt.processDirectory -Stream stderr -Text $stderrText
    Write-OperatorProcessReport -ProcessDirectory $attempt.processDirectory -ProcessReport $result
    return $result
}

function Invoke-OperatorProcessTarget {
    param(
        [Parameter(Mandatory = $true)][AllowNull()]$RunContext,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyString()][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyString()][string]$Stage,
        [Parameter(Mandatory = $true)][AllowNull()]$TargetId,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyString()][string]$TimeoutProfile
    )
    Assert-OperatorProcessTargetRegistry
    if ($TargetId -isnot [string] -or -not [regex]::IsMatch([string]$TargetId, $script:ProcessTargetIdPattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)) { return New-OperatorProcessRejection -ReasonCode 'invalid-target-id' }
    if ($null -eq (Get-OperatorProcessTargetRegistration -TargetId ([string]$TargetId))) { return New-OperatorProcessRejection -ReasonCode 'unknown-target-id' }
    if (-not (Test-OperatorProcessRunContext -RunContext $RunContext)) {
        $cleanup = [pscustomobject]@{ status = 'passed'; ownedProcessCount = 0; terminatedProcessCount = 0; remainingOwnedProcessCount = 0 }
        $now = [DateTime]::UtcNow
        return New-OperatorProcessResultObject -Sequence 1 -TargetId ([string]$TargetId) -Status blocked -ExitCode $null -StartedAtUtc $now -FinishedAtUtc $now -WorkerPid $null -TargetPid $null -TimedOut $false -HealthStatus 'not-configured' -StdoutTruncated $false -StderrTruncated $false -Cleanup $cleanup
    }
    $runLock = Enter-OperatorProcessRunMutex -RunId ([string]$RunContext.RunId)
    try {
        [void](Get-OperatorValidatedProcessAttempts -RunDirectory ([string]$RunContext.RunDirectory))
        return Invoke-OperatorProcessTargetLocked -RunContext $RunContext -RepositoryRoot $RepositoryRoot -Stage $Stage -TargetId ([string]$TargetId) -TimeoutProfile $TimeoutProfile
    }
    finally { Exit-OperatorProcessRunMutex -RunLock $runLock }
}

function Initialize-OperatorProcessRunReportsLocked {
    param([Parameter(Mandatory = $true)]$RunContext)
    if (-not (Test-OperatorProcessRunContext -RunContext $RunContext)) { throw 'Run context is invalid.' }
    Write-OperatorRunProcessLogs -RunDirectory ([string]$RunContext.RunDirectory) -StdoutText '' -StderrText ''
    $cleanup = [pscustomobject][ordered]@{ schemaVersion = [int]1; status = 'skipped'; ownedProcessCount = [int]0; terminatedProcessCount = [int]0; remainingOwnedProcessCount = [int]0; completedAtUtc = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture) }
    Write-OperatorCleanupReport -RunDirectory ([string]$RunContext.RunDirectory) -CleanupReport $cleanup
}

function Initialize-OperatorProcessRunReports {
    param([Parameter(Mandatory = $true)]$RunContext)
    if (-not (Test-OperatorProcessRunContext -RunContext $RunContext)) { throw 'Run context is invalid.' }
    $runLock = Enter-OperatorProcessRunMutex -RunId ([string]$RunContext.RunId)
    try {
        $runDirectory = [string]$RunContext.RunDirectory
        if (@(Get-ChildItem -LiteralPath $runDirectory -Force -ErrorAction Stop).Count -ne 0) { throw 'Run reports were already initialized.' }
        Initialize-OperatorProcessRunReportsLocked -RunContext $RunContext
    }
    finally { Exit-OperatorProcessRunMutex -RunLock $runLock }
}

function Complete-OperatorProcessRunLocked {
    param([Parameter(Mandatory = $true)]$RunContext)
    if (-not (Test-OperatorProcessRunContext -RunContext $RunContext)) { throw 'Run context is invalid.' }
    $runDirectory = [string]$RunContext.RunDirectory
    $attempts = @(Get-OperatorValidatedProcessAttempts -RunDirectory $runDirectory)
    $stdoutAggregate = [pscustomobject][ordered]@{ builder = (New-Object Text.StringBuilder); truncated = $false }
    $stderrAggregate = [pscustomobject][ordered]@{ builder = (New-Object Text.StringBuilder); truncated = $false }
    $owned = 0
    $terminated = 0
    $remaining = 0
    $processCount = 0
    $cleanupFailed = $false
    $marker = '[TRUNCATED:stream-limit]' + [Environment]::NewLine
    foreach ($attempt in $attempts) {
        $logByteLimit = ($script:ProcessStreamLimit * 4) + 4096
        $stdout = Read-OperatorBoundedUtf8Text -LiteralPath ([string]$attempt.stdoutPath) -MaximumBytes $logByteLimit -InvalidMessage 'Process log set is invalid.'
        $stderr = Read-OperatorBoundedUtf8Text -LiteralPath ([string]$attempt.stderrPath) -MaximumBytes $logByteLimit -InvalidMessage 'Process log set is invalid.'
        if ($stdout.Length -gt $script:ProcessStreamLimit -or $stderr.Length -gt $script:ProcessStreamLimit -or -not (Test-OperatorLogTextSafe -Text $stdout) -or -not (Test-OperatorLogTextSafe -Text $stderr)) { throw 'Process log set is invalid.' }
        $header = ('[{0:D4} {1}]' -f [int]$attempt.sequence, [string]$attempt.targetId) + [Environment]::NewLine
        foreach ($aggregateItem in @(
            [pscustomobject]@{ state = $stdoutAggregate; text = $stdout },
            [pscustomobject]@{ state = $stderrAggregate; text = $stderr }
        )) {
            $state = $aggregateItem.state
            if (-not [bool]$state.truncated) {
                $separator = if ($state.builder.Length -eq 0) { '' } else { [Environment]::NewLine }
                $chunk = $separator + $header + [string]$aggregateItem.text
                if (($state.builder.Length + $chunk.Length) -le $script:ProcessStreamLimit) { [void]$state.builder.Append($chunk) }
                else {
                    $maximumContent = $script:ProcessStreamLimit - $marker.Length
                    if ($state.builder.Length -gt $maximumContent) { $state.builder.Length = $maximumContent }
                    $available = $maximumContent - $state.builder.Length
                    if ($available -gt 0) { [void]$state.builder.Append($chunk.Substring(0, [Math]::Min($available, $chunk.Length))) }
                    [void]$state.builder.Append($marker)
                    $state.truncated = $true
                }
            }
        }
        $report = $attempt.report
        if ([int64]$owned + [int64]$report.cleanup.ownedProcessCount -gt [int]::MaxValue -or [int64]$terminated + [int64]$report.cleanup.terminatedProcessCount -gt [int]::MaxValue -or [int64]$remaining + [int64]$report.cleanup.remainingOwnedProcessCount -gt [int]::MaxValue) { throw 'Process cleanup aggregate is invalid.' }
        $owned += [int]$report.cleanup.ownedProcessCount
        $terminated += [int]$report.cleanup.terminatedProcessCount
        $remaining += [int]$report.cleanup.remainingOwnedProcessCount
        if ([string]$report.cleanup.status -cne 'passed') { $cleanupFailed = $true }
        $processCount++
    }
    Write-OperatorRunProcessLogs -RunDirectory $runDirectory -StdoutText $stdoutAggregate.builder.ToString() -StderrText $stderrAggregate.builder.ToString()
    $cleanupStatus = if ($processCount -eq 0) { 'skipped' } elseif ($cleanupFailed -or $remaining -gt 0) { 'failed' } else { 'passed' }
    $cleanup = [pscustomobject][ordered]@{ schemaVersion = [int]1; status = $cleanupStatus; ownedProcessCount = [int]$owned; terminatedProcessCount = [int]$terminated; remainingOwnedProcessCount = [int]$remaining; completedAtUtc = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture) }
    Write-OperatorCleanupReport -RunDirectory $runDirectory -CleanupReport $cleanup
    return $cleanup
}

function Complete-OperatorProcessRun {
    param([Parameter(Mandatory = $true)]$RunContext)
    if (-not (Test-OperatorProcessRunContext -RunContext $RunContext)) { throw 'Run context is invalid.' }
    $runLock = Enter-OperatorProcessRunMutex -RunId ([string]$RunContext.RunId)
    try { return Complete-OperatorProcessRunLocked -RunContext $RunContext }
    finally { Exit-OperatorProcessRunMutex -RunLock $runLock }
}

Export-ModuleMember -Function @(
    'Get-OperatorProcessTargetRegistrySnapshot',
    'Get-OperatorProcessTargetRegistration',
    'Test-OperatorProcessTargetAllowed',
    'Resolve-OperatorProcessLaunchDefinition',
    'ConvertTo-OperatorWindowsCommandLine',
    'Invoke-OperatorProcessTarget',
    'Complete-OperatorProcessRun',
    'Initialize-OperatorProcessRunReports'
)
