"""
Liggs - A futuristic notebook application
Flask backend with SQLite storage
"""

from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for
from functools import wraps
import sqlite3
import os
import io
from datetime import datetime
import hashlib
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

DB_PATH = os.path.join(os.path.dirname(__file__), 'liggs.db')

# ─── Database Setup ───────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT 'Untitled',
                content TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        conn.commit()

init_db()

# ─── Auth Helpers ─────────────────────────────────────────────────────────────

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        return f(*args, **kwargs)
    return decorated

# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400

    try:
        with get_db() as conn:
            conn.execute('INSERT INTO users (username, password) VALUES (?, ?)',
                         (username, hash_password(password)))
            conn.commit()
            user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
            session['user_id'] = user['id']
            session['username'] = user['username']
        return jsonify({'success': True, 'username': username})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already taken'}), 409

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    with get_db() as conn:
        user = conn.execute('SELECT * FROM users WHERE username = ? AND password = ?',
                            (username, hash_password(password))).fetchone()
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'success': True, 'username': username})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me')
def me():
    if 'user_id' in session:
        return jsonify({'authenticated': True, 'username': session['username']})
    return jsonify({'authenticated': False})

# ─── Notes API ────────────────────────────────────────────────────────────────

@app.route('/api/notes', methods=['GET'])
@login_required
def get_notes():
    q = request.args.get('q', '').strip()
    with get_db() as conn:
        if q:
            notes = conn.execute('''
                SELECT id, title, substr(content, 1, 80) as preview, updated_at
                FROM notes WHERE user_id = ?
                AND (title LIKE ? OR content LIKE ?)
                ORDER BY updated_at DESC
            ''', (session['user_id'], f'%{q}%', f'%{q}%')).fetchall()
        else:
            notes = conn.execute('''
                SELECT id, title, substr(content, 1, 80) as preview, updated_at
                FROM notes WHERE user_id = ?
                ORDER BY updated_at DESC
            ''', (session['user_id'],)).fetchall()
    return jsonify([dict(n) for n in notes])

@app.route('/api/notes', methods=['POST'])
@login_required
def create_note():
    data = request.json or {}
    title = data.get('title', 'Untitled')
    content = data.get('content', '')
    with get_db() as conn:
        cursor = conn.execute(
            'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
            (session['user_id'], title, content)
        )
        conn.commit()
        note = conn.execute('SELECT * FROM notes WHERE id = ?', (cursor.lastrowid,)).fetchone()
    return jsonify(dict(note)), 201

@app.route('/api/notes/<int:note_id>', methods=['GET'])
@login_required
def get_note(note_id):
    with get_db() as conn:
        note = conn.execute('SELECT * FROM notes WHERE id = ? AND user_id = ?',
                            (note_id, session['user_id'])).fetchone()
    if not note:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(note))

@app.route('/api/notes/<int:note_id>', methods=['PUT'])
@login_required
def update_note(note_id):
    data = request.json or {}
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with get_db() as conn:
        conn.execute('''
            UPDATE notes SET title = ?, content = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
        ''', (data.get('title', 'Untitled'), data.get('content', ''),
              now, note_id, session['user_id']))
        conn.commit()
        note = conn.execute('SELECT * FROM notes WHERE id = ?', (note_id,)).fetchone()
    if not note:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(note))

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
@login_required
def delete_note(note_id):
    with get_db() as conn:
        conn.execute('DELETE FROM notes WHERE id = ? AND user_id = ?',
                     (note_id, session['user_id']))
        conn.commit()
    return jsonify({'success': True})

@app.route('/api/notes/<int:note_id>/export')
@login_required
def export_note(note_id):
    with get_db() as conn:
        note = conn.execute('SELECT * FROM notes WHERE id = ? AND user_id = ?',
                            (note_id, session['user_id'])).fetchone()
    if not note:
        return jsonify({'error': 'Not found'}), 404
    content = f"# {note['title']}\n\nCreated: {note['created_at']}\nUpdated: {note['updated_at']}\n\n---\n\n{note['content']}"
    buf = io.BytesIO(content.encode('utf-8'))
    buf.seek(0)
    filename = note['title'].replace(' ', '_') + '.txt'
    return send_file(buf, as_attachment=True, download_name=filename, mimetype='text/plain')

# ─── Main Route ───────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)