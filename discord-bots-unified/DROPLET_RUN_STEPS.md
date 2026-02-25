# Get the bots running 24/7 on your Droplet

Use your Droplet **IP address** (from DigitalOcean → your Droplet → copy the IP).

---

## Step 1: Copy the project from your PC to the Droplet

Open **PowerShell** on your PC and run (replace `YOUR_DROPLET_IP` with the real IP, e.g. `164.92.123.45`):

```powershell
scp -r c:\Website_design\discord-bots-unified root@YOUR_DROPLET_IP:/root/
```

Enter the root password (from the email) when asked. Wait for the copy to finish.

---

## Step 2: SSH into the Droplet

```powershell
ssh root@YOUR_DROPLET_IP
```

Enter the root password again. You’re now in a terminal on the server.

---

## Step 3: Install Node and PM2 (on the Droplet)

Copy and run these one at a time:

```bash
apt update && apt install -y curl
```

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
```

```bash
apt install -y nodejs
```

```bash
npm install -g pm2
```

---

## Step 4: Create your .env file (your secret keys)

```bash
cd /root/discord-bots-unified
nano .env
```

In nano, paste this and **replace the two token placeholders** with your real Discord bot tokens (same ones you used on Railway):

```
DISCORD_BOT_TOKEN_ANTI=paste_anti_impersonator_bot_token_here
DISCORD_BOT_TOKEN_WELCOME=paste_welcome_bot_token_here
GUILD_ID=1420529407524606044
LOG_CHANNEL_ID=1476006615646998619
OWNER_ROLE_ID=1443415927981867149
DEVELOPER_ROLE_ID=1464373846155985138
ANALYST_ROLE_ID=1443403865415487538
PORT=3000
```

Save and exit: **Ctrl+O**, Enter, then **Ctrl+X**.

---

## Step 5: Install dependencies and start the bots 24/7

```bash
npm install
```

```bash
pm2 start index.js --name trading-circle-bots
```

```bash
pm2 save
```

```bash
pm2 startup
```

When `pm2 startup` prints a line starting with `sudo env PATH=...`, **copy that whole line and run it**. That makes the bots start again after a reboot.

---

## Step 6: Check that both bots are online

```bash
pm2 logs trading-circle-bots
```

You should see lines like:
- `[anti-impersonator] Logged in as ...`
- `[welcome] Logged in as ...`

In Discord, both bots should show **Online**. Press **Ctrl+C** to stop viewing logs.

---

## Useful commands later

| What you want      | Command |
|--------------------|--------|
| View logs          | `pm2 logs trading-circle-bots` |
| Restart the bots   | `pm2 restart trading-circle-bots` |
| Stop the bots      | `pm2 stop trading-circle-bots` |
| Status             | `pm2 status` |

---

After this, turn off (or delete) the bot services in Railway so you’re only paying for the Droplet.
