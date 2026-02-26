# Powercell update — set your IP and server path once, then run this to push updates.
# Run in PowerShell:  cd c:\Website_design\discord-bots-unified; .\powercell-update.ps1

$POWERCELL_IP = "YOUR_DROPLET_IP"   # e.g. 164.92.123.45
$POWERCELL_PATH = "/root/discord-bots-unified"

$here = "c:\Website_design\discord-bots-unified"
scp -r $here root@${POWERCELL_IP}:${POWERCELL_PATH}/
ssh root@$POWERCELL_IP "cd $POWERCELL_PATH && npm install && pm2 restart trading-circle-bots"
