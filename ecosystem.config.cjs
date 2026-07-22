// PM2 process definition for the wedding gallery.
// Matches the existing MoneyLet VPS setup (PM2 + Nginx). The app reads the rest
// of its config from ./.env at runtime (dotenv is loaded by the built server via
// the environment; env_file keeps secrets out of this file).
module.exports = {
	apps: [
		{
			name: 'wesele-galeria',
			script: 'build/index.js',
			cwd: __dirname,
			node_args: '--env-file=.env',
			env: {
				NODE_ENV: 'production',
				// PORT is also set in .env; kept here so PM2 shows it. Keep them in sync.
				PORT: 3100,
				HOST: '127.0.0.1'
			},
			instances: 1,
			exec_mode: 'fork',
			autorestart: true,
			max_memory_restart: '600M',
			// Never crash-loop faster than this if something is misconfigured.
			min_uptime: '20s',
			max_restarts: 10
		}
	]
};
