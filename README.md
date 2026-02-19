# ⬡ Liggs — Futuristic Notebook App

A fully working notebook-style web application with a dark futuristic aesthetic,
UFO intro animation, and full CRUD for notes.

## Features
- 🛸 UFO intro animation (pure CSS/HTML, no libraries)
- 🔐 User registration & login (session-based)
- 📓 Create, read, update, delete notes
- 💾 Auto-save (2 seconds after last keystroke)
- 🔍 Live search across notes
- ↓  Export notes as .txt files
- ⌨️  Keyboard shortcuts (Ctrl+S to save, Ctrl+N for new note)
- 📱 Responsive design (mobile-friendly)

## Tech Stack
- **Backend**: Python 3 + Flask
- **Database**: SQLite (auto-created on first run)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (no frameworks)

## Project Structure
```
liggs/
├── app.py              # Flask backend + API routes
├── liggs.db            # SQLite database (auto-created)
├── templates/
│   └── index.html      # Main HTML template
└── static/
    ├── style.css       # All styles + UFO animation
    └── script.js       # App logic, auth, CRUD, autosave
```

## Quick Start

### 1. Install dependencies
```bash
pip install flask
```

### 2. Run the app
```bash
cd liggs
python app.py
```

### 3. Open in browser
```
http://localhost:5000
```

### 4. Use the app
1. Watch the UFO intro animation
2. Register a new account
3. Click "New Note" to create your first note
4. Notes auto-save after 2 seconds of inactivity
5. Use the search bar to find notes
6. Click "↓ Export" to download a note as .txt

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| GET | `/api/me` | Check auth status |
| GET | `/api/notes` | List all notes |
| POST | `/api/notes` | Create note |
| GET | `/api/notes/:id` | Get single note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |
| GET | `/api/notes/:id/export` | Export as .txt |

## Keyboard Shortcuts
- `Ctrl + S` — Save current note
- `Ctrl + N` — New note
- `Enter` in auth forms — Submit