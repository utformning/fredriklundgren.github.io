# 🚀 Development Setup - Live Reload

Denna setup ger dig automatisk live reload så att webbläsaren uppdateras automatiskt när du ändrar filer.

## ✨ Funktioner

- ✅ **Automatisk webbläsaruppdatering** när du ändrar HTML, CSS eller JS-filer
- ✅ **Hot reload** - behöver aldrig manuellt ladda om sidan
- ✅ **Ett kommando** för att starta allt
- ✅ **Bevaka alla filer** i projektet automatiskt

## 📦 Installation (Endast första gången)

### Windows:
```cmd
python -m pip install -r requirements-dev.txt
```

### Mac/Linux:
```bash
python3 -m pip install -r requirements-dev.txt
```

## 🎯 Starta Development Server

### Windows:
Dubbelklicka på `start-dev.bat`

**ELLER** öppna CMD i projektmappen och kör:
```cmd
start-dev.bat
```

### Mac/Linux:
```bash
./start-dev.sh
```

## 🌐 Öppna i webbläsaren

Efter att servern startat, öppna:
- **Hemsida:** http://localhost:3000/index.html
- **AI Analyzer:** http://localhost:3000/analyzer.html

**OBS:** Webbläsaren öppnas automatiskt efter 2 sekunder!

## 🔥 Hur det fungerar

1. Starta dev-servern med `start-dev.bat` (Windows) eller `./start-dev.sh` (Mac/Linux)
2. Öppna sidan i din webbläsare
3. Börja redigera filer (HTML, CSS, JS)
4. Webbläsaren uppdateras **automatiskt** när du sparar!

## 📁 Bevakade filer

Servern bevakar automatiskt:
- ✅ `*.html` - Alla HTML-filer
- ✅ `css/*.css` - Alla CSS-filer
- ✅ `js/*.js` - Alla JavaScript-filer

## 🛑 Stoppa servern

Tryck `Ctrl + C` i terminalen där servern körs.

## 🐛 Felsökning

### "Python is not installed"
- Installera Python från https://www.python.org/
- Se till att Python är tillagt i PATH

### "livereload not found"
- Kör: `python -m pip install -r requirements-dev.txt`

### Webbläsaren uppdateras inte
- Kontrollera att du ser "LiveReload" i terminal-outputen
- Ladda om sidan manuellt en gång (`Ctrl + R`)
- Kolla att du har den senaste versionen av webbläsaren

## 💡 Tips

- **Snabbare utveckling:** Håll terminalen synlig så att du ser när filer ändras
- **Flera skärmar:** Ha koden på en skärm och webbläsaren på en annan
- **DevTools:** Öppna Chrome DevTools (F12) för att se console logs och fel

## 🔄 Jämfört med vanlig server

### Gamla sättet:
```
python -m http.server 8080
# Måste manuellt ladda om webbläsaren efter varje ändring
# Ctrl + Shift + R för varje liten ändring
```

### Nya sättet:
```
start-dev.bat  (eller ./start-dev.sh)
# Port 3000 med automatisk webbläsaröppning!
# Webbläsaren uppdateras automatiskt!
# Spara fil → se ändringen direkt!
```

---

**Njut av snabb utveckling! 🎉**
