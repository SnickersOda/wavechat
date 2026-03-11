# 🌊 WaveChat

**Полнофункциональный мессенджер в стиле Discord/Telegram**, построенный на Node.js + React.

---

## 🚀 Быстрый старт (локально)

```bash
# 1. Клонировать / распаковать архив
cd wavechat

# 2. Скопировать переменные окружения
cp .env.example .env

# 3. Установить зависимости и запустить
npm install
npm run build   # сборка React
npm start       # запуск сервера

# Или для разработки (hot reload):
npm run dev
```

Открыть: **http://localhost:3001**

---

## 🌐 Деплой на Railway

### Шаг 1 — Создать аккаунт
Зайдите на [railway.app](https://railway.app) и войдите через GitHub.

### Шаг 2 — Новый проект
- Нажмите **New Project → Deploy from GitHub repo**
- Выберите ваш репозиторий с WaveChat

### Шаг 3 — Переменные окружения
В Railway → Settings → Variables добавьте:
```
NODE_ENV=production
JWT_SECRET=your-very-long-random-secret-here
PORT=3001
```

### Шаг 4 — Деплой
Railway автоматически запустит `npm install && npm run build && npm start`.

### Шаг 5 — Домен
В разделе Settings → Domains → Generate Domain получите бесплатный домен.

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────┐
│                    КЛИЕНТ (React)                │
│  AuthPage → MainLayout → ChatArea               │
│  Stores: authStore, chatStore, socketStore       │
└──────────────────┬──────────────────────────────┘
                   │ HTTP REST + WebSocket (Socket.io)
┌──────────────────▼──────────────────────────────┐
│               СЕРВЕР (Node.js + Express)         │
│  Routes: /auth /servers /channels /messages /dm  │
│  Socket: messages, typing, voice, WebRTC         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│               SQLite (better-sqlite3)            │
│  users, servers, channels, messages, reactions   │
└─────────────────────────────────────────────────┘
```

---

## 📁 Структура файлов

```
wavechat/
├── server/
│   ├── index.js          # Точка входа сервера
│   ├── db.js             # Инициализация SQLite
│   ├── socket.js         # WebSocket обработчики
│   ├── middleware/
│   │   └── auth.js       # JWT аутентификация
│   └── routes/
│       ├── auth.js       # /api/auth
│       ├── users.js      # /api/users
│       ├── servers.js    # /api/servers
│       ├── channels.js   # /api/channels
│       ├── messages.js   # /api/messages
│       ├── dm.js         # /api/dm
│       └── upload.js     # /api/upload
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx
│   │   │   └── MainLayout.jsx
│   │   ├── components/
│   │   │   ├── chat/     # Все компоненты чата
│   │   │   ├── voice/    # Голос/видео
│   │   │   └── ui/       # Общие UI компоненты
│   │   ├── store/        # Zustand stores
│   │   ├── hooks/        # useWebRTC
│   │   └── utils/        # API, helpers
│   └── ...
├── package.json
├── railway.toml
└── .env.example
```

---

## ✨ Функции

| Категория | Функции |
|-----------|---------|
| **Авторизация** | Регистрация, вход, JWT, профили, аватары, статус онлайн |
| **Сообщения** | Личные чаты, группы, каналы, ответы, редактирование, удаление |
| **Реакции** | Emoji-реакции, тогл |
| **Медиа** | Изображения, видео, аудио, файлы, drag & drop, превью |
| **Голос/видео** | WebRTC звонки, голосовые комнаты, mute/deafen, демонстрация экрана |
| **Real-time** | Socket.io: новые сообщения, typing indicator, статус онлайн |
| **Серверы** | Создание серверов, каналы, роли, бан/кик, инвайты |
| **UX** | Infinite scroll, поиск, закреплённые, Markdown, dark mode |
| **Безопасность** | Rate limiting, валидация, bcrypt, helmet |

---

## 🔧 Технологии

**Backend:** Node.js, Express, Socket.io, SQLite (better-sqlite3), JWT, Multer  
**Frontend:** React 18, Vite, TailwindCSS, Zustand, Socket.io-client  
**Realtime:** WebSocket (Socket.io) + WebRTC (voice/video)  
**Deploy:** Railway, Nixpacks

---

## 🔮 Масштабирование (будущее)

- Заменить SQLite → PostgreSQL для multi-instance
- Добавить Redis для pub/sub и хранения сессий
- CDN для медиа файлов (AWS S3 / Cloudflare R2)
- Горизонтальное масштабирование с Socket.io Redis adapter
- Push notifications (Web Push API)
- Полнотекстовый поиск (ElasticSearch / PostgreSQL FTS)
