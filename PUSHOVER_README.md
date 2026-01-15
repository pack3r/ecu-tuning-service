# Pushover Setup Guide

Pushover to darmowa aplikacja do natychmiastowych powiadomień na telefon.

## ⚙️ Konfiguracja Pushover:

### 1. Pobierz aplikację
- **Android**: [Google Play](https://play.google.com/store/apps/details?id=net.superblock.pushover)
- **iOS**: [App Store](https://apps.apple.com/app/pushover-notifications/id506088175)

### 2. Zarejestruj się
- Przejdź na [pushover.net](https://pushover.net)
- Utwórz konto
- Zaloguj się w aplikacji na telefonie

### 3. Utwórz aplikację
- W panelu Pushover przejdź do "Your Applications"
- Kliknij "Create an Application/API Token"
- Wypełnij:
  - **Name**: "ECU Tuning Service"
  - **Description**: "Powiadomienia o nowych zadaniach"
  - **Icon**: Opcjonalnie
- Skopiuj **API Token** (to będzie `PUSHOVER_APP_TOKEN`)

### 4. Skonfiguruj plik .env
Na serwerze w głównym katalogu aplikacji znajduje się plik `.env`. Zaktualizuj go:

```bash
# Otwórz plik .env
nano .env

# Zaktualizuj zmienne:
PUSHOVER_USER_KEY=your_user_key_here
PUSHOVER_APP_TOKEN=your_app_token_here
```

### 5. Restart serwera
```bash
# Z PM2
pm2 restart ecu-tuning-service

# Lub bez PM2
npm restart
```

## 📱 Jak znaleźć User Key:
- Zaloguj się na [pushover.net](https://pushover.net)
- Na stronie głównej zobaczysz swój **User Key** (kod zaczynający się od "u")
- To będzie `PUSHOVER_USER_KEY`

## 🔊 Dostępne dźwięki powiadomień:
- `pushover` - domyślny
- `bike` - rower
- `bugle` - trąbka
- `cashregister` - kasa
- `classical` - klasyczna muzyka
- `cosmic` - kosmiczny
- `falling` - spadanie
- `gamelan` - gamelan
- `incoming` - przychodzące
- `intermission` - przerwa
- `magic` - magia
- `mechanical` - mechaniczny
- `pianobar` - pianobar
- `siren` - syrena
- `spacealarm` - alarm kosmiczny
- `tugboat` - holownik
- `alien` - obcy
- `climb` - wspinaczka
- `persistent` - uporczywy (dla problemów)
- `echo` - echo
- `updown` - góra-dół
- `none` - bez dźwięku

## 🧪 Test powiadomień:
Po skonfigurowaniu możesz przetestować wysyłając nowe zadanie lub zgłaszając problem.

## 💰 Koszty:
- **Aplikacja**: $4.99 jednorazowo (na wszystkie urządzenia)
- **Powiadomienia**: Darmowe (bez limitu)
