#!/usr/bin/env bash
# =========================================================================
#  deploy.sh — wdrożenie / aktualizacja galerii ślubnej na VPS.
#
#  Uruchom z katalogu repo na serwerze:
#     bash deploy/deploy.sh
#
#  Robi: git pull (opcjonalnie) → npm ci → build → PM2 (re)start → health check.
#  Bezpieczny do wielokrotnego uruchamiania. Wymaga: node, npm, pm2.
# =========================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="wesele-galeria"
PORT="${PORT:-3100}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"
SKIP_PULL="${SKIP_PULL:-0}"

cd "$ROOT_DIR"
echo "▶ Katalog: $ROOT_DIR"

# --- 0. sanity: .env musi istnieć ---
if [[ ! -f ".env" ]]; then
	echo "✖ Brak pliku .env. Skopiuj: cp .env.example .env && nano .env"
	exit 1
fi

# --- 1. pobierz kod (jeśli repo git i nie pominięto) ---
if [[ "$SKIP_PULL" != "1" && -d ".git" ]]; then
	echo "▶ git pull…"
	git pull --ff-only || echo "⚠ git pull pominięty/nieudany — kontynuuję z bieżącym kodem"
fi

# --- 2. zależności ---
echo "▶ npm ci…"
if ! npm ci; then
	echo "⚠ npm ci nieudane, próbuję npm install…"
	npm install
fi

# --- 3. sprawdź ffmpeg (potrzebny do plakatów wideo) ---
if ! command -v ffmpeg >/dev/null 2>&1; then
	echo "⚠ Brak ffmpeg w PATH — plakaty wideo nie będą generowane."
	echo "  Zainstaluj: sudo apt-get install -y ffmpeg"
fi

# --- 4. build ---
echo "▶ npm run build…"
npm run build

# --- 5. PM2: reload jeśli działa, inaczej start ---
if command -v pm2 >/dev/null 2>&1; then
	if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
		echo "▶ pm2 reload $APP_NAME…"
		pm2 reload ecosystem.config.cjs --update-env
	else
		echo "▶ pm2 start…"
		pm2 start ecosystem.config.cjs
	fi
	pm2 save >/dev/null 2>&1 || true
else
	echo "✖ Brak pm2. Zainstaluj: npm i -g pm2   (albo użyj systemd — deploy/wesele-galeria.service)"
	exit 1
fi

# --- 6. health check ---
echo "▶ Health check: $HEALTH_URL"
ok=0
for i in $(seq 1 20); do
	if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then ok=1; break; fi
	sleep 1.5
done

if [[ "$ok" == "1" ]]; then
	body="$(curl -fsS "$HEALTH_URL" || true)"
	echo "✅ Wdrożono. $HEALTH_URL → $body"
	echo "$body" | grep -q '"r2":true' || echo "⚠ R2 nie skonfigurowane w .env — upload nie zadziała."
	echo "$body" | grep -q '"admin":true' || echo "⚠ Panel admina nie skonfigurowany (ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET)."
else
	echo "✖ Health check nieudany. Sprawdź logi: pm2 logs $APP_NAME --lines 50"
	exit 1
fi
