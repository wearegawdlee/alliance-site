module.exports = {
  apps: [
    {
      name: 'alliance-backoffice',
      cwd: '/home/ubuntu/repos/alliance-site/backoffice',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/alliance/backoffice-error.log',
      out_file: '/var/log/alliance/backoffice-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '300M'
    }
  ]
};
