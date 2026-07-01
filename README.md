# Roblox Chiikawa Royale - Setup Guide

Welcome to the Roblox recreation of Chiikawa Royale! This directory contains the codebase designed to sync directly with Roblox Studio using Rojo.

## Prerequisites
1. **Roblox Studio** installed on your computer.
2. **VS Code** with the **Rojo** extension installed.
3. **Rojo Plugin** installed inside Roblox Studio (available for free in the Studio Toolbox under "Plugins").

---

## How to Sync This Project to Roblox Studio

### 1. Start the Rojo Server
* **In VS Code:** Look at the bottom status bar and click on the **Rojo** button, then select **Start Server**.
* **Alternatively, via Terminal:** Run the following command inside this directory:
  ```bash
  rojo serve
  ```

### 2. Connect in Roblox Studio
1. Open **Roblox Studio** and open a new **Baseplate** template.
2. Go to the **Plugins** tab in Studio and click on **Rojo**.
3. A panel will open. Ensure the Address is set to `localhost:34872` (default) and click **Connect**.
4. You will instantly see the folders in Roblox Studio's Explorer sync up with the files inside our `src/` directory!

---

## Roblox Studio Explorer Organization
Once connected, the local files are mapped as follows:
* `src/ReplicatedStorage/` -> `ReplicatedStorage` (Shared Modules and Configurations)
* `src/ServerScriptService/` -> `ServerScriptService` (Server-side game logic)
* `src/StarterPlayer/StarterPlayerScripts/` -> `StarterPlayerScripts` (Client-side controllers)
* `src/StarterGui/` -> `StarterGui` (Player Heads-Up Display and Menus)
