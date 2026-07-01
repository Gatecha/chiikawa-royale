local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

-- Map settings
local TILE_SIZE = 4
local MAP_WIDTH = 15 -- must be odd
local MAP_HEIGHT = 13 -- must be odd
local WALL_HEIGHT = 5

-- Game configurations
local REQUIRED_PLAYERS = 1  -- Minimum humans needed to start matchmaking
local MAX_PLAYERS = 4       -- Total slots (filled with bots if not enough humans)
local MATCHMAKING_WAIT = 20 -- Seconds to wait for players before filling with bots
local INTERMISSION_DURATION = 5
local ROUND_MAX_DURATION = 120

-- Bot tracking
local activeBotModels = {} -- { model = Model }

-- Game State Enum
local GameState = {
    Intermission = "Intermission",
    Starting = "Starting",
    Active = "Active",
    RoundOver = "RoundOver"
}

local currentStatus = Instance.new("StringValue")
currentStatus.Name = "GameStatus"
currentStatus.Value = "Waiting for players..."
currentStatus.Parent = ReplicatedStorage

local activeMapFolder = nil

-- Define Corner Spawn coordinates (Grid indices)
local spawnCorners = {
    Vector3.new(2, 0, 2),                        -- Top-Left
    Vector3.new(MAP_WIDTH - 1, 0, MAP_HEIGHT - 1), -- Bottom-Right
    Vector3.new(MAP_WIDTH - 1, 0, 2),            -- Top-Right
    Vector3.new(2, 0, MAP_HEIGHT - 1)            -- Bottom-Left
}

-- Checks if a grid index is within player spawn safety zones
local function isSpawnSafetyZone(x, z)
    local safetyOffsets = {
        {0, 0}, {1, 0}, {0, 1},
        {-1, 0}, {0, -1}
    }
    for _, corner in ipairs(spawnCorners) do
        for _, offset in ipairs(safetyOffsets) do
            if x == corner.X + offset[1] and z == corner.Z + offset[2] then
                return true
            end
        end
    end
    return false
end

-- Procedural Map Generator
local function generateMap()
    if activeMapFolder then
        activeMapFolder:Destroy()
    end

    activeMapFolder = Instance.new("Folder")
    activeMapFolder.Name = "ActiveMap"
    activeMapFolder.Parent = workspace

    local mapWidthStuds = MAP_WIDTH * TILE_SIZE
    local mapHeightStuds = MAP_HEIGHT * TILE_SIZE

    -- Baseplate
    local baseplate = Instance.new("Part")
    baseplate.Name = "Baseplate"
    baseplate.Size = Vector3.new(mapWidthStuds, 2, mapHeightStuds)
    baseplate.Position = Vector3.new(mapWidthStuds / 2, -1, mapHeightStuds / 2)
    baseplate.Color = Color3.fromRGB(244, 216, 111)
    baseplate.Material = Enum.Material.SmoothPlastic
    baseplate.Anchored = true
    baseplate.Parent = activeMapFolder

    -- Border Walls
    local function createBorderWall(position, size)
        local wall = Instance.new("Part")
        wall.Name = "SolidWall"
        wall.Size = size
        wall.Position = position
        wall.Color = Color3.fromRGB(34, 31, 37)
        wall.Material = Enum.Material.Concrete
        wall.Anchored = true
        wall.CanCollide = true
        wall.Parent = activeMapFolder
    end

    createBorderWall(Vector3.new(mapWidthStuds/2, WALL_HEIGHT/2, TILE_SIZE/2),                          Vector3.new(mapWidthStuds, WALL_HEIGHT, TILE_SIZE))
    createBorderWall(Vector3.new(mapWidthStuds/2, WALL_HEIGHT/2, mapHeightStuds - TILE_SIZE/2),         Vector3.new(mapWidthStuds, WALL_HEIGHT, TILE_SIZE))
    createBorderWall(Vector3.new(TILE_SIZE/2, WALL_HEIGHT/2, mapHeightStuds/2),                         Vector3.new(TILE_SIZE, WALL_HEIGHT, mapHeightStuds - (TILE_SIZE * 2)))
    createBorderWall(Vector3.new(mapWidthStuds - TILE_SIZE/2, WALL_HEIGHT/2, mapHeightStuds/2),         Vector3.new(TILE_SIZE, WALL_HEIGHT, mapHeightStuds - (TILE_SIZE * 2)))

    -- Grid Blocks
    for x = 2, MAP_WIDTH - 1 do
        for z = 2, MAP_HEIGHT - 1 do
            local tilePos = Vector3.new(x * TILE_SIZE, WALL_HEIGHT/2, z * TILE_SIZE)
            if x % 2 == 0 and z % 2 == 0 then
                local pillar = Instance.new("Part")
                pillar.Name = "SolidWall"
                pillar.Size = Vector3.new(TILE_SIZE, WALL_HEIGHT, TILE_SIZE)
                pillar.Position = tilePos
                pillar.Color = Color3.fromRGB(34, 31, 37)
                pillar.Material = Enum.Material.Concrete
                pillar.Anchored = true
                pillar.CanCollide = true
                pillar.Parent = activeMapFolder
            else
                if not isSpawnSafetyZone(x, z) then
                    if math.random() <= 0.75 then
                        local block = Instance.new("Part")
                        block.Name = "BreakableWall"
                        block.Size = Vector3.new(TILE_SIZE, WALL_HEIGHT, TILE_SIZE)
                        block.Position = tilePos
                        block.Color = Color3.fromRGB(255, 114, 114)
                        block.Material = Enum.Material.Wood
                        block.Anchored = true
                        block.CanCollide = true
                        block.Parent = activeMapFolder
                    end
                end
            end
        end
    end
end

-- ── Build a proper R6 bot NPC with Motor6D joints + walk animation ──────────
local function spawnBot(spawnWorldPos, botName, torsoColor)
    local color = torsoColor or BrickColor.new("Carnation pink")

    local model = Instance.new("Model")
    model.Name = botName or "Bot"
    model:SetAttribute("IsBot", true)
    model:SetAttribute("AIActive", false) -- BotAI watches this; set true when match starts

    -- HumanoidRootPart (physics root, invisible)
    local hrp = Instance.new("Part")
    hrp.Name = "HumanoidRootPart"
    hrp.Size = Vector3.new(2, 2, 1)
    hrp.CFrame = CFrame.new(spawnWorldPos)
    hrp.Transparency = 1
    hrp.CanCollide = false
    hrp.Parent = model

    -- Torso
    local torso = Instance.new("Part")
    torso.Name = "Torso"
    torso.Size = Vector3.new(2, 2, 1)
    torso.CFrame = CFrame.new(spawnWorldPos)
    torso.BrickColor = color
    torso.Material = Enum.Material.SmoothPlastic
    torso.Parent = model

    -- RootJoint: HRP → Torso (REQUIRED for Humanoid to control position)
    local rootJoint = Instance.new("Motor6D")
    rootJoint.Name = "RootJoint"
    rootJoint.Part0 = hrp
    rootJoint.Part1 = torso
    rootJoint.C0 = CFrame.new(0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0)
    rootJoint.C1 = CFrame.new(0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0)
    rootJoint.Parent = hrp

    -- Head
    local head = Instance.new("Part")
    head.Name = "Head"
    head.Size = Vector3.new(2, 1, 1)
    head.BrickColor = BrickColor.new("Wheat")
    head.Material = Enum.Material.SmoothPlastic
    head.Parent = model

    local neck = Instance.new("Motor6D")
    neck.Name = "Neck"
    neck.Part0 = torso
    neck.Part1 = head
    neck.C0 = CFrame.new(0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0)
    neck.C1 = CFrame.new(0, -0.5, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0)
    neck.Parent = torso

    -- Left Arm
    local leftArm = Instance.new("Part")
    leftArm.Name = "Left Arm"
    leftArm.Size = Vector3.new(1, 2, 1)
    leftArm.BrickColor = BrickColor.new("Wheat")
    leftArm.Material = Enum.Material.SmoothPlastic
    leftArm.Parent = model

    local leftShoulder = Instance.new("Motor6D")
    leftShoulder.Name = "Left Shoulder"
    leftShoulder.Part0 = torso
    leftShoulder.Part1 = leftArm
    leftShoulder.C0 = CFrame.new(-1, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0)
    leftShoulder.C1 = CFrame.new(0.5, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0)
    leftShoulder.Parent = torso

    -- Right Arm
    local rightArm = Instance.new("Part")
    rightArm.Name = "Right Arm"
    rightArm.Size = Vector3.new(1, 2, 1)
    rightArm.BrickColor = BrickColor.new("Wheat")
    rightArm.Material = Enum.Material.SmoothPlastic
    rightArm.Parent = model

    local rightShoulder = Instance.new("Motor6D")
    rightShoulder.Name = "Right Shoulder"
    rightShoulder.Part0 = torso
    rightShoulder.Part1 = rightArm
    rightShoulder.C0 = CFrame.new(1, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0)
    rightShoulder.C1 = CFrame.new(-0.5, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0)
    rightShoulder.Parent = torso

    -- Left Leg
    local leftLeg = Instance.new("Part")
    leftLeg.Name = "Left Leg"
    leftLeg.Size = Vector3.new(1, 2, 1)
    leftLeg.BrickColor = color
    leftLeg.Material = Enum.Material.SmoothPlastic
    leftLeg.Parent = model

    local leftHip = Instance.new("Motor6D")
    leftHip.Name = "Left Hip"
    leftHip.Part0 = torso
    leftHip.Part1 = leftLeg
    leftHip.C0 = CFrame.new(-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0)
    leftHip.C1 = CFrame.new(-0.5, 1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0)
    leftHip.Parent = torso

    -- Right Leg
    local rightLeg = Instance.new("Part")
    rightLeg.Name = "Right Leg"
    rightLeg.Size = Vector3.new(1, 2, 1)
    rightLeg.BrickColor = color
    rightLeg.Material = Enum.Material.SmoothPlastic
    rightLeg.Parent = model

    local rightHip = Instance.new("Motor6D")
    rightHip.Name = "Right Hip"
    rightHip.Part0 = torso
    rightHip.Part1 = rightLeg
    rightHip.C0 = CFrame.new(1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0)
    rightHip.C1 = CFrame.new(0.5, 1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0)
    rightHip.Parent = torso

    -- Humanoid (R6 rig type so joints work correctly)
    local humanoid = Instance.new("Humanoid")
    humanoid.RigType = Enum.HumanoidRigType.R6
    humanoid.WalkSpeed = 0
    humanoid.JumpHeight = 0
    humanoid.MaxHealth = 100
    humanoid.Health = 100
    humanoid.Parent = model

    -- Animator (required for LoadAnimation to work)
    local animator = Instance.new("Animator")
    animator.Parent = humanoid

    -- Name tag
    local nameTag = Instance.new("BillboardGui")
    nameTag.Size = UDim2.new(0, 120, 0, 30)
    nameTag.StudsOffset = Vector3.new(0, 3, 0)
    nameTag.AlwaysOnTop = false
    nameTag.Parent = head

    local nameLabel = Instance.new("TextLabel")
    nameLabel.Size = UDim2.new(1, 0, 1, 0)
    nameLabel.BackgroundTransparency = 1
    nameLabel.Text = "🤖 " .. (botName or "Bot")
    nameLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    nameLabel.TextStrokeTransparency = 0
    nameLabel.Font = Enum.Font.FredokaOne
    nameLabel.TextSize = 14
    nameLabel.Parent = nameTag

    -- Animate Script — handles walk/idle/run animations using Roblox default R6 anim IDs
    -- This runs as a server Script so it drives animations server-side (replicated to all clients)
    local animScript = Instance.new("Script")
    animScript.Source = [[
local model    = script.Parent
local humanoid = model:WaitForChild("Humanoid")
local animator = humanoid:WaitForChild("Animator")

local function makeAnim(id)
    local a = Instance.new("Animation")
    a.AnimationId = "rbxassetid://" .. id
    return a
end

-- Roblox default R6 animation IDs
local tracks = {
    idle = animator:LoadAnimation(makeAnim("507766666")),
    walk = animator:LoadAnimation(makeAnim("507777826")),
    run  = animator:LoadAnimation(makeAnim("507767714")),
}
tracks.idle.Looped = true
tracks.walk.Looped = true
tracks.run.Looped  = true

local current = nil
local function play(name)
    if current == name then return end
    for k, t in pairs(tracks) do
        if k ~= name and t.IsPlaying then t:Stop(0.15) end
    end
    if not tracks[name].IsPlaying then
        tracks[name]:Play(0.15)
    end
    current = name
end

play("idle")

humanoid.Running:Connect(function(speed)
    if speed > 14 then
        play("run")
    elseif speed > 0.5 then
        play("walk")
    else
        play("idle")
    end
end)
    ]]
    animScript.Parent = model

    model.PrimaryPart = hrp
    model.Parent = workspace
    hrp:SetNetworkOwner(nil)

    return model
end

-- Cleans up all active bot models
local function cleanupBots()
    for _, botData in ipairs(activeBotModels) do
        if botData.model and botData.model.Parent then
            botData.model:Destroy()
        end
    end
    activeBotModels = {}
end

-- Teleports players to corners, freezes them, spawns bots for empty slots
local function setupPlayersForMatch()
    local activePlayers = Players:GetPlayers()
    local slotIndex = 1

    for _, player in ipairs(activePlayers) do
        local character = player.Character
        if character and character:FindFirstChild("HumanoidRootPart") then
            local targetCorner = spawnCorners[slotIndex]
            local targetWorldPos = Vector3.new(targetCorner.X * TILE_SIZE, 3, targetCorner.Z * TILE_SIZE)
            character.HumanoidRootPart.CFrame = CFrame.new(targetWorldPos)
            character.Humanoid.WalkSpeed = 0
            character.Humanoid.JumpHeight = 0
            character.Humanoid.Health = character.Humanoid.MaxHealth
            slotIndex = slotIndex + 1
        end
    end

    -- Bot color palette (cute pastel colors)
    local botDefs = {
        { name = "Chiikawa-Bot",  color = BrickColor.new("Carnation pink") },
        { name = "Usagi-Bot",     color = BrickColor.new("Pastel blue")    },
        { name = "Hachiware-Bot", color = BrickColor.new("Mint")            },
    }
    local botDefIdx = 1
    while slotIndex <= MAX_PLAYERS do
        local targetCorner   = spawnCorners[slotIndex]
        local targetWorldPos = Vector3.new(targetCorner.X * TILE_SIZE, 3, targetCorner.Z * TILE_SIZE)
        local def            = botDefs[botDefIdx] or { name = "Bot" .. slotIndex, color = BrickColor.new("Bright red") }
        local botModel       = spawnBot(targetWorldPos, def.name, def.color)
        table.insert(activeBotModels, { model = botModel })
        botDefIdx  = botDefIdx + 1
        slotIndex  = slotIndex + 1
    end
end

-- Release players, then activate bots with a 2-second grace period
-- The grace period ensures clients have received the "FIGHT!" status update
-- before bots begin moving (prevents the "bots ahead of countdown" issue)
local function releasePlayers()
    -- Release human players immediately
    for _, player in ipairs(Players:GetPlayers()) do
        local character = player.Character
        if character and character:FindFirstChild("Humanoid") then
            character.Humanoid.WalkSpeed = 16
            character.Humanoid.JumpHeight = 7.2
        end
    end

    -- Activate bots after a 2s delay so clients are fully synced before bots start
    task.delay(2, function()
        for _, botData in ipairs(activeBotModels) do
            if botData.model and botData.model.Parent then
                botData.model:SetAttribute("AIActive", true)
            end
        end
    end)
end

-- Count living human survivors
local function getSurvivors()
    local survivors = {}
    for _, player in ipairs(Players:GetPlayers()) do
        local character = player.Character
        if character and character:FindFirstChild("Humanoid") and character.Humanoid.Health > 0 then
            table.insert(survivors, player)
        end
    end
    return survivors
end

-- Count living bots
local function getAliveBots()
    local count = 0
    for _, botData in ipairs(activeBotModels) do
        local model = botData.model
        if model and model.Parent then
            local humanoid = model:FindFirstChildOfClass("Humanoid")
            if humanoid and humanoid.Health > 0 then
                count = count + 1
            end
        end
    end
    return count
end

-- Main Game Loop
task.spawn(function()
    while true do
        -- Clean up leftover bots
        cleanupBots()

        -- Phase 1: Wait for at least 1 human player
        currentStatus.Value = "Waiting for players..."
        while #Players:GetPlayers() < REQUIRED_PLAYERS do
            task.wait(1)
        end

        -- Phase 2: Matchmaking countdown (20 seconds)
        local matchmakingTimer = MATCHMAKING_WAIT
        while matchmakingTimer > 0 do
            local humanCount = #Players:GetPlayers()
            if humanCount >= MAX_PLAYERS then break end
            currentStatus.Value = "Matchmaking... " .. matchmakingTimer .. "s (" .. humanCount .. "/" .. MAX_PLAYERS .. " players)"
            task.wait(1)
            matchmakingTimer = matchmakingTimer - 1
        end

        -- Phase 3: Short intermission
        for i = INTERMISSION_DURATION, 1, -1 do
            currentStatus.Value = "Match starting in " .. i .. "s"
            task.wait(1)
        end

        -- Generate map and place players/bots
        currentStatus.Value = "Generating map..."
        generateMap()
        setupPlayersForMatch()
        task.wait(1)

        -- 3-2-1 countdown
        for countdown = 3, 1, -1 do
            currentStatus.Value = tostring(countdown) .. "..."
            task.wait(1)
        end
        currentStatus.Value = "FIGHT!"
        releasePlayers() -- Humans released now; bots activate 2s later
        task.wait(1)

        -- Active match loop
        local timeRemaining = ROUND_MAX_DURATION
        local matchWinner = nil

        while timeRemaining > 0 do
            timeRemaining = timeRemaining - 1
            currentStatus.Value = "Time Left: " .. timeRemaining .. "s"

            local humanSurvivors = getSurvivors()
            local aliveBotCount  = getAliveBots()
            local totalAlive     = #humanSurvivors + aliveBotCount

            if totalAlive <= 1 then
                if #humanSurvivors == 1 then
                    matchWinner = humanSurvivors[1]
                end
                break
            end

            task.wait(1)
        end

        -- Round over
        if matchWinner then
            currentStatus.Value = matchWinner.Name .. " Wins the Round!"
            local leaderstats = matchWinner:FindFirstChild("leaderstats")
            if leaderstats then
                local coinsVal = leaderstats:FindFirstChild("Coins")
                local winsVal  = leaderstats:FindFirstChild("Wins")
                if coinsVal then coinsVal.Value = coinsVal.Value + 50 end
                if winsVal  then winsVal.Value  = winsVal.Value  + 1  end
            end
        else
            currentStatus.Value = "Draw! No survivors."
        end

        task.wait(4)

        -- Cleanup and reset
        cleanupBots()
        if activeMapFolder then activeMapFolder:Destroy() end

        for _, player in ipairs(Players:GetPlayers()) do
            player:LoadCharacter()
        end

        task.wait(2)
    end
end)
