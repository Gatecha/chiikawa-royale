--[[
    BotAI.server.lua
    ================
    CPU-controlled bot AI for Chiikawa Royale.

    Key behaviors:
    1. Roam the map using simple grid-based movement
    2. Place bombs near breakable walls or players
    3. Flee from bomb blast zones
    4. BOMB STUCK FIX: When checking walkability, if the bot is ALREADY
       standing on a tile that contains a bomb, it skips the bomb collision
       so the bot can always move OUT and never freezes on a bomb tile.
--]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- ── Configuration ──────────────────────────────────────────────────────────
local GRID_SIZE   = 4      -- Must match BombManager
local BOT_SPEED   = 14     -- Walk speed when active
local BOMB_FUSE   = 3.0    -- Seconds before a bomb explodes (match BombManager)
local THINK_DELAY = 0.35   -- Seconds between AI ticks
local BOMB_RANGE  = 2      -- Default bot bomb range



-- ── Helper: Snap world position to grid center ─────────────────────────────
local function snapToGrid(pos)
    return Vector3.new(
        math.round(pos.X / GRID_SIZE) * GRID_SIZE,
        pos.Y,
        math.round(pos.Z / GRID_SIZE) * GRID_SIZE
    )
end

-- ── Helper: Check contents of a grid cell ──────────────────────────────────
local function scanTile(worldPos)
    local overlapParams = OverlapParams.new()
    overlapParams.FilterType = Enum.RaycastFilterType.Exclude
    local parts = workspace:GetPartBoundsInBox(
        CFrame.new(worldPos.X, worldPos.Y, worldPos.Z),
        Vector3.new(3.6, 4, 3.6),
        overlapParams
    )
    local result = {}
    for _, p in ipairs(parts) do
        result[p.Name] = (result[p.Name] or 0) + 1
        if p.Name == "Bomb" and p:GetAttribute("Exploded") == false then
            result["ActiveBomb"] = true
        end
    end
    return result
end

-- ── Helper: Can the bot walk into this tile? ───────────────────────────────
-- botCurrentGrid = snapped position the bot is currently standing on.
-- KEY FIX: if the bot is already ON a tile that has a bomb, treat that
--          tile as walkable (so it can always step away and never freeze).
local function isTileWalkable(tilePos, botCurrentGrid)
    local botOnThisTile = math.abs(tilePos.X - botCurrentGrid.X) < 0.5
                       and math.abs(tilePos.Z - botCurrentGrid.Z) < 0.5

    local contents = scanTile(tilePos)

    if contents["SolidWall"] or contents["BreakableWall"] then
        return false
    end

    -- Bomb blocks the tile ONLY when the bot is NOT already standing on it
    if contents["ActiveBomb"] and not botOnThisTile then
        return false
    end

    return true
end

-- ── Helper: Calculate danger zone from all active bombs ────────────────────
local function getDangerZone()
    local dangerous = {}
    for _, obj in ipairs(workspace:GetDescendants()) do
        if obj.Name == "Bomb" and obj:GetAttribute("Exploded") == false then
            local range = obj:GetAttribute("Range") or BOMB_RANGE
            local bx = math.round(obj.Position.X / GRID_SIZE)
            local bz = math.round(obj.Position.Z / GRID_SIZE)
            dangerous[bx .. "," .. bz] = true
            local dirs = {{1,0},{-1,0},{0,1},{0,-1}}
            for _, d in ipairs(dirs) do
                for step = 1, range do
                    local tx, tz = bx + d[1]*step, bz + d[2]*step
                    local tPos = Vector3.new(tx*GRID_SIZE, obj.Position.Y, tz*GRID_SIZE)
                    dangerous[tx .. "," .. tz] = true
                    local c = scanTile(tPos)
                    if c["SolidWall"] or c["BreakableWall"] then break end
                end
            end
        end
    end
    return dangerous
end

local function isPosInDanger(pos, dangerZone)
    local gx = math.round(pos.X / GRID_SIZE)
    local gz = math.round(pos.Z / GRID_SIZE)
    return dangerZone[gx .. "," .. gz] == true
end

-- ── Helper: Shuffled cardinal neighbors ────────────────────────────────────
local function getNeighborTiles(gridPos)
    local dirs = {
        Vector3.new(GRID_SIZE, 0, 0),
        Vector3.new(-GRID_SIZE, 0, 0),
        Vector3.new(0, 0, GRID_SIZE),
        Vector3.new(0, 0, -GRID_SIZE),
    }
    for i = #dirs, 2, -1 do
        local j = math.random(1, i)
        dirs[i], dirs[j] = dirs[j], dirs[i]
    end
    local result = {}
    for _, d in ipairs(dirs) do
        table.insert(result, gridPos + d)
    end
    return result
end

-- Count walkable escape routes from a tile (for safety scoring)
local function countEscapeRoutes(fromPos, botCurrentGrid)
    local count = 0
    for _, n in ipairs(getNeighborTiles(fromPos)) do
        if isTileWalkable(n, botCurrentGrid) then
            count = count + 1
        end
    end
    return count
end

-- Wait until no players/bots are overlapping the bomb, then enable collision
local function setupBombCollision(bomb)
    bomb.CanCollide = false
    task.spawn(function()
        while bomb and bomb.Parent do
            local overlap = false
            local parts = workspace:GetPartBoundsInBox(
                CFrame.new(bomb.Position),
                bomb.Size - Vector3.new(0.2, 0.2, 0.2)
            )
            for _, part in ipairs(parts) do
                local char = part:FindFirstAncestorOfClass("Model")
                if char and char:FindFirstChildOfClass("Humanoid") then
                    overlap = true
                    break
                end
            end
            if not overlap then
                bomb.CanCollide = true
                break
            end
            task.wait(0.1)
        end
    end)
end

-- ── Place bomb (server-side direct since this IS a server script) ──────────
local function botPlaceBomb(botModel, range)
    local rootPart = botModel:FindFirstChild("HumanoidRootPart")
    if not rootPart then return end

    local bombPos = snapToGrid(rootPart.Position)
    bombPos = Vector3.new(bombPos.X, rootPart.Position.Y + 1.5, bombPos.Z)

    local contents = scanTile(bombPos)
    if contents["Bomb"] or contents["ActiveBomb"] then return end

    local bomb = Instance.new("Part")
    bomb.Name = "Bomb"
    bomb.Size = Vector3.new(3, 3, 3)
    bomb.Shape = Enum.PartType.Ball
    bomb.Position = bombPos
    bomb.Color = Color3.fromRGB(100, 50, 50)
    bomb.Material = Enum.Material.SmoothPlastic
    bomb.Anchored = true
    setupBombCollision(bomb)

    local att = Instance.new("Attachment")
    att.Position = Vector3.new(0, 1.5, 0)
    att.Parent = bomb

    local spark = Instance.new("ParticleEmitter")
    spark.Texture = "rbxassetid://258129486"
    spark.Rate = 20
    spark.Speed = NumberRange.new(2, 5)
    spark.Parent = att

    bomb:SetAttribute("OwnerId", -math.random(100000, 999999))
    bomb:SetAttribute("Range", range or BOMB_RANGE)
    bomb:SetAttribute("Exploded", false)
    bomb.Parent = workspace

    -- Fuse: use Roblox Explosion for visual + damage (since BombManager
    -- also checks Exploded attr, this avoids double-explosion issues)
    task.delay(BOMB_FUSE, function()
        if bomb and bomb.Parent and bomb:GetAttribute("Exploded") == false then
            bomb:SetAttribute("Exploded", true)
            local origin = bomb.Position
            bomb:Destroy()

            -- Visual explosion
            local exp = Instance.new("Explosion")
            exp.Position = origin
            exp.BlastRadius = (range or BOMB_RANGE) * GRID_SIZE + 1
            exp.BlastPressure = 100
            exp.Parent = workspace
        end
    end)
end

-- ── Find nearest living target (human or other bot) ───────────────────────
local function findNearestTarget(fromPos, selfModel)
    local nearest, nearestDist = nil, math.huge
    for _, player in ipairs(Players:GetPlayers()) do
        local char = player.Character
        if char then
            local hrp = char:FindFirstChild("HumanoidRootPart")
            local hum = char:FindFirstChildOfClass("Humanoid")
            if hrp and hum and hum.Health > 0 then
                local d = (hrp.Position - fromPos).Magnitude
                if d < nearestDist then nearestDist = d; nearest = hrp.Position end
            end
        end
    end
    for _, model in ipairs(workspace:GetChildren()) do
        if model ~= selfModel and model:IsA("Model") and model:GetAttribute("IsBot") then
            local hrp = model:FindFirstChild("HumanoidRootPart")
            local hum = model:FindFirstChildOfClass("Humanoid")
            if hrp and hum and hum.Health > 0 then
                local d = (hrp.Position - fromPos).Magnitude
                if d < nearestDist then nearestDist = d; nearest = hrp.Position end
            end
        end
    end
    return nearest, nearestDist
end

-- ── Core Bot Brain ─────────────────────────────────────────────────────────
local function runBot(botModel)
    local humanoid = botModel:FindFirstChildOfClass("Humanoid")
    local rootPart  = botModel:FindFirstChild("HumanoidRootPart")
    if not humanoid or not rootPart then return end

    humanoid.WalkSpeed = BOT_SPEED

    local bombCooldown = 0 -- ticks until next bomb allowed
    local stuckTimer   = 0
    local lastPos      = rootPart.Position

    while botModel and botModel.Parent and humanoid.Health > 0 do
        task.wait(THINK_DELAY)

        if not (botModel and botModel.Parent) then break end
        if humanoid.Health <= 0 then break end

        local currentPos  = rootPart.Position
        local currentGrid = snapToGrid(currentPos)

        bombCooldown = math.max(0, bombCooldown - 1)

        -- Stuck detection
        if (currentPos - lastPos).Magnitude < 0.4 then
            stuckTimer = stuckTimer + 1
        else
            stuckTimer = 0
        end
        lastPos = currentPos

        -- ── Danger check ────────────────────────────────────────────────
        local dangerZone = getDangerZone()
        local inDanger   = isPosInDanger(currentPos, dangerZone)

        if inDanger then
            -- FLEE toward safest tile
            local bestFlee, bestScore = nil, -math.huge
            for _, neighbor in ipairs(getNeighborTiles(currentGrid)) do
                if isTileWalkable(neighbor, currentGrid) then
                    local safe  = not isPosInDanger(neighbor, dangerZone)
                    local exits = countEscapeRoutes(neighbor, currentGrid)
                    local score = (safe and 20 or 0) + exits
                    if score > bestScore then
                        bestScore = score
                        bestFlee  = neighbor
                    end
                end
            end
            if bestFlee then
                humanoid:MoveTo(Vector3.new(bestFlee.X, currentPos.Y, bestFlee.Z))
            end
        else
            -- ── Normal AI: hunt + bomb ───────────────────────────────────
            local targetPos, targetDist = findNearestTarget(currentPos, botModel)

            -- Decide whether to place a bomb
            local shouldBomb = false
            if bombCooldown == 0 then
                -- Bomb if next to a player/bot
                if targetDist and targetDist < GRID_SIZE * 3 then
                    shouldBomb = true
                end
                -- Or if adjacent to a breakable wall
                if not shouldBomb then
                    for _, n in ipairs(getNeighborTiles(currentGrid)) do
                        local c = scanTile(n)
                        if c["BreakableWall"] then
                            shouldBomb = true
                            break
                        end
                    end
                end
            end

            -- Safety: only bomb if we have at least 1 escape route
            if shouldBomb and countEscapeRoutes(currentGrid, currentGrid) >= 1 then
                botPlaceBomb(botModel, BOMB_RANGE)
                bombCooldown = math.ceil((BOMB_FUSE + 1.5) / THINK_DELAY)
            end

            -- ── Choose next movement tile ────────────────────────────────
            local moveTarget = nil

            if targetPos and targetDist < GRID_SIZE * 8 then
                -- Hunt toward target (prefer axis with larger delta)
                local dx = targetPos.X - currentPos.X
                local dz = targetPos.Z - currentPos.Z
                local stepOptions = {}
                if math.abs(dx) >= math.abs(dz) then
                    table.insert(stepOptions, currentGrid + Vector3.new(math.sign(dx)*GRID_SIZE, 0, 0))
                    table.insert(stepOptions, currentGrid + Vector3.new(0, 0, math.sign(dz)*GRID_SIZE))
                else
                    table.insert(stepOptions, currentGrid + Vector3.new(0, 0, math.sign(dz)*GRID_SIZE))
                    table.insert(stepOptions, currentGrid + Vector3.new(math.sign(dx)*GRID_SIZE, 0, 0))
                end
                for _, opt in ipairs(stepOptions) do
                    if isTileWalkable(opt, currentGrid) then
                        moveTarget = opt
                        break
                    end
                end
            end

            -- Random roam fallback (also unsticks the bot)
            if not moveTarget or stuckTimer > 4 then
                stuckTimer = 0
                for _, n in ipairs(getNeighborTiles(currentGrid)) do
                    if isTileWalkable(n, currentGrid) then
                        moveTarget = n
                        break
                    end
                end
            end

            if moveTarget then
                humanoid:MoveTo(Vector3.new(moveTarget.X, currentPos.Y, moveTarget.Z))
            end
        end
    end

    -- Remove dead bot model after a brief delay
    if botModel and botModel.Parent then
        task.wait(1.5)
        botModel:Destroy()
    end
end

-- ── Decoupled Bot Activation ───────────────────────────────────────────────
-- Automatically detects bots spawned in workspace and starts runBot when AIActive is true.
local function handleNewChild(child)
    if child:IsA("Model") and child:GetAttribute("IsBot") then
        task.spawn(function()
            if not child:GetAttribute("AIActive") then
                child:GetAttributeChangedSignal("AIActive"):Wait()
            end
            runBot(child)
        end)
    end
end

workspace.ChildAdded:Connect(handleNewChild)
for _, child in ipairs(workspace:GetChildren()) do
    handleNewChild(child)
end
