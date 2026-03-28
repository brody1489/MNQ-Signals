/**
 * PM2 on the droplet (optional):
 *   cd /path/to/ttc-creator-hub
 *   pm2 start ecosystem.config.cjs
 * Env vars still load from .env via server.js (dotenv).
 */
module.exports = {
  apps: [
    {
      name: 'ttc-creator-hub',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
