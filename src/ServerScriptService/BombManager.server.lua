local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

-- Load Configuration
local PowerupConfig = require(ReplicatedStorage:WaitForChild("PowerupConfig"))

-- Grid Configuration
local GRID_SIZE = 4 -- Each cell is 4x4 studs
local BOMB_FUSE_TIME = 3.0 -- Seconds before explosion

-- Create Remote Events in ReplicatedStorage if they don't exist
local eventsFolder = ReplicatedStorage:FindFirstChild("Events")
if not eventsFolder then
    eventsFolder = Instance.new("Folder")
    eventsFolder.Name = "Events"
    eventsFolder.Parent = ReplicatedStorage
end

local PlaceBombEvent = eventsFolder:FindFirstChild("PlaceBombEvent")
if not PlaceBombEvent then
    PlaceBombEvent = Instance.new("RemoteEvent")
    PlaceBombEvent.Name = "PlaceBombEvent"
    PlaceBombEvent.Parent = eventsFolder
end

-- Active stats tracking for players during the match
local activePlayerStats = {}

-- Initialize player stats when they join/respawn
local function initPlayerSessionStats(player)
    activePlayerStats[player.UserId] = {
        ActiveBombsCount = 0,
        MaxBombs = PowerupConfig.DefaultStats.MaxBombs,
        BombRange = PowerupConfig.DefaultStats.BombRange,
        Speed = PowerupConfig.DefaultStats.Speed
    }
end

Players.PlayerAdded:Connect(initPlayerSessionStats)
Players.PlayerRemoving:Connect(function(player)
    activePlayerStats[player.UserId] = nil
end)

-- Helper to snap coordinates to grid
local function snapToGrid(position)
    local x = math.round(position.X / GRID_SIZE) * GRID_SIZE
    local z = math.round(position.Z / GRID_SIZE) * GRID_SIZE
    -- Spawn bombs slightly above ground level
    return Vector3.new(x, position.Y + 1.5, z)
end

-- Check collision in a grid cell using overlap box
local function checkTile(position)
    local overlapParams = OverlapParams.new()
    overlapParams.FilterType = Enum.RaycastFilterType.Exclude
    
    -- Size is slightly smaller than 4x4x4 (3.8x3.8x3.8) to prevent overlaps with adjacent cells
    local parts = workspace:GetPartBoundsInBox(
        CFrame.new(position),
        Vector3.new(3.8, 3.8, 3.8),
        overlapParams
    )
    return parts
end

-- Spawns a floating powerup part
local function spawnPowerup(position)
    local roll = math.random()
    if roll > PowerupConfig.DropChance then return end
    
    local powerupType = PowerupConfig.GetRandomPowerupType()
    
    local part = Instance.new("Part")
    part.Name = "Powerup"
    part.Size = Vector3.new(2, 2, 2)
    part.Position = position + Vector3.new(0, -0.5, 0)
    part.Anchored = true
    part.CanCollide = false
    part.Color = PowerupConfig.Colors[powerupType]
    part.Material = Enum.Material.Neon
    
    -- Store the type on the part
    part:SetAttribute("Type", powerupType)
    
    -- Visual Spin and Float effect
    local floatScript = Instance.new("Script")
    floatScript.Source = [[
        local part = script.Parent
        local startY = part.Position.Y
        local t = 0
        while part and part.Parent do
            t = t + task.wait()
            part.CFrame = CFrame.new(part.Position.X, startY + math.sin(t * 3) * 0.4, part.Position.Z) * CFrame.Angles(0, t * 2, 0)
        end
    ]]
    floatScript.Parent = part
    part.Parent = workspace
    
    -- Detect pick up
    local touchConnection
    touchConnection = part.Touched:Connect(function(hit)
        local character = hit:FindFirstAncestorOfClass("Model")
        local player = Players:GetPlayerFromCharacter(character)
        if player and activePlayerStats[player.UserId] then
            local stats = activePlayerStats[player.UserId]
            
            if powerupType == PowerupConfig.Types.ExtraBomb then
                stats.MaxBombs = math.min(stats.MaxBombs + 1, PowerupConfig.MaxStats.MaxBombs)
            elseif powerupType == PowerupConfig.Types.RangeBoost then
                stats.BombRange = math.min(stats.BombRange + 1, PowerupConfig.MaxStats.BombRange)
            elseif powerupType == PowerupConfig.Types.SpeedBoost then
                stats.Speed = math.min(stats.Speed + 2, PowerupConfig.MaxStats.Speed)
                if character:FindFirstChildOfClass("Humanoid") then
                    character:FindFirstChildOfClass("Humanoid").WalkSpeed = stats.Speed
                end
            end
            
            -- Play sound, destroy powerup
            local sound = Instance.new("Sound")
            sound.SoundId = "rbxassetid://9120386121" -- Powerup pickup SFX
            sound.Volume = 0.5
            sound.Parent = character:FindFirstChild("HumanoidRootPart") or character
            sound:Play()
            game:GetService("Debris"):AddItem(sound, 1.5)
            
            part:Destroy()
            touchConnection:Disconnect()
        end
    end)
    
    -- Auto cleanup after 15 seconds if not picked up
    game:GetService("Debris"):AddItem(part, 15)
end

-- Trigger Explosion
local function explodeBomb(bomb)
    if bomb:GetAttribute("Exploded") == true then return end
    bomb:SetAttribute("Exploded", true)
    
    local ownerId = bomb:GetAttribute("OwnerId")
    local range = bomb:GetAttribute("Range") or 2
    local origin = bomb.Position
    
    -- Retrieve owner session to refund their bomb count
    local owner = Players:GetPlayerByUserId(ownerId)
    if owner and activePlayerStats[ownerId] then
        activePlayerStats[ownerId].ActiveBombsCount = math.max(0, activePlayerStats[ownerId].ActiveBombsCount - 1)
    end
    
    -- Destroy bomb model
    bomb:Destroy()
    
    -- Visual explosion emitter
    local function playVisualExplosion(pos)
        local exp = Instance.new("Explosion")
        exp.Position = pos
        exp.BlastRadius = 0 -- Programmatic damage, visual only
        exp.Parent = workspace
        
        -- Custom Fire Particle Part
        local fire = Instance.new("Part")
        fire.Size = Vector3.new(GRID_SIZE, 1, GRID_SIZE)
        fire.Position = Vector3.new(pos.X, pos.Y - 1, pos.Z)
        fire.Color = Color3.fromRGB(255, 85, 0)
        fire.Material = Enum.Material.Neon
        fire.Anchored = true
        fire.CanCollide = false
        fire.Parent = workspace
        
        -- Fade Out
        local tweenInfo = TweenInfo.new(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
        local tween = TweenService:Create(fire, tweenInfo, {Transparency = 1, Size = Vector3.new(0.1, 0.1, 0.1)})
        tween:Play()
        game:GetService("Debris"):AddItem(fire, 0.4)
    end
    
    playVisualExplosion(origin)
    
    -- Check center tile damage
    for _, part in ipairs(checkTile(origin)) do
        local character = part:FindFirstAncestorOfClass("Model")
        local humanoid = character and character:FindFirstChildOfClass("Humanoid")
        if humanoid then
            humanoid:TakeDamage(100) -- Instant kill if standing directly on bomb
        end
    end
    
    -- Directions: North, South, East, West
    local directions = {
        Vector3.new(0, 0, GRID_SIZE),   -- North
        Vector3.new(0, 0, -GRID_SIZE),  -- South
        Vector3.new(GRID_SIZE, 0, 0),   -- East
        Vector3.new(-GRID_SIZE, 0, 0)   -- West
    }
    
    for _, dir in ipairs(directions) do
        for step = 1, range do
            local targetPos = origin + (dir * step)
            local hitBlocks = checkTile(targetPos)
            local stopDirection = false
            local breakableHit = nil
            
            for _, part in ipairs(hitBlocks) do
                if part.Name == "SolidWall" then
                    stopDirection = true
                    break
                elseif part.Name == "BreakableWall" then
                    breakableHit = part
                    stopDirection = true
                    break
                elseif part.Name == "Bomb" and part:GetAttribute("Exploded") == false then
                    -- Chain reaction detonate!
                    task.spawn(explodeBomb, part)
                else
                    -- Damage players/enemies caught in blast
                    local character = part:FindFirstAncestorOfClass("Model")
                    local humanoid = character and character:FindFirstChildOfClass("Humanoid")
                    if humanoid then
                        humanoid:TakeDamage(50) -- Heavy damage in blast radius
                    end
                end
            end
            
            if not stopDirection or breakableHit then
                playVisualExplosion(targetPos)
            end
            
            if breakableHit then
                -- Destroy block and drop powerup
                local blockPos = breakableHit.Position
                breakableHit:Destroy()
                spawnPowerup(blockPos)
            end
            
            if stopDirection then
                break -- Ray blocked by obstacle
            end
        end
    end
end

-- Place Bomb Event
PlaceBombEvent.OnServerEvent:Connect(function(player, characterPosition)
    local stats = activePlayerStats[player.UserId]
    if not stats then
        initPlayerSessionStats(player)
        stats = activePlayerStats[player.UserId]
    end
    
    -- Character verification
    local character = player.Character
    if not character or not character:FindFirstChild("HumanoidRootPart") then return end
    if character.Humanoid.Health <= 0 then return end
    
    -- 1. Anti-Cheat: Max bombs check
    if stats.ActiveBombsCount >= stats.MaxBombs then
        return
    end
    
    -- 2. Anti-Cheat: Verification of placement distance
    local dist = (character.HumanoidRootPart.Position - characterPosition).Magnitude
    if dist > 15 then return end -- Player is placing too far
    
    local bombPos = snapToGrid(characterPosition)
    
    -- Check if bomb already exists on that tile
    local existingParts = checkTile(bombPos)
    for _, part in ipairs(existingParts) do
        if part.Name == "Bomb" then return end -- Tile occupied
    end
    
    -- Spawn Bomb Model
    local bomb = Instance.new("Part")
    bomb.Name = "Bomb"
    bomb.Size = Vector3.new(3, 3, 3)
    bomb.Shape = Enum.PartType.Ball
    bomb.Position = bombPos
    bomb.Color = Color3.fromRGB(44, 41, 51)
    bomb.Material = Enum.Material.SmoothPlastic
    bomb.Anchored = true
    bomb.CanCollide = true
    
    -- Add details to represent fuse
    local attachment = Instance.new("Attachment")
    attachment.Position = Vector3.new(0, 1.5, 0)
    attachment.Parent = bomb
    
    local fuseParticle = Instance.new("ParticleEmitter")
    fuseParticle.Texture = "rbxassetid://258129486" -- Spark texture
    fuseParticle.Rate = 20
    fuseParticle.Speed = NumberRange.new(2, 5)
    fuseParticle.Parent = attachment
    
    -- Tag attributes
    bomb:SetAttribute("OwnerId", player.UserId)
    bomb:SetAttribute("Range", stats.BombRange)
    bomb:SetAttribute("Exploded", false)
    
    bomb.Parent = workspace
    
    stats.ActiveBombsCount = stats.ActiveBombsCount + 1
    
    -- Sound fuse loop
    local sound = Instance.new("Sound")
    sound.SoundId = "rbxassetid://11565378" -- Ticking sound
    sound.Looped = true
    sound.Volume = 0.5
    sound.Parent = bomb
    sound:Play()
    
    -- Detonation Timer
    task.delay(BOMB_FUSE_TIME, function()
        if bomb and bomb.Parent then
            explodeBomb(bomb)
        end
    end)
end)
