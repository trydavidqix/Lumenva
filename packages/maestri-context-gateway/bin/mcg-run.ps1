param(
    [Parameter(Mandatory)]
    [ValidateSet("codex","antigravity")]
    [string]$Executor,

    [Parameter(Mandatory)]
    [string]$Objective,

    [string[]]$Acceptance = @(),

    [string[]]$Constraints = @(),

    [ValidateSet("read-only","workspace-write")]
    [string]$Sandbox = "workspace-write",

    [string]$Project = "C:\Users\David\Desktop\Projetos\Lumenva"
)

$ErrorActionPreference = "Stop"

$root  = "$HOME\.lumenva\maestri-context-gateway"
$mcg   = "$root\bin\mcg.mjs"

$codex = "$HOME\.codex\packages\standalone\current\bin\codex.exe"
$agy   = "$env:LOCALAPPDATA\agy\bin\agy.exe"

$id = "MCG-{0}-{1}" -f `
    ([DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")), `
    ([guid]::NewGuid().ToString("N").Substring(0,8))

# =========================================================
# 1. DISPATCH
# =========================================================

$agent = if($Executor -eq "codex") { "Codex CTO" } else { "Antigravity CIO" }
$runtime = if($Executor -eq "codex") { "Codex CLI" } else { "Antigravity CLI" }

$dispatch = @{
    task_id     = $id
    project     = $Project
    executor    = $Executor
    agent       = $agent
    runtime     = $runtime
    ide         = $runtime
    source      = @{ host_agent = $agent }
    objective   = $Objective
    constraints = $Constraints
    acceptance  = $Acceptance
}

$dispatch |
    ConvertTo-Json -Depth 20 |
    & node $mcg dispatch |
    Out-Null

$taskDir = Join-Path $root "tasks\$id"
$evDir   = Join-Path $taskDir "evidence"

New-Item -ItemType Directory -Force -Path $evDir | Out-Null

$promptFile = Join-Path $evDir "prompt.txt"
$stdoutFile = Join-Path $evDir "executor-stdout.log"
$stderrFile = Join-Path $evDir "executor-stderr.log"
$finalFile  = Join-Path $evDir "executor-final.txt"

# =========================================================
# 2. PROMPT DO EXECUTOR
# =========================================================

$acceptanceText = if($Acceptance.Count) {
    ($Acceptance | ForEach-Object { "- $_" }) -join "`n"
} else {
    "- Complete the objective and provide verifiable evidence."
}

$constraintText = if($Constraints.Count) {
    ($Constraints | ForEach-Object { "- $_" }) -join "`n"
} else {
    "- Stay inside the assigned project."
}

$prompt = @"
You are the assigned Lumenva executor.

TASK_ID:
$id

EXECUTOR:
$Executor

PROJECT:
$Project

OBJECTIVE:
$Objective

ACCEPTANCE:
$acceptanceText

CONSTRAINTS:
$constraintText

EXECUTION CONTRACT:
- Do the assigned work.
- Verify the result.
- Keep the FINAL response concise.
- Do not paste large logs in the final response.
- Store detailed evidence in files when useful.
- Report changed files and validation performed.
- A process exit code alone is NOT proof of success.
- If blocked, state exactly what blocked execution.
"@

Set-Content $promptFile $prompt -Encoding utf8

# =========================================================
# 3. EXECUTOR
# =========================================================

Push-Location $Project

try {

    if($Executor -eq "codex") {

        if(!(Test-Path $codex)) {
            throw "Codex nao encontrado: $codex"
        }

        Get-Content $promptFile -Raw |
            & $codex `
                exec `
                --ignore-user-config `
                --ephemeral `
                --json `
                --skip-git-repo-check `
                --sandbox $Sandbox `
                --output-last-message $finalFile `
                - `
                1> $stdoutFile `
                2> $stderrFile

        $exitCode = $LASTEXITCODE

        $usageJson = & node "$root\bin\parse-codex-usage.mjs" $stdoutFile
        if($usageJson) {
            $parsed = $usageJson | ConvertFrom-Json
            $usage = $parsed.usage
            $tool = $parsed.tools | Select-Object -First 1
        }

        if(Test-Path $finalFile) {
            $result = Get-Content $finalFile -Raw
        }
        else {
            $result = "Codex terminou sem produzir executor-final.txt. Consulte evidence."
            if($exitCode -eq 0) {
                $exitCode = 1
            }
        }
    }

    elseif($Executor -eq "antigravity") {

        if(!(Test-Path $agy)) {
            throw "Antigravity nao encontrado: $agy"
        }

        & $agy `
            -p $prompt `
            --agent cio `
            --output-format json `
            --print-timeout 30m `
            1> $stdoutFile `
            2> $stderrFile

        $exitCode = $LASTEXITCODE

        try {
            $json = Get-Content $stdoutFile -Raw | ConvertFrom-Json

            if($json.PSObject.Properties.Name -contains "response") {
                $result = [string]$json.response
            }
            elseif($json.PSObject.Properties.Name -contains "result") {
                $result = [string]$json.result
            }
            else {
                throw "Campo response/result ausente"
            }
        }
        catch {
            $result = "Antigravity terminou, mas o resultado JSON nao pôde ser extraido. Consulte evidence."
            if($exitCode -eq 0) {
                $exitCode = 1
            }
        }
    }

}
finally {
    Pop-Location
}

# =========================================================
# 4. INGEST
# =========================================================

$eventId = "executor-final-" + [guid]::NewGuid().ToString("N")

if($exitCode -eq 0) {

    $event = @{
        task_id        = $id
        event_id       = $eventId
        sequence       = 1
        state          = "DONE"
        external_state = "DONE"

        result = $result

        validation = @"
executor=$Executor
exit_code=$exitCode
transport=MCG
independent_review_required=true
"@

        usage = $usage
        tool  = $tool

        commit = "NONE"

        evidence = @{
            executor = $Executor
            prompt   = "evidence/prompt.txt"
            stdout   = "evidence/executor-stdout.log"
            stderr   = "evidence/executor-stderr.log"
            final    = "evidence/executor-final.txt"
            exit_code = $exitCode
        }
    }

}
else {

    $event = @{
        task_id        = $id
        event_id       = $eventId
        sequence       = 1
        state          = "BLOCKED"
        external_state = "BLOCKED_OWNER"

        result = $result

        validation = "executor_exit_code=$exitCode"

        blocker = "$Executor terminou com exit code $exitCode"
        owner_needed = "Revisar evidence antes de nova tentativa."

        commit = "NONE"

        evidence = @{
            executor = $Executor
            prompt   = "evidence/prompt.txt"
            stdout   = "evidence/executor-stdout.log"
            stderr   = "evidence/executor-stderr.log"
            exit_code = $exitCode
        }
    }
}

$eventFile = Join-Path $taskDir "runner-event.json"

$event |
    ConvertTo-Json -Depth 20 |
    Set-Content $eventFile -Encoding utf8

& node $mcg ingest --file $eventFile | Out-Null

# =========================================================
# 5. SOMENTE RESULTADO COMPACTO VAI PARA O CEO
# =========================================================

& node $mcg result $id
