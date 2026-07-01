local PowerupConfig = {}

-- Basic settings for character attributes
PowerupConfig.DefaultStats = {
    Speed = 16,        -- Roblox default character WalkSpeed
    MaxBombs = 1,      -- Starting number of placeable bombs
    BombRange = 2      -- Starting radius of explosions (in tiles)
}

-- Caps to prevent players from becoming too overpowered
PowerupConfig.MaxStats = {
    Speed = 28,
    MaxBombs = 8,
    BombRange = 10
}

-- Types of power-ups available in game
PowerupConfig.Types = {
    SpeedBoost = "SpeedBoost",   -- Increases WalkSpeed by 2
    ExtraBomb = "ExtraBomb",     -- Increases capacity of bombs by 1
    RangeBoost = "RangeBoost"    -- Increases grid range of explosions by 1 tile
}

-- Colors associated with each power-up visual
PowerupConfig.Colors = {
    SpeedBoost = Color3.fromRGB(46, 204, 113),  -- Green
    ExtraBomb = Color3.fromRGB(38, 194, 255),   -- Light Blue
    RangeBoost = Color3.fromRGB(255, 173, 114)  -- Light Orange
}

-- Weightings for random drops (higher number = more common)
PowerupConfig.DropChance = 0.35 -- 35% chance to drop a powerup when a breakable block is destroyed
PowerupConfig.DropWeights = {
    { Type = PowerupConfig.Types.ExtraBomb, Weight = 40 },
    { Type = PowerupConfig.Types.RangeBoost, Weight = 40 },
    { Type = PowerupConfig.Types.SpeedBoost, Weight = 20 }
}

function PowerupConfig.GetRandomPowerupType()
    local totalWeight = 0
    for _, item in ipairs(PowerupConfig.DropWeights) do
        totalWeight = totalWeight + item.Weight
    end
    
    local r = math.random(1, totalWeight)
    local currentWeight = 0
    for _, item in ipairs(PowerupConfig.DropWeights) do
        currentWeight = currentWeight + item.Weight
        if r <= currentWeight then
            return item.Type
        end
    end
    return PowerupConfig.Types.ExtraBomb
end

return PowerupConfig
