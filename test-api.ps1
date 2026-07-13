$BASE = "http://localhost:3333"
$results = @()
$log = @()

function Log {
    param([string]$msg)
    $ts = Get-Date -Format "HH:mm:ss.fff"
    $line = "[$ts] $msg"
    Write-Host $line
    $script:log += $line
}

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Body = $null,
        [string]$Token = $null,
        [string]$Description,
        [int]$ExpectStatus = 200
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }

    try {
        $params = @{
            Uri = "$BASE$Path"
            Method = $Method
            Headers = $headers
            UseBasicParsing = $true
        }
        if ($Body) { $params.Body = $Body }

        $resp = Invoke-WebRequest @params -ErrorAction Stop
        $status = $resp.StatusCode
        $content = $resp.Content
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $content = $_.ErrorDetails.Message
        if (-not $content) {
            try { $content = $_.Exception.Response.Content.ReadAsStringAsync().Result } catch { $content = $_.Exception.Message }
        }
    }

    $pass = $status -eq $ExpectStatus
    $icon = if ($pass) { "PASS" } else { "FAIL" }
    Log "$icon [$Method $Path] -> $status (expected $ExpectStatus) | $Description"

    if (-not $pass) {
        Log "  Response: $content"
    }

    $script:results += [PSCustomObject]@{
        Method = $Method
        Path = $Path
        Status = $status
        Expected = $ExpectStatus
        Pass = $pass
        Description = $Description
        Response = $content
    }

    return @{ Status = $status; Content = $content; Pass = $pass }
}

# ============================================================
# 1. AUTH TESTS
# ============================================================
Log "=== 1. AUTH TESTS ==="

$r = Test-Endpoint POST "/api/auth/register" '{"email":"testuser@vendora.com.br","password":"Test1234!","name":"Test User","company":"Test Company"}' $null "Register new user" 201
$token = $null
$tenantId = $null
if ($r.Pass) {
    $json = $r.Content | ConvertFrom-Json
    $token = $json.token
    $tenantId = $json.user.tenantId
    Log "  Token obtained: $($token.Substring(0,30))..."
    Log "  Tenant ID: $tenantId"
}

$r = Test-Endpoint POST "/api/auth/register" '{"email":"testuser@vendora.com.br","password":"Test1234!","name":"Test User","company":"Test Company"}' $null "Register duplicate user (expect 409)" 409

$r = Test-Endpoint POST "/api/auth/login" '{"email":"testuser@vendora.com.br","password":"Test1234!"}' $null "Login" 200
if ($r.Pass) {
    $json = $r.Content | ConvertFrom-Json
    $token = $json.token
}

$r = Test-Endpoint POST "/api/auth/login" '{"email":"testuser@vendora.com.br","password":"WrongPassword!"}' $null "Login wrong password (expect 401)" 401

$r = Test-Endpoint GET "/api/auth/me" $null $token "Get current user (no token, expect 401)" 401

$r = Test-Endpoint GET "/api/auth/me" $null $token "Get current user" 200

# Refresh token
$refreshToken = $null
if ($r.Pass) {
    $loginResp = Test-Endpoint POST "/api/auth/login" '{"email":"testuser@vendora.com.br","password":"Test1234!"}' $null "Login for refresh" 200
    if ($loginResp.Pass) {
        $lj = $loginResp.Content | ConvertFrom-Json
        $refreshToken = $lj.refreshToken
        $token = $lj.token
    }
}
if ($refreshToken) {
    $r = Test-Endpoint POST "/api/auth/refresh" "{\"refreshToken\":\"$refreshToken\"}" $null "Refresh token" 200
}

# ============================================================
# 2. SUPERADMIN TESTS (need superadmin token)
# ============================================================
Log ""
Log "=== 2. SUPERADMIN TESTS ==="

$r = Test-Endpoint POST "/api/auth/login" '{"email":"superadmin@vendora.com.br","password":"Admin123!"}' $null "Superadmin login" 200
$saToken = $null
if ($r.Pass) {
    $sj = $r.Content | ConvertFrom-Json
    $saToken = $sj.token
    Log "  Superadmin token obtained"
}

if ($saToken) {
    $r = Test-Endpoint GET "/api/superadmin/tenants" $null $saToken "List tenants" 200
    $r = Test-Endpoint GET "/api/superadmin/plans" $null $saToken "List plans" 200
    $r = Test-Endpoint GET "/api/superadmin/white-labels" $null $saToken "List white-labels" 200
} else {
    Log "  SKIP superadmin tests - could not login"
}

# ============================================================
# 3. CONVERSATIONS
# ============================================================
Log ""
Log "=== 3. CONVERSATIONS ==="

$r = Test-Endpoint GET "/api/conversations" $null $token "List conversations" 200

# ============================================================
# 4. TICKETS
# ============================================================
Log ""
Log "=== 4. TICKETS ==="

$r = Test-Endpoint GET "/api/tickets" $null $token "List tickets" 200
$r = Test-Endpoint POST "/api/tickets" '{"subject":"Test Ticket from Simulation","description":"This is a test ticket created during simulation","priority":"medium","status":"open"}' $token "Create ticket" 201
$ticketId = $null
if ($r.Pass) {
    $tj = $r.Content | ConvertFrom-Json
    $ticketId = $tj.id
    Log "  Ticket created: $ticketId"
}
if ($ticketId) {
    $r = Test-Endpoint GET "/api/tickets/$ticketId" $null $token "Get ticket by ID" 200
    $r = Test-Endpoint PUT "/api/tickets/$ticketId" '{"status":"in_progress","priority":"high"}' $token "Update ticket" 200
}

# ============================================================
# 5. CRM (DEALS, FUNCTORS, STAGES)
# ============================================================
Log ""
Log "=== 5. CRM (Deals/Funnels) ==="

$r = Test-Endpoint POST "/api/crm/funnels" '{"name":"Test Funnel","description":"Simulation funnel"}' $token "Create funnel" 201
$funnelId = $null
if ($r.Pass) {
    $fj = $r.Content | ConvertFrom-Json
    $funnelId = $fj.id
    Log "  Funnel created: $funnelId"
}
$r = Test-Endpoint GET "/api/crm/funnels" $null $token "List funnels" 200

$stageId = $null
if ($funnelId) {
    $r = Test-Endpoint POST "/api/crm/funnels/$funnelId/stages" '{"name":"Lead","order":1}' $token "Create stage" 201
    if ($r.Pass) {
        $sj2 = $r.Content | ConvertFrom-Json
        $stageId = $sj2.id
        Log "  Stage created: $stageId"
    }
}

$dealId = $null
if ($stageId) {
    $r = Test-Endpoint POST "/api/crm/deals" "{\"title\":\"Test Deal\",\"value\":5000,\"stageId\":\"$stageId\",\"funnelId\":\"$funnelId\"}" $token "Create deal" 201
    if ($r.Pass) {
        $dj = $r.Content | ConvertFrom-Json
        $dealId = $dj.id
        Log "  Deal created: $dealId"
    }
}
$r = Test-Endpoint GET "/api/crm/deals" $null $token "List deals" 200

# ============================================================
# 6. AGENTS
# ============================================================
Log ""
Log "=== 6. AI AGENTS ==="

$r = Test-Endpoint POST "/api/agents" '{"name":"Test Agent","description":"Simulation agent","model":"gpt-4","systemPrompt":"You are a test agent"}' $token "Create agent" 201
$agentId = $null
if ($r.Pass) {
    $aj = $r.Content | ConvertFrom-Json
    $agentId = $aj.id
    Log "  Agent created: $agentId"
}
$r = Test-Endpoint GET "/api/agents" $null $token "List agents" 200
if ($agentId) {
    $r = Test-Endpoint GET "/api/agents/$agentId" $null $token "Get agent" 200
    $r = Test-Endpoint PUT "/api/agents/$agentId" '{"name":"Updated Agent","description":"Updated description"}' $token "Update agent" 200
}

# ============================================================
# 7. KNOWLEDGE BASE
# ============================================================
Log ""
Log "=== 7. KNOWLEDGE BASE ==="

$r = Test-Endpoint POST "/api/agents/knowledge-base" '{"name":"Test KB","description":"Simulation KB"}' $token "Create KB" 201
$kbId = $null
if ($r.Pass) {
    $kbj = $r.Content | ConvertFrom-Json
    $kbId = $kbj.id
    Log "  KB created: $kbId"
}
$r = Test-Endpoint GET "/api/agents/knowledge-base" $null $token "List KBs" 200

# ============================================================
# 8. OMBUDSMAN
# ============================================================
Log ""
Log "=== 8. OMBUDSMAN ==="

$r = Test-Endpoint GET "/api/ombudsman" $null $token "List ombudsman cases" 200
$r = Test-Endpoint POST "/api/ombudsman" '{"subject":"Test Complaint","description":"Test ombudsman case from simulation","category":"service_quality","priority":"medium"}' $token "Create ombudsman case" 201
$ombId = $null
if ($r.Pass) {
    $oj = $r.Content | ConvertFrom-Json
    $ombId = $oj.id
    Log "  Ombudsman case created: $ombId"
}
if ($ombId) {
    $r = Test-Endpoint GET "/api/ombudsman/$ombId" $null $token "Get ombudsman case" 200
}

# ============================================================
# 9. PABX
# ============================================================
Log ""
Log "=== 9. PABX ==="

$r = Test-Endpoint GET "/api/pabx/extensions" $null $token "List PABX extensions" 200
$r = Test-Endpoint POST "/api/pabx/extensions" '{"number":"1001","name":"Test Extension","type":"user"}' $token "Create PABX extension" 201
$extId = $null
if ($r.Pass) {
    $ej = $r.Content | ConvertFrom-Json
    $extId = $ej.id
    Log "  Extension created: $extId"
}

$r = Test-Endpoint GET "/api/pabx/queues" $null $token "List PABX queues" 200
$r = Test-Endpoint POST "/api/pabx/queues" '{"name":"Test Queue","strategy":"round_robin","timeout":30}' $token "Create PABX queue" 201
$queueId = $null
if ($r.Pass) {
    $qj = $r.Content | ConvertFrom-Json
    $queueId = $qj.id
    Log "  Queue created: $queueId"
}

$r = Test-Endpoint GET "/api/pabx/holidays" $null $token "List holiday schedules" 200
$r = Test-Endpoint POST "/api/pabx/holidays" '{"name":"Test Holiday","startDate":"2026-12-25","endDate":"2026-12-26"}' $token "Create holiday schedule" 201

$r = Test-Endpoint GET "/api/pabx/ivr-menus" $null $token "List IVR menus" 200
$r = Test-Endpoint POST "/api/pabx/ivr-menus" '{"name":"Test IVR","greeting":"Welcome","options":[{"key":"1","action":"transfer","target":"queue1"}]}' $token "Create IVR menu" 201

# ============================================================
# 10. FLOWS
# ============================================================
Log ""
Log "=== 10. FLOWS ==="

$r = Test-Endpoint GET "/api/flows" $null $token "List flows" 200
$r = Test-Endpoint POST "/api/flows" '{"name":"Test Flow","description":"Simulation flow","nodes":[{"id":"start","type":"start","data":{}},{"id":"msg1","type":"send_message","data":{"text":"Hello"},"x":200,"y":100}],"edges":[{"source":"start","target":"msg1"}]}' $token "Create flow" 201
$flowId = $null
if ($r.Pass) {
    $flj = $r.Content | ConvertFrom-Json
    $flowId = $flj.id
    Log "  Flow created: $flowId"
}
if ($flowId) {
    $r = Test-Endpoint GET "/api/flows/$flowId" $null $token "Get flow" 200
}

# ============================================================
# 11. CALENDAR
# ============================================================
Log ""
Log "=== 11. CALENDAR ==="

$r = Test-Endpoint GET "/api/calendar/events" $null $token "List calendar events" 200
$r = Test-Endpoint POST "/api/calendar/events" '{"title":"Test Meeting","description":"Simulation meeting","startTime":"2026-07-15T10:00:00Z","endTime":"2026-07-15T11:00:00Z","type":"meeting"}' $token "Create calendar event" 201
$calEventId = $null
if ($r.Pass) {
    $cj = $r.Content | ConvertFrom-Json
    $calEventId = $cj.id
    Log "  Calendar event created: $calEventId"
}

# ============================================================
# 12. MAILING / CAMPAIGNS
# ============================================================
Log ""
Log "=== 12. MAILING / CAMPAIGNS ==="

$r = Test-Endpoint GET "/api/mailing/campaigns" $null $token "List campaigns" 200
$r = Test-Endpoint POST "/api/mailing/campaigns" '{"name":"Test Campaign","description":"Simulation campaign","type":"email","status":"draft"}' $token "Create campaign" 201
$campId = $null
if ($r.Pass) {
    $cpj = $r.Content | ConvertFrom-Json
    $campId = $cpj.id
    Log "  Campaign created: $campId"
}

# ============================================================
# 13. ADMIN
# ============================================================
Log ""
Log "=== 13. ADMIN (Team) ==="

$r = Test-Endpoint GET "/api/admin/team" $null $token "List team members" 200
$r = Test-Endpoint GET "/api/admin/roles" $null $token "List roles" 200

# ============================================================
# 14. ANALYTICS
# ============================================================
Log ""
Log "=== 14. ANALYTICS ==="

$r = Test-Endpoint GET "/api/analytics/dashboard" $null $token "Dashboard analytics" 200

# ============================================================
# 15. INTEGRATIONS
# ============================================================
Log ""
Log "=== 15. INTEGRATIONS ==="

$r = Test-Endpoint GET "/api/integrations/status" $null $token "Integration status" 200
$r = Test-Endpoint GET "/api/integrations/connections" $null $token "List connections" 200
$r = Test-Endpoint POST "/api/integrations/connections" '{"provider":"web","name":"Test Web Widget","config":{}}' $token "Create web connection" 201
$connId = $null
if ($r.Pass) {
    $connj = $r.Content | ConvertFrom-Json
    $connId = $connj.connection.id
    Log "  Connection created: $connId"
}

# ============================================================
# 16. UPLOAD
# ============================================================
Log ""
Log "=== 16. UPLOAD ==="

$r = Test-Endpoint POST "/api/upload/presign" '{"fileName":"test.txt","contentType":"text/plain"}' $token "Get presigned URL" 200

# ============================================================
# 17. PUBLIC ROUTES
# ============================================================
Log ""
Log "=== 17. PUBLIC ROUTES ==="

$r = Test-Endpoint GET "/api/public/health" $null $null "Health check" 200

# ============================================================
# SUMMARY
# ============================================================
Log ""
Log "============================================"
Log "              TEST SUMMARY"
Log "============================================"

$total = $results.Count
$passed = ($results | Where-Object { $_.Pass }).Count
$failed = $total - $passed

Log "Total: $total | Passed: $passed | Failed: $failed"
Log ""

if ($failed -gt 0) {
    Log "FAILURES:"
    $results | Where-Object { -not $_.Pass } | ForEach-Object {
        Log "  FAIL: $($_.Method) $($_.Path) -> $($_.Status) (expected $($_.Expected)) | $($_.Description)"
        if ($_.Response) {
            $respShort = if ($_.Response.Length -gt 200) { $_.Response.Substring(0,200) + "..." } else { $_.Response }
            Log "    Response: $respShort"
        }
    }
}

# Export results
$results | ConvertTo-Json -Depth 5 | Out-File "C:\Users\paulo\vendora\test-results.json" -Encoding utf8
Log ""
Log "Results saved to test-results.json"
