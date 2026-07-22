# Brief dla Claude Code — aplikacja „galeria ślubna"

## 1. Cel
Zbuduj aplikację webową, do której goście weselni wrzucają zdjęcia i filmy ze swojej galerii w telefonie. Goście trafiają na stronę skanując kod QR z winietki. Galeria jest **wspólna i widoczna od razu** (bez moderacji wstępnej). Aplikacja stanie na moim VPS-ie, pod subdomeną wystawioną przez Cloudflare.

## 2. Stack (ustalony)
- **SvelteKit** (adapter `node`), TypeScript.
- **SQLite** (przez `better-sqlite3` lub Drizzle ORM) — tylko metadane; brak osobnego serwera bazy.
- **Cloudflare R2** jako storage plików (S3-compatible, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).
- **sharp** (miniatury zdjęć) + **ffmpeg** (klatka-plakat z wideo, opcjonalnie lekki podgląd).
- **Caddy** jako reverse proxy z auto-TLS przed procesem Node (albo nginx — wybierz Caddy dla prostoty).

## 3. Architektura uploadu (krytyczne)
Cloudflare Free/Pro ma twardy limit **100 MB** na rozmiar requestu przechodzącego przez proxy. Filmy weselne bywają większe, więc **plik NIE może iść przez VPS/proxy**.

Przepływ:
1. Klient prosi backend o **presigned multipart URL** do R2 (endpoint na VPS, mały request — mieści się w limicie).
2. Przeglądarka wysyła plik **bezpośrednio do R2** w częściach (multipart / resumable), z retry przy zerwaniu połączenia (ważne — mobilny zasięg na sali).
3. Po zakończenia klient woła backend „upload complete", backend zapisuje metadane w SQLite i kolejkuje generowanie miniatury.
4. Miniatury/plakaty wideo generowane po stronie VPS (pobranie z R2 → sharp/ffmpeg → zapis miniatury z powrotem do R2).

## 4. Funkcje

### Gość (widok publiczny, mobile-first)
- Landing po zeskanowaniu QR: krótkie powitanie, przycisk „Dodaj zdjęcia/filmy".
- **Opcjonalne** pole „Imię lub pseudonim" (zapisywane przy plikach danej sesji; bez logowania). Zapamiętane w `localStorage`, żeby nie wpisywać ponownie.
- Wybór wielu plików naraz (`<input accept="image/*,video/*" multiple>`), z podglądem i paskiem postępu per plik.
- Wspólna galeria: siatka miniatur, lazy-load, lightbox ze zdjęciami i odtwarzaczem wideo. Nowe pliki widoczne od razu.
- Licznik „X wspomnień dodanych".

### Admin (Wy — panel pod osobną ścieżką, chroniony hasłem)
- Podgląd wszystkich plików z metadanymi (imię gościa, data, rozmiar, typ).
- **Pobierz wszystko jako ZIP** (oryginały) — strumieniowo, bez ładowania całości do RAM.
- Usuwanie pojedynczych plików (usuwa też z R2).
- Możliwość ukrycia pliku z galerii (soft-hide) bez kasowania.
- Prosty licznik i statystyki.

## 5. Limity i formaty
- Akceptuj popularne formaty foto (jpg, png, heic/heif → konwersja do jpg dla podglądu) i wideo (mp4, mov, m4v).
- Limit rozmiaru per plik: konfigurowalny (domyślnie np. 500 MB wideo, 50 MB zdjęcie).
- Walidacja typu MIME po stronie backendu, nie tylko rozszerzenia.
- HEIC/HEVC z iPhone: zadbaj o generowanie podglądu, który wyświetli się na Androidzie (miniatura jpg + plakat wideo).

## 6. Model danych (SQLite)
- `uploads`: id, r2_key, original_filename, mime, size, kind (image/video), guest_name (nullable), thumb_key (nullable), poster_key (nullable), width/height/duration (nullable), created_at, hidden (bool), ip_hash.
- `sessions` (opcjonalnie): id, guest_name, created_at.
- `admins` / config: hash hasła admina (bcrypt/argon2) w env, nie w bazie.

## 7. Bezpieczeństwo i anti-abuse
- Rate-limiting na endpointach presign/complete (per IP, w oknie czasowym).
- `ip_hash` (nie surowe IP) przy plikach do wykrywania spamu.
- Presigned URL krótkożyjący, ograniczony do konkretnego klucza i rozmiaru.
- Panel admina za hasłem + (opcjonalnie) Cloudflare Access na ścieżce `/admin`.
- CSP, walidacja rozmiaru/typu, zabezpieczenie przed path traversal w kluczach R2.

## 8. RODO
- W panelu admina możliwość usunięcia materiałów na żądanie.

## 9. Deployment
- Proces Node uruchamiany przez **systemd** (lub Docker Compose — wybierz systemd dla lekkości).
- **Caddy** przed aplikacją: auto-TLS, reverse proxy na port Node.
- Cloudflare: rekord DNS subdomeny (proxied/pomarańczowa chmurka), tryb SSL **Full (strict)** z Origin Certificate; endpoint uploadu i tak omija limit, bo leci do R2.
- Zmienne środowiskowe: R2 (account id, access key, secret, bucket, endpoint), hasło admina, limity, nazwa subdomeny.
- README z krok-po-kroku: konfiguracja R2, DNS, Caddyfile, systemd unit, zmienne env, uruchomienie.

## 10. Generator QR (osobny mały skrypt/strona)
- Wygeneruj kod QR prowadzący do subdomeny galerii.
- Poziom korekcji błędów **H** (albo Q), żeby zmieścić w centrum logo/inicjały/grafikę bez utraty skanowalności.
- Wejście: URL + opcjonalny plik logo/inicjały (PNG/SVG) wstawiany na środek; parametry kolorów.
- Wyjście: SVG i PNG w wysokiej rozdzielczości do druku na winietce.
- Uwzględnij margines (quiet zone) i mocny kontrast; nie zasłaniaj markerów pozycjonujących w narożnikach.
- (Opcjonalnie) tryb generowania wielu QR z parametrem imienia gościa w URL, gdyby chcieć spersonalizowane winietki.

## 11. Nice-to-have (opcjonalne)
- Reakcje/serduszka pod zdjęciami.
- Prosty licznik gości online.

## 12. Kryteria akceptacji
- Gość na telefonie: skan QR → strona → (opcjonalne imię) → wrzucenie kilku zdjęć i filmu 300+ MB bez błędu, mimo Cloudflare.
- Materiały pojawiają się w wspólnej galerii natychmiast, z działającymi miniaturami i odtwarzaniem wideo.
- Admin pobiera całość jako ZIP i może usunąć/ukryć pliki.
- Aplikacja działa pod subdomeną przez Cloudflare, R2 przyjmuje pliki bezpośrednio, VPS pozostaje lekki.
- README pozwala postawić całość od zera.
