# Publish this bot as its own repo (so it appears separately in Railway)

To get a **list** in Railway where you click "discord-antimpersonator" (and later add more bots as separate items), each bot should be its **own GitHub repo**. Then Railway → New Project → Deploy from GitHub shows all your repos; you pick one and launch.

---

## Option A: Copy files (simplest)

1. **On GitHub** – Create a **new repository** (e.g. `discord-antimpersonator`). Leave it empty (no README, no .gitignore).

2. **Clone it and copy this folder into it:**
   ```powershell
   cd c:\
   git clone https://github.com/brody1489/discord-antimpersonator.git
   cd discord-antimpersonator
   # Copy everything from Website_design's discord-antimpersonator into this folder (so package.json, index.js, src/, etc. are in the root)
   Copy-Item -Path "c:\Website_design\discord-antimpersonator\*" -Destination "c:\discord-antimpersonator" -Recurse -Force
   git add -A
   git commit -m "Initial commit: anti-impersonator bot"
   git push -u origin main
   ```

3. **Railway** – New Project → Deploy from GitHub repo → select **discord-antimpersonator**. Add env vars, deploy. No Root Directory needed.

---

## Option B: Git subtree (keeps history in the new repo)

1. **On GitHub** – Create a **new repository** (e.g. `discord-antimpersonator`). Leave it empty.

2. **From your PC:**
   ```powershell
   cd c:\Website_design
   git subtree split -P discord-antimpersonator -b antimpersonator-branch
   mkdir c:\discord-antimpersonator-repo
   cd c:\discord-antimpersonator-repo
   git init
   git pull c:\Website_design antimpersonator-branch
   git remote add origin https://github.com/brody1489/discord-antimpersonator.git
   git branch -M main
   git push -u origin main
   ```
   Replace `brody1489/discord-antimpersonator` with your GitHub username/repo if different.

3. **Railway** – New Project → Deploy from GitHub → pick **discord-antimpersonator**, add env vars, deploy.

---

**Later (bot 2 and bot 3):** Create a new GitHub repo for each, put that bot’s code in its own folder, push. Each will show up in Railway’s list as a separate thing to click and launch.
