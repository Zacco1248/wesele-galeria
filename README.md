# 💍 Galeria ślubna

Wspólna galeria weselna: goście skanują kod QR z winietki, wrzucają zdjęcia i filmy
prosto z telefonu, a wszystko pojawia się w jednej galerii **od razu** (bez moderacji
wstępnej). Panel administratora pozwala pobrać całość jako ZIP oraz ukrywać/usuwać
pliki.

Zbudowane pod hosting na istniejącym VPS (obok MoneyLet): **SvelteKit + Nginx + PM2**,
storage plików na **Cloudflare R2**, metadane w **SQLite**.

---

## Spis treści

1. [Jak to działa](#1-jak-to-działa)
2. [Funkcje](#2-funkcje)
3. [Uruchomienie lokalne](#3-uruchomienie-lokalne)
4. [Cloudflare R2 — krok po kroku](#4-cloudflare-r2--krok-po-kroku)
5. [Cloudflare DNS + SSL (subdomena)](#5-cloudflare-dns--ssl-subdomena)
6. [Wdrożenie na VPS](#6-wdrożenie-na-vps)
7. [Nginx](#7-nginx)
8. [Zmienne środowiskowe](#8-zmienne-środowiskowe)
9. [Generator kodów QR](#9-generator-kodów-qr)
10. [Panel administratora](#10-panel-administratora)
11. [Bezpieczeństwo i RODO](#11-bezpieczeństwo-i-rodo)
12. [Rozwiązywanie problemów](#12-rozwiązywanie-problemów)

---

## 1. Jak to działa

Cloudflare (Free/Pro) ma **twardy limit 100 MB** na request przechodzący przez proxy.
Filmy weselne bywają większe, więc **plik nigdy nie przechodzi przez VPS ani proxy**:

```
 Telefon gościa                VPS (Node/SvelteKit)            Cloudflare R2
 ─────────────                 ────────────────────           ─────────────
 1. „chcę wysłać plik” ───────▶ /api/uploads/presign
                                (walidacja MIME/rozmiaru,
                                 rate-limit)  ───────────────▶ tworzy multipart
                             ◀── presigned URL-e części ─────
 2. PUT części (retry) ─────────────────────────────────────▶ bajty lecą PROSTO
                                                               do R2 (omija limit)
 3. „gotowe” ─────────────────▶ /api/uploads/complete
                                (HEAD → weryfikacja rozmiaru,
                                 zapis metadanych w SQLite,
                                 kolejka miniatur)
                                        │
                                        ▼
                                worker: pobiera z R2 → sharp/ffmpeg
                                → miniatura/plakat → zapis do R2
```

- **Miniatury zdjęć**: `sharp` (auto-rotacja EXIF, WebP).
- **Plakaty wideo**: `ffmpeg` czyta klatkę bezpośrednio z presigned URL R2 (range-requesty),
  więc wielosetmegabajtowy film **nie ląduje na dysku VPS**.
- **Serwowanie mediów**: endpoint `/m/<id>/<wariant>` robi 302 na krótkożyjący presigned
  URL — bajty znów lecą przeglądarka ↔ R2, z pominięciem VPS.

## 2. Funkcje

**Gość (mobile-first):** landing po QR, opcjonalne imię (zapamiętane w `localStorage`),
wybór wielu plików naraz, podgląd + pasek postępu per plik z ponawianiem, wspólna galeria
z lazy-load i lightboxem (zdjęcia + odtwarzacz wideo), licznik wspomnień, serduszka,
**licznik gości online** (na żywo), ciepły motyw kwiatowy (marigold/pomarańcz/beż).

**Admin (`/admin`, hasło):** podgląd wszystkich plików z metadanymi (imię, data, rozmiar,
typ), pobieranie całości jako **ZIP strumieniowo**, ukrywanie (soft-hide) i usuwanie
(kasuje też z R2), statystyki.

## 3. Uruchomienie lokalne

Wymagania: **Node ≥ 20**, oraz `ffmpeg`/`ffprobe` w `PATH` (dla plakatów wideo).

```bash
npm install
cp .env.example .env
# wygeneruj hasło admina + sekret sesji:
npm run hash-password -- "twoje-haslo"   # wklej wynik do .env
# uzupełnij dane R2 w .env (patrz sekcja 4)
npm run dev
```

Aplikacja: <http://localhost:5173>. Panel: <http://localhost:5173/admin>.

> Do testów lokalnego uploadu R2 CORS musi zawierać `http://localhost:5173`
> (jest już w `deploy/r2-cors.json`).

## 4. Cloudflare R2 — krok po kroku

1. Panel Cloudflare → **R2** → włącz (wymaga karty, ale **free tier** = 10 GB storage,
   egress **za darmo**; realnie bezkosztowe dla jednego wesela).
2. **Create bucket** → nazwa np. `wesele-galeria` (region: Automatic).
3. **R2 → Manage API Tokens → Create API Token**:
   - uprawnienia **Object Read & Write**, ograniczone do tego bucketu,
   - zapisz **Access Key ID** i **Secret Access Key** → do `.env`.
4. **Account ID** znajdziesz na stronie R2 (prawy panel) → `R2_ACCOUNT_ID`.
5. **CORS** (krytyczne — bez tego przeglądarka nie odczyta `ETag` i multipart nie zadziała):
   bucket → **Settings → CORS Policy → Edit** → wklej zawartość
   [`deploy/r2-cors.json`](deploy/r2-cors.json) (dostosuj `AllowedOrigins` do swojej domeny).
6. (Opcjonalnie) miniatury z publicznego adresu zamiast presigned: bucket → **Settings →
   Public access** (r2.dev lub własna domena) → ustaw `R2_PUBLIC_BASE` w `.env`.

## 5. Cloudflare DNS + SSL (subdomena)

Domena `moneylet.pl` jest już w Cloudflare — dodajemy tylko subdomenę:

1. **DNS → Add record**: typ `A` (lub `CNAME`), nazwa `wesele`, treść = IP VPS,
   **Proxy status: Proxied (pomarańczowa chmurka)**.
2. **SSL/TLS → Overview → Full (strict)**.
3. **SSL/TLS → Origin Server → Create Certificate** → zapisz na VPS:
   ```
   /etc/ssl/cloudflare/wesele.moneylet.pl.pem   (certyfikat)
   /etc/ssl/cloudflare/wesele.moneylet.pl.key   (klucz)
   ```
   (te ścieżki są w [`deploy/nginx-wesele.conf`](deploy/nginx-wesele.conf)).

## 6. Wdrożenie na VPS

Standard na tym VPS to **PM2 + Nginx** (jak MoneyLet).

```bash
# na VPS, jako user ubuntu
cd /home/ubuntu/apps
git clone <repo-url> wesele-galeria
cd wesele-galeria

npm ci
cp .env.example .env && nano .env      # uzupełnij (R2, hasło, PUBLIC_BASE_URL, PORT=3100)
npm run build

# start pod PM2
pm2 start ecosystem.config.cjs
pm2 save                               # zapisz listę procesów
pm2 startup                            # (raz) autostart po reboocie

# sanity check
curl -s http://127.0.0.1:3100/health
```

Aktualizacja później — jednym poleceniem (git pull → ci → build → pm2 reload → health):

```bash
cd /home/ubuntu/apps/wesele-galeria
bash deploy/deploy.sh
```

Alternatywnie zamiast PM2 — systemd: patrz [`deploy/wesele-galeria.service`](deploy/wesele-galeria.service).

`ffmpeg` na Ubuntu: `sudo apt-get install -y ffmpeg`.

## 7. Nginx

```bash
sudo cp deploy/nginx-wesele.conf /etc/nginx/sites-available/wesele.moneylet.pl
sudo ln -s /etc/nginx/sites-available/wesele.moneylet.pl /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Server block proxuje `wesele.moneylet.pl` → `127.0.0.1:3100`, odczytuje prawdziwe IP z
`CF-Connecting-IP` i wyłącza buforowanie dla strumienia ZIP. Pliki mediów **nie** przechodzą
przez Nginx (lecą do R2), więc `client_max_body_size` może być małe.

## 8. Zmienne środowiskowe

Pełna lista z opisami: [`.env.example`](.env.example). Najważniejsze:

| Zmienna | Opis |
|---|---|
| `PUBLIC_BASE_URL` | Publiczny URL, np. `https://wesele.moneylet.pl` |
| `PORT` | Port Node (za Nginx), domyślnie `3100` |
| `EVENT_TITLE` / `EVENT_SUBTITLE` | Teksty na stronie |
| `ADMIN_PASSWORD_HASH` | bcrypt hasła (`npm run hash-password`) |
| `ADMIN_SESSION_SECRET` | Sekret podpisu sesji (`openssl rand -hex 32`) |
| `IP_HASH_SALT` | Sól do haszowania IP |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Dostęp do R2 |
| `MAX_IMAGE_MB` / `MAX_VIDEO_MB` | Limity rozmiaru (domyślnie 50 / 500) |

## 9. Generator kodów QR

Tworzy **SVG** (wektor) + **PNG** w wysokiej rozdzielczości, korekcja błędów **H**
(miejsce na logo w centrum bez utraty skanowalności), z zachowaniem strefy ciszy i markerów.

```bash
# podstawowy kod na winietkę
npm run qr -- --url https://wesele.moneylet.pl --label "Zeskanuj i dodaj zdjęcia"

# z logo/inicjałami w środku i kolorami
npm run qr -- --url https://wesele.moneylet.pl --logo ./inicjaly.png --fg "#3a322b" --bg "#faf6f0"

# spersonalizowane winietki (URL z ?g=Imię, po jednym pliku na gościa)
npm run qr -- --url https://wesele.moneylet.pl --names "Ciocia Basia,Marek,Ola i Tomek"
npm run qr -- --url https://wesele.moneylet.pl --names-file goscie.txt
```

Wynik trafia do `qr/out/`.

## 10. Panel administratora

`https://wesele.moneylet.pl/admin` → logowanie hasłem (bcrypt) z rate-limitem.
Sesja to podpisane HMAC ciasteczko (`httpOnly`, `secure`), ważne `ADMIN_SESSION_HOURS`.
Rotacja `ADMIN_SESSION_SECRET` unieważnia wszystkie sesje.

## 11. Bezpieczeństwo i RODO

- **CSP** i nagłówki bezpieczeństwa ustawiane w [`src/hooks.server.ts`](src/hooks.server.ts).
- Klucze R2 **generowane wyłącznie po stronie serwera** (losowe id + whitelistowane
  rozszerzenie) — brak możliwości path-traversal / key-injection.
- Presigned URL-e krótkożyjące, ograniczone do konkretnego klucza i operacji.
- Rzeczywisty rozmiar pliku weryfikowany przez `HEAD` na R2 (nie ufamy klientowi).
- Rate-limiting na `presign` i logowaniu; przy plikach zapisywany jest tylko **hash IP**
  (`ip_hash`), nigdy surowe IP.
- **RODO**: panel admina pozwala usunąć dowolny materiał na żądanie (kasuje też z R2).

## 12. Rozwiązywanie problemów

| Objaw | Przyczyna / rozwiązanie |
|---|---|
| Upload kończy się „Brak nagłówka ETag” | Brak `ExposeHeaders: ETag` w CORS R2 — popraw politykę (sekcja 4.5) |
| Upload dużego pliku 403/CORS | `AllowedOrigins` w CORS nie zawiera Twojej domeny |
| Miniatury się nie generują | Brak `ffmpeg`/`ffprobe` w PATH (dla wideo) lub błąd R2 — sprawdź `pm2 logs wesele-galeria` |
| HEIC z iPhone bez podglądu | Zależne od buildu libvips w `sharp`; oryginał i tak jest zapisany i pobieralny |
| 502 z Nginx | Proces Node nie działa/port się nie zgadza — `pm2 status`, `curl 127.0.0.1:3100/health` |
| „Panel nie jest skonfigurowany” | Brak `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` w `.env` |

---

Licencja: MIT.
