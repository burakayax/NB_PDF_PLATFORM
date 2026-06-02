/**
 * PM2 üretim yapılandırması.
 * Kullanım: pm2 start ecosystem.config.cjs
 * İlk dağıtım: npm run build:all && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "nb-auth-api",
      script: "web/api/dist/server.js",
      cwd: ".",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env_production: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      error_file: "logs/pm2-auth-api-error.log",
      out_file: "logs/pm2-auth-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_memory_restart: "512M",
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: "nb-pdf-api",
      script: "scripts/run-pdf-api.mjs",
      cwd: ".",
      interpreter: "node",
      args: "--prod",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env_production: {
        NODE_ENV: "production",
        PDF_API_PORT: 8000,
        PDF_UVICORN_WORKERS: 2,
      },
      error_file: "logs/pm2-pdf-api-error.log",
      out_file: "logs/pm2-pdf-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
