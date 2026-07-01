local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()

-- Set up event references
local eventsFolder = ReplicatedStorage:WaitForChild("Events")
local PlaceBombEvent = eventsFolder:WaitForChild("PlaceBombEvent")

-- Grid settings
local GRID_SIZE = 4

-- Visual selection box preview
local previewBox = nil

local function getSnappedPosition(position)
    local x = math.round(position.X / GRID_SIZE) * GRID_SIZE
    local z = math.round(position.Z / GRID_SIZE) * GRID_SIZE
    -- Position slightly off the floor
    return Vector3.new(x, 1.5, z)
end

-- Create the selection preview box locally
local function createPreviewBox()
    if previewBox then previewBox:Destroy() end
    
    previewBox = Instance.new("Part")
    previewBox.Name = "BombPlacementPreview"
    previewBox.Size = Vector3.new(3.8, 3.8, 3.8)
    previewBox.Color = Color3.fromRGB(46, 204, 113) -- Green by default
    previewBox.Transparency = 0.7
    previewBox.CanCollide = false
    previewBox.Anchored = true
    previewBox.Material = Enum.Material.ForceField
    previewBox.Parent = workspace
end

player.CharacterAdded:Connect(function(char)
    character = char
    createPreviewBox()
end)

if character then
    createPreviewBox()
end

-- Render loop: Update visual preview box position
RunService.RenderStepped:Connect(function()
    if not character or not character:FindFirstChild("HumanoidRootPart") or character.Humanoid.Health <= 0 then
        if previewBox then previewBox.Transparency = 1 end
        return
    end
    
    if not previewBox then
        createPreviewBox()
    end
    
    local rootPart = character.HumanoidRootPart
    local snappedPos = getSnappedPosition(rootPart.Position)
    
    -- Position preview box on the grid
    previewBox.Transparency = 0.7
    previewBox.Position = snappedPos
    
    -- Check if tile is occupied by checking if any Part named "Bomb" or "Wall" is inside the zone
    local isOccupied = false
    local parts = workspace:GetPartBoundsInBox(CFrame.new(snappedPos), Vector3.new(3.6, 3.6, 3.6))
    for _, part in ipairs(parts) do
        if part.Name == "Bomb" or part.Name == "SolidWall" or part.Name == "BreakableWall" then
            isOccupied = true
            break
        end
    end
    
    -- Change color to Red if occupied, Green if free
    if isOccupied then
        previewBox.Color = Color3.fromRGB(231, 76, 60) -- Red
    else
        previewBox.Color = Color3.fromRGB(46, 204, 113) -- Green
    end
end)

-- Fire event to server to place bomb
local function requestBombPlacement()
    if not character or not character:FindFirstChild("HumanoidRootPart") then return end
    if character.Humanoid.Health <= 0 then return end
    
    local pos = character.HumanoidRootPart.Position
    PlaceBombEvent:FireServer(pos)
end

-- Keyboard Trigger: Pressing 'E' or 'F'
UserInputService.InputBegan:Connect(function(input, gameProcessedEvent)
    if gameProcessedEvent then return end
    
    if input.KeyCode == Enum.KeyCode.E or input.KeyCode == Enum.KeyCode.F or input.KeyCode == Enum.KeyCode.ButtonX then
        requestBombPlacement()
    end
end)

-- Mobile Touch Trigger: Creates a touch button on screen for mobile users
local function setupMobileUI()
    if UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled then
        local ScreenGui = Instance.new("ScreenGui")
        ScreenGui.Name = "MobileBombButton"
        ScreenGui.ResetOnSpawn = false
        
        local button = Instance.new("TextButton")
        button.Size = UDim2.new(0, 80, 0, 80)
        button.Position = UDim2.new(0.8, -40, 0.6, -40)
        button.BackgroundColor3 = Color3.fromRGB(241, 196, 15) -- Yellow styling
        button.BorderSizePixel = 4
        button.BorderColor3 = Color3.fromRGB(34, 31, 37)
        button.Text = "BOMB"
        button.Font = Enum.Font.FredokaOne
        button.TextColor3 = Color3.fromRGB(34, 31, 37)
        button.TextSize = 22
        
        -- Rounded button style
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(0.5, 0)
        corner.Parent = button
        
        button.MouseButton1Click:Connect(requestBombPlacement)
        
        button.Parent = ScreenGui
        ScreenGui.Parent = player:WaitForChild("PlayerGui")
    end
end

setupMobileUI()
