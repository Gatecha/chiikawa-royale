local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

-- Save key for the database
local PlayerDataStore = DataStoreService:GetDataStore("ChiikawaRoyale_v1")

-- Default statistics for new players
local DEFAULT_COINS = 100
local DEFAULT_WINS = 0
local DEFAULT_SKINS = { "Chiikawa" } -- Default unlocked skin

-- Helper to safely load data
local function loadData(player)
    local key = "Player_" .. player.UserId
    local success, data = pcall(function()
        return PlayerDataStore:GetAsync(key)
    end)
    
    if success and data then
        return data
    else
        return {
            Coins = DEFAULT_COINS,
            Wins = DEFAULT_WINS,
            Skins = DEFAULT_SKINS,
            ActiveSkin = "Chiikawa"
        }
    end
end

-- Helper to safely save data
local function saveData(player)
    local key = "Player_" .. player.UserId
    
    -- Gather current stats from player objects
    local leaderstats = player:FindFirstChild("leaderstats")
    local stats = player:FindFirstChild("stats")
    
    if not leaderstats or not stats then return end
    
    local coinsVal = leaderstats:FindFirstChild("Coins")
    local winsVal = leaderstats:FindFirstChild("Wins")
    local activeSkinVal = stats:FindFirstChild("ActiveSkin")
    
    local ownedSkins = {}
    local skinsFolder = stats:FindFirstChild("OwnedSkins")
    if skinsFolder then
        for _, val in ipairs(skinsFolder:GetChildren()) do
            table.insert(ownedSkins, val.Name)
        end
    end
    
    local dataToSave = {
        Coins = coinsVal and coinsVal.Value or DEFAULT_COINS,
        Wins = winsVal and winsVal.Value or DEFAULT_WINS,
        Skins = ownedSkins,
        ActiveSkin = activeSkinVal and activeSkinVal.Value or "Chiikawa"
    }
    
    local success, err = pcall(function()
        PlayerDataStore:SetAsync(key, dataToSave)
    end)
    
    if not success then
        warn("Failed to save data for player " .. player.Name .. ": " .. tostring(err))
    end
end

-- Player joins
Players.PlayerAdded:Connect(function(player)
    local data = loadData(player)
    
    -- 1. Create standard leaderstats folder (displays on top-right menu)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player
    
    local coins = Instance.new("IntValue")
    coins.Name = "Coins"
    coins.Value = data.Coins
    coins.Parent = leaderstats
    
    local wins = Instance.new("IntValue")
    wins.Name = "Wins"
    wins.Value = data.Wins
    wins.Parent = leaderstats
    
    -- 2. Create internal stats folder (character inventory)
    local stats = Instance.new("Folder")
    stats.Name = "stats"
    stats.Parent = player
    
    local activeSkin = Instance.new("StringValue")
    activeSkin.Name = "ActiveSkin"
    activeSkin.Value = data.ActiveSkin or "Chiikawa"
    activeSkin.Parent = stats
    
    local ownedSkinsFolder = Instance.new("Folder")
    ownedSkinsFolder.Name = "OwnedSkins"
    ownedSkinsFolder.Parent = stats
    
    -- Populate inventory
    local skins = data.Skins or DEFAULT_SKINS
    for _, skinName in ipairs(skins) do
        local skinVal = Instance.new("BoolValue")
        skinVal.Name = skinName
        skinVal.Value = true
        skinVal.Parent = ownedSkinsFolder
    end
    
    print("Loaded data for player: " .. player.Name .. " (Coins: " .. coins.Value .. ", Active Skin: " .. activeSkin.Value .. ")")
end)

-- Player leaves
Players.PlayerRemoving:Connect(function(player)
    saveData(player)
end)

-- Server shutting down (saves everyone left)
game:BindToClose(function()
    for _, player in ipairs(Players:GetPlayers()) do
        saveData(player)
    end
end)
