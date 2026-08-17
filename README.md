# ReelRoom — Instagram Reels Co-Watch MVP

Watch Instagram Reels together in real-time with friends. Host a room, paste a Reel URL, and enjoy synced playback with live chat and reactions.

![ReelRoom Banner](./docs/banner.png)

## ✨ Features

- **🎬 Embed Mode**: Paste any public Instagram Reel URL for synced viewing
- **📺 Screen-Share Mode**: Host shares their browser via WebRTC
- **💬 Live Chat**: Real-time messaging with emoji reactions
- **📋 Queue System**: Queue multiple Reels for playlist-style viewing
- **🌓 Dark/Light Theme**: Modern, accessible interface
- **🔒 Privacy-First**: No Instagram credentials stored

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL (optional for dev, uses in-memory fallback)
- Redis (optional for dev, uses in-memory fallback)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/reelroom.git
cd reelroom

# Install dependencies
npm install

# Copy environment files
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env

# Start development servers
npm run dev
```

### Access the App

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## 📁 Project Structure

```
reelroom/
├── packages/
│   ├── frontend/          # React + Vite + Tailwind
│   ├── backend/           # Express + WebSocket
│   └── shared/            # Shared TypeScript types
├── tests/
│   └── e2e/               # Playwright E2E tests
├── docs/                  # Documentation
└── .github/workflows/     # CI/CD
```

## 🔧 Environment Variables

### Backend (`packages/backend/.env`)

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/reelroom
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key
CORS_ORIGIN=http://localhost:5173
```

### Frontend (`packages/frontend/.env`)

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npx playwright test --ui
```

## 📦 Deployment

### Frontend (Vercel)

```bash
cd packages/frontend
vercel deploy
```

### Backend (Cloud Run / Render)

```bash
cd packages/backend
docker build -t reelroom-backend .
docker run -p 3001:3001 reelroom-backend
```

## 🔐 Security & Compliance

- ✅ Uses official Instagram oEmbed API only
- ✅ No Instagram credentials stored
- ✅ Screen-share requires explicit user consent
- ✅ All data encrypted in transit (HTTPS/WSS)
- ✅ Rate limiting on all endpoints

## 📄 Legal

- [Privacy Policy](./docs/PRIVACY_POLICY.md)
- [Terms of Service](./docs/TERMS_OF_SERVICE.md)
- [Security Checklist](./docs/SECURITY_CHECKLIST.md)

## 🗺️ Roadmap

- [ ] Mobile apps (React Native)
- [ ] Voice chat integration
- [ ] Custom reactions/stickers
- [ ] Room recordings (with consent)
- [ ] Instagram Graph API integration (for business accounts)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

## 📝 License

MIT © 2024 ReelRoom Team
