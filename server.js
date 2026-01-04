const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sql = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Инициализация базы данных SQLite
let db;
const dbPath = path.join(__dirname, 'forum.db');

function initDB() {
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new sql.Database(buffer);
        console.log('База данных загружена');
    } else {
        db = new sql.Database();
        // Создание таблиц
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                roblox_nick TEXT,
                rod TEXT,
                discord TEXT,
                avatar TEXT,
                avatar_url TEXT,
                role TEXT DEFAULT 'user',
                reputation INTEGER DEFAULT 0,
                is_email_verified INTEGER DEFAULT 0,
                is_roblox_verified INTEGER DEFAULT 0,
                is_banned INTEGER DEFAULT 0,
                ban_reason TEXT,
                roblox_user_id TEXT,
                email_code TEXT,
                email_code_expires TEXT,
                is_online INTEGER DEFAULT 0,
                last_seen TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                extra_data TEXT,
                author_id TEXT NOT NULL,
                views INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                is_hot INTEGER DEFAULT 0,
                status TEXT DEFAULT 'open',
                status_text TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                text TEXT NOT NULL,
                is_admin_action INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id),
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                content TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (sender_id) REFERENCES users(id),
                FOREIGN KEY (receiver_id) REFERENCES users(id)
            )
        `);
        
        // Создание админа по умолчанию
        const adminId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const now = new Date().toISOString();
        db.run(`
            INSERT INTO users (id, username, email, password, roblox_nick, avatar, role, is_email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [adminId, 'Admin', 'admin@unfilteredrp.com', 'admin123', 'AdminRP', '👑', 'management', 1, now, now]);
        
        saveDB();
        console.log('База данных создана с админом по умолчанию (admin@unfilteredrp.com / admin123)');
    }
}

function saveDB() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
}

// Простой хеш пароля (в продакшене используйте bcrypt)
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

// API Routes
app.post('/api/auth/register', (req, res) => {
    try {
        const { username, email, password, robloxNick, rod } = req.body;
        
        if (!username || !email || !password || !robloxNick || !rod) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        
        // Проверка существующего пользователя
        const existing = db.exec(`SELECT id FROM users WHERE username = '${username}' OR email = '${email}'`);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
        }
        
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const now = new Date().toISOString();
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        db.run(`
            INSERT INTO users (id, username, email, password, roblox_nick, rod, avatar, role, email_code, email_code_expires, created_at, updated_at, is_online)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, username, email.toLowerCase(), hashPassword(password), robloxNick, rod, '🎮', 'user', emailCode, codeExpires, now, now, 1]);
        
        saveDB();
        
        res.json({
            token: 'token_' + id,
            user: {
                id,
                username,
                email: email.toLowerCase(),
                roblox_nick: robloxNick,
                rod,
                avatar: '🎮',
                role: 'user'
            },
            emailCode
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = db.exec(`SELECT * FROM users WHERE username = '${username}'`);
        if (result.length === 0 || result[0].values.length === 0) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        const user = result[0].values[0];
        const userObj = {
            id: user[0],
            username: user[1],
            email: user[2],
            password: user[3],
            roblox_nick: user[4],
            rod: user[5],
            discord: user[6],
            avatar: user[7],
            avatar_url: user[8],
            role: user[9],
            reputation: user[10],
            is_email_verified: user[11],
            is_roblox_verified: user[12],
            is_banned: user[13],
            ban_reason: user[14],
            roblox_user_id: user[15],
            email_code: user[16],
            email_code_expires: user[17],
            is_online: user[18],
            last_seen: user[19],
            created_at: user[20],
            updated_at: user[21]
        };
        
        if (userObj.password !== hashPassword(password)) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        if (userObj.is_banned) {
            return res.status(403).json({ error: 'Аккаунт заблокирован: ' + (userObj.ban_reason || 'Причина не указана') });
        }
        
        db.run(`UPDATE users SET is_online = 1, last_seen = '${new Date().toISOString()}' WHERE id = '${userObj.id}'`);
        saveDB();
        
        res.json({
            token: 'token_' + userObj.id,
            user: {
                id: userObj.id,
                username: userObj.username,
                email: userObj.email,
                roblox_nick: userObj.roblox_nick,
                rod: userObj.rod,
                discord: userObj.discord,
                avatar: userObj.avatar,
                avatar_url: userObj.avatar_url,
                role: userObj.role,
                reputation: userObj.reputation || 0,
                is_email_verified: userObj.is_email_verified,
                is_roblox_verified: userObj.is_roblox_verified,
                created_at: userObj.created_at
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Заглушки для остальных API (нужно будет доработать)
app.get('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not implemented yet' });
});

app.post('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not implemented yet' });
});

// Запуск сервера
initDB();
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT}`);
});

