local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

-- Map settings
local TILE_SIZE = 4
local MAP_WIDTH = 15 -- must be odd
local MAP_HEIGHT = 13 -- must be odd
local WALL_HEIGHT = 5

-- Game configurations
local REQUIRED_PLAYERS = 1 -- Minimum players needed to START matchmaking countdown
local MAX_PLAYERS = 4      -- Total slots (filled with bots if not enough humans)
local MATCHMAKING_WAIT = 20 -- Seconds to wait for players before filling with bots
local INTERMISSION_DURATION = 5 -- Short intermission after matchmaking fills
local ROUND_MAX_DURATION = 120

-- Bot tracking
local activeBotModels = {} -- {model, humanoid, controller thread}
local BotAI = nil -- Will be required after BotAI script registers itself

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
    Vector3.new(2, 0, 2),                   -- Top-Left
    Vector3.new(MAP_WIDTH - 1, 0, MAP_HEIGHT - 1), -- Bottom-Right
    Vector3.new(MAP_WIDTH - 1, 0, 2),       -- Top-Right
    Vector3.new(2, 0, MAP_HEIGHT - 1)       -- Bottom-Left
}

-- Checks if a grid index is within player spawn safety zones
local function isSpawnSafetyZone(x, z)
    local safetyOffsets = {
        {0, 0}, {1, 0}, {0, 1}, -- Corner tile + adjacent steps
        {-1, 0}, {0, -1}
    }
    
    for _, corner in ipairs(spawnCorners) do
        for _, offset in ipairs(safetyOffsets) do
            local safeX = corner.X + offset[1]
            local safeZ = corner.Z + offset[2]
            if x == safeX and z == safeZ then
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
    
    -- 1. Create Baseplate
    local baseplate = Instance.new("Part")
    baseplate.Name = "Baseplate"
    baseplate.Size = Vector3.new(mapWidthStuds, 2, mapHeightStuds)
    baseplate.Position = Vector3.new(mapWidthStuds / 2, -1, mapHeightStuds / 2)
    baseplate.Color = Color3.fromRGB(244, 216, 111) -- retro yellow console color
    baseplate.Material = Enum.Material.SmoothPlastic
    baseplate.Anchored = true
    baseplate.Parent = activeMapFolder
    
    -- 2. Build Border Walls
    local function createBorderWall(position, size)
        local wall = Instance.new("Part")
        wall.Name = "SolidWall"
        wall.Size = size
        wall.Position = position
        wall.Color = Color3.fromRGB(34, 31, 37) -- dark border ink
        wall.Material = Enum.Material.Concrete
        wall.Anchored = true
        wall.CanCollide = true
        wall.Parent = activeMapFolder
    end
    
    -- Border positions
    createBorderWall(Vector3.new(mapWidthStuds/2, WALL_HEIGHT/2, TILE_SIZE/2), Vector3.new(mapWidthStuds, WALL_HEIGHT, TILE_SIZE)) -- North
    createBorderWall(Vector3.new(mapWidthStuds/2, WALL_HEIGHT/2, mapHeightStuds - TILE_SIZE/2), Vector3.new(mapWidthStuds, WALL_HEIGHT, TILE_SIZE)) -- South
    createBorderWall(Vector3.new(TILE_SIZE/2, WALL_HEIGHT/2, mapHeightStuds/2), Vector3.new(TILE_SIZE, WALL_HEIGHT, mapHeightStuds - (TILE_SIZE * 2))) -- West
    createBorderWall(Vector3.new(mapWidthStuds - TILE_SIZE/2, WALL_HEIGHT/2, mapHeightStuds/2), Vector3.new(TILE_SIZE, WALL_HEIGHT, mapHeightStuds - (TILE_SIZE * 2))) -- East

    -- 3. Populate Grid Blocks
    for x = 2, MAP_WIDTH - 1 do
        for z = 2, MAP_HEIGHT - 1 do
            local tilePos = Vector3.new(x * TILE_SIZE, WALL_HEIGHT/2, z * TILE_SIZE)
            
            -- Solid Pillars (Every second index)
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
                -- Breakable Block generation with 75% fill rate, avoiding spawn points
                if not isSpawnSafetyZone(x, z) then
                    if math.random() <= 0.75 then
                        local block = Instance.new("Part")
                        block.Name = "BreakableWall"
                        block.Size = Vector3.new(TILE_SIZE, WALL_HEIGHT, TILE_SIZE)
                        block.Position = tilePos
                        block.Color = Color3.fromRGB(255, 114, 114) -- Pastel red destructible
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

-- Spawns a bot NPC model at a given world position
local function spawnBot(spawnWorldPos, botName)
    -- Create a simple NPC model
    local model = Instance.new("Model")
    model.Name = botName or "Bot"
    model:SetAttribute("IsBot", true)
    
    -- Root part (HumanoidRootPart)
    local rootPart = Instance.new("Part")
    rootPart.Name = "HumanoidRootPart"
    rootPart.Size = Vector3.new(2, 2, 1)
    rootPart.Position = spawnWorldPos
    rootPart.Transparency = 1
    rootPart.CanCollide = false
    rootPart.Parent = model
    
    -- Torso
    local torso = Instance.new("Part")
    torso.Name = "Torso"
    torso.Size = Vector3.new(2, 2, 1)
    torso.Position = spawnWorldPos
    torso.Color = Color3.fromRGB(255, 120, 120) -- Bot color
    torso.Material = Enum.Material.SmoothPlastic
    torso.Parent = model
    
    -- Head
    local head = Instance.new("Part")
    head.Name = "Head"
    head.Size = Vector3.new(2, 1, 1)
    head.Position = spawnWorldPos + Vector3.new(0, 1.5, 0)
    head.Color = Color3.fromRGB(255, 200, 160)
    head.Material = Enum.Material.SmoothPlastic
    head.Parent = model
    
    -- Bot name tag
    local nameTag = Instance.new("BillboardGui")
    nameTag.Size = UDim2.new(0, 100, 0, 30)
    nameTag.StudsOffset = Vector3.new(0, 2, 0)
    nameTag.AlwaysOnTop = false
    nameTag.Parent = head
    local nameLabel = Instance.new("TextLabel")
    nameLabel.Size = UDim2.new(1, 0, 1, 0)
    nameLabel.BackgroundTransparency = 1
    nameLabel.Text = botName or "Bot"
    nameLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    nameLabel.TextStrokeTransparency = 0
    nameLabel.Font = Enum.Font.FredokaOne
    nameLabel.TextSize = 16
    nameLabel.Parent = nameTag
    
    -- Humanoid
    local humanoid = Instance.new("Humanoid")
    humanoid.WalkSpeed = 0 -- Frozen until match starts
    humanoid.JumpHeight = 0
    humanoid.MaxHealth = 100
    humanoid.Health = 100
    humanoid.Parent = model
    
    model.PrimaryPart = rootPart
    model.Parent = workspace
    
    return model
end

-- Cleans up all active bot models
local function cleanupBots()
    for _, botData in ipairs(activeBotModels) do
        if botData.thread then
            task.cancel(botData.thread)
        end
        if botData.model and botData.model.Parent then
            botData.model:Destroy()
        end
    end
    activeBotModels = {}
end

-- Teleports players to corners and freezes them for countdown
-- Also spawns bots for any empty slots
local function setupPlayersForMatch()
    local activePlayers = Players:GetPlayers()
    local slotIndex = 1
    
    -- Place human players first
    for _, player in ipairs(activePlayers) do
        local character = player.Character
        if character and character:FindFirstChild("HumanoidRootPart") then
            local targetCorner = spawnCorners[slotIndex]
            local targetWorldPos = Vector3.new(targetCorner.X * TILE_SIZE, 3, targetCorner.Z * TILE_SIZE)
            character.HumanoidRootPart.Position = targetWorldPos
            character.Humanoid.WalkSpeed = 0
            character.Humanoid.JumpHeight = 0
            character.Humanoid.Health = character.Humanoid.MaxHealth
            slotIndex = slotIndex + 1
        end
    end
    
    -- Spawn bots for remaining slots
    local botNames = {"Chiikawa-Bot", "Usagi-Bot", "Hachiware-Bot"}
    local botNameIndex = 1
    while slotIndex <= MAX_PLAYERS do
        local targetCorner = spawnCorners[slotIndex]
        local targetWorldPos = Vector3.new(targetCorner.X * TILE_SIZE, 3, targetCorner.Z * TILE_SIZE)
        local botName = botNames[botNameIndex] or ("Bot" .. slotIndex)
        local botModel = spawnBot(targetWorldPos, botName)
        table.insert(activeBotModels, {model = botModel, thread = nil})
        botNameIndex = botNameIndex + 1
        slotIndex = slotIndex + 1
    end
end

-- Release players to start moving, and launch bot AI threads
local function releasePlayers()
    -- Release human players
    for _, player in ipairs(Players:GetPlayers()) do
        local character = player.Character
        if character and character:FindFirstChild("Humanoid") then
            character.Humanoid.WalkSpeed = 16
            character.Humanoid.JumpHeight = 7.2
        end
    end
    
    -- Activate bot AI controllers
    -- Signal the BotAI module via a BindableEvent
    local botStartEvent = ReplicatedStorage:FindFirstChild("BotStartEvent")
    if botStartEvent then
        for i, botData in ipairs(activeBotModels) do
            botStartEvent:Fire(botData.model)
        end
    end
end

-- Count survivors
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

-- Count alive bots
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

-- Main Game loop runs continuously
task.spawn(function()
    while true do
        -- Clean up any leftover bots from last round
        cleanupBots()
        
        -- Phase 1: Wait for at least 1 human player
        currentStatus.Value = "Waiting for players..."
        while #Players:GetPlayers() < REQUIRED_PLAYERS do
            task.wait(1)
        end
        
        -- Phase 2: Matchmaking countdown (20 seconds)
        -- Fill with bots when timer runs out if server isn't full
        currentStatus.Value = "Matchmaking... (players joining)"
        local matchmakingTimer = MATCHMAKING_WAIT
        while matchmakingTimer > 0 do
            local humanCount = #Players:GetPlayers()
            if humanCount >= MAX_PLAYERS then
                break -- Server full, start immediately
            end
            currentStatus.Value = "Matchmaking... " .. matchmakingTimer .. "s (" .. humanCount .. "/" .. MAX_PLAYERS .. " players)"
            task.wait(1)
            matchmakingTimer = matchmakingTimer - 1
        end
        
        -- Phase 3: Short intermission then generate match
        for i = INTERMISSION_DURATION, 1, -1 do
            currentStatus.Value = "Match starting in " .. i .. "s"
            task.wait(1)
        end
        
        -- Start Round Setup
        currentStatus.Value = "Generating map..."
        generateMap()
        setupPlayersForMatch()
        task.wait(1)
        
        -- Start Match countdown
        for countdown = 3, 1, -1 do
            currentStatus.Value = tostring(countdown) .. "..."
            task.wait(1)
        end
        currentStatus.Value = "FIGHT!"
        releasePlayers()
        task.wait(1)
        
        -- Match loop active
        local timeRemaining = ROUND_MAX_DURATION
        local matchWinner = nil
        
        while timeRemaining > 0 do
            timeRemaining = timeRemaining - 1
            currentStatus.Value = "Time Left: " .. timeRemaining .. "s"
            
            local humanSurvivors = getSurvivors()
            local aliveBotCount = getAliveBots()
            local totalAlive = #humanSurvivors + aliveBotCount
            
            -- Match ends when only 1 entity remains
            if totalAlive <= 1 then
                if #humanSurvivors == 1 then
                    matchWinner = humanSurvivors[1]
                end
                break
            end
            
            task.wait(1)
        end
        
        -- Round Over / Award Prizes
        if matchWinner then
            currentStatus.Value = matchWinner.Name .. " Wins the Round!"
            
            -- Reward Coins and Win point
            local leaderstats = matchWinner:FindFirstChild("leaderstats")
            if leaderstats then
                local coinsVal = leaderstats:FindFirstChild("Coins")
                local winsVal = leaderstats:FindFirstChild("Wins")
                if coinsVal then coinsVal.Value = coinsVal.Value + 50 end
                if winsVal then winsVal.Value = winsVal.Value + 1 end
            end
        else
            currentStatus.Value = "Draw! No survivors."
        end
        
        task.wait(4) -- Display winner screen for 4 seconds
        
        -- Clean up bots from this round
        cleanupBots()
        
        -- Teleport survivors back to lobby / clean up map
        if activeMapFolder then
            activeMapFolder:Destroy()
        end
        
        for _, player in ipairs(Players:GetPlayers()) do
            player:LoadCharacter() -- Respawns them safely at default spawn points
        end
        
        task.wait(2)
    end
end)
