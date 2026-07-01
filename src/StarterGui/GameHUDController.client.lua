local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local PlayerGui = player:WaitForChild("PlayerGui")

-- Retrieve Game Status Value
local gameStatus = ReplicatedStorage:WaitForChild("GameStatus")

-- UI Construction Function
local function buildHUD()
    -- 1. Create main ScreenGui
    local ScreenGui = Instance.new("ScreenGui")
    ScreenGui.Name = "ChiikawaRoyaleHUD"
    ScreenGui.ResetOnSpawn = false
    
    -- 2. Status Board (Top Center)
    local statusFrame = Instance.new("Frame")
    statusFrame.Size = UDim2.new(0, 320, 0, 60)
    statusFrame.Position = UDim2.new(0.5, -160, 0, 15)
    statusFrame.BackgroundColor3 = Color3.fromRGB(255, 216, 111) -- Retro Yellow
    statusFrame.BorderSizePixel = 4
    statusFrame.BorderColor3 = Color3.fromRGB(34, 31, 37) -- Dark Ink
    statusFrame.Parent = ScreenGui
    
    local statusCorner = Instance.new("UICorner")
    statusCorner.CornerRadius = UDim.new(0, 12)
    statusCorner.Parent = statusFrame
    
    local statusText = Instance.new("TextLabel")
    statusText.Size = UDim2.new(1, -20, 1, 0)
    statusText.Position = UDim2.new(0, 10, 0, 0)
    statusText.BackgroundTransparency = 1
    statusText.Text = gameStatus.Value
    statusText.TextColor3 = Color3.fromRGB(34, 31, 37)
    statusText.Font = Enum.Font.FredokaOne
    statusText.TextSize = 22
    statusText.TextWrapped = true
    statusText.Parent = statusFrame
    
    -- 3. Stats Panel (Top Left)
    local statsFrame = Instance.new("Frame")
    statsFrame.Size = UDim2.new(0, 200, 0, 80)
    statsFrame.Position = UDim2.new(0, 15, 0, 15)
    statsFrame.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
    statsFrame.BorderSizePixel = 4
    statsFrame.BorderColor3 = Color3.fromRGB(34, 31, 37)
    statsFrame.Parent = ScreenGui
    
    local statsCorner = Instance.new("UICorner")
    statsCorner.CornerRadius = UDim.new(0, 12)
    statsCorner.Parent = statsFrame
    
    local coinLabel = Instance.new("TextLabel")
    coinLabel.Size = UDim2.new(1, -20, 0.5, 0)
    coinLabel.Position = UDim2.new(0, 10, 0, 5)
    coinLabel.BackgroundTransparency = 1
    coinLabel.Text = "🪙 Coins: --"
    coinLabel.TextColor3 = Color3.fromRGB(34, 31, 37)
    coinLabel.Font = Enum.Font.FredokaOne
    coinLabel.TextSize = 18
    coinLabel.TextXAlignment = Enum.TextXAlignment.Left
    coinLabel.Parent = statsFrame
    
    local winLabel = Instance.new("TextLabel")
    winLabel.Size = UDim2.new(1, -20, 0.5, 0)
    winLabel.Position = UDim2.new(0, 10, 0.5, -5)
    winLabel.BackgroundTransparency = 1
    winLabel.Text = "🏆 Wins: --"
    winLabel.TextColor3 = Color3.fromRGB(34, 31, 37)
    winLabel.Font = Enum.Font.FredokaOne
    winLabel.TextSize = 18
    winLabel.TextXAlignment = Enum.TextXAlignment.Left
    winLabel.Parent = statsFrame
    
    -- Parent HUD to PlayerGui
    ScreenGui.Parent = PlayerGui
    
    -- 4. Listeners to update UI elements dynamically
    gameStatus.Changed:Connect(function(newValue)
        statusText.Text = newValue
    end)
    
    -- Bind Leaderboard Values when they replicate to Client
    local function bindLeaderstats()
        local leaderstats = player:WaitForChild("leaderstats", 10)
        if leaderstats then
            local coins = leaderstats:WaitForChild("Coins")
            local wins = leaderstats:WaitForChild("Wins")
            
            local function updateStats()
                coinLabel.Text = "🪙 Coins: " .. tostring(coins.Value)
                winLabel.Text = "🏆 Wins: " .. tostring(wins.Value)
            end
            
            coins.Changed:Connect(updateStats)
            wins.Changed:Connect(updateStats)
            updateStats() -- Initial update
        end
    end
    
    task.spawn(bindLeaderstats)
end

-- Initialize HUD
buildHUD()
