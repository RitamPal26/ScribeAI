# ScribeAI - AI-Powered Meeting Transcription

> Real-time audio transcription and AI-powered meeting summaries using Next.js, Socket.io, and Google Gemini

[Demo Video](#)

---

## Overview

ScribeAI transforms live audio into searchable, summarized transcripts in real-time. Capture meeting audio from your microphone or browser tabs (Google Meet, Zoom, YouTube) and receive instant AI-powered transcriptions with automatic summaries.

**Built for:** AttackCapital Technical Assignment  
**Timeline:** 4 days  
**Status:** ✅ Production-ready prototype

---

## Features

### Core Functionality
-  **Real-time Transcription** - Live streaming audio chunks (5s intervals) to Gemini API
-  **Dual Input Sources**
  -  Microphone recording
  -  Browser tab audio capture (Google Meet, Zoom, Spotify, YouTube)
-  **Pause/Resume** - Control recording flow with state preservation
-  **AI-Powered Summaries** - Automatic generation of key points, action items, and decisions
-  **Session Management** - Complete history with search, filter, and export capabilities
-  **Live UI Updates** - Real-time transcript display via Socket.io

---

## Tech Stack

**Frontend**
- Next.js 16.0.1
- Tailwind CSS + shadcn/ui
- Zustand (State Management)
- Socket.io Client

**Backend**
- Node.js 20+ with TypeScript
- Socket.io Server
- Express
- Prisma ORM

**AI & APIs**
- Google Gemini 2.5 Flash (Transcription)
- Gemini via Vercel AI SDK (Structured Summaries)

**Database**
- PostgreSQL 

**Authentication**
- Better Auth

**DevOps**
- pnpm (Package Manager)
- Turbopack (Next.js Dev Server)

---

## Installation

### Prerequisites
- Node.js 20+ 
- PostgreSQL 15+ (local or cloud)
- pnpm installed (`npm install -g pnpm`)
- Google Gemini API Key ([Get one free](https://aistudio.google.com/apikey))

### Setup Instructions

1. **Clone Repository**
```
git clone https://github.com/RitamPal26/ScribeAI.git
cd ScribeAI
```

2. **Install Dependencies**
```
pnpm install
```

3. **Configure Environment Variables**
```
cp .env.example .env
```

4. **Setup Database**
```
# Push Prisma schema to database
pnpm prisma db push

# (Optional) Seed with sample data
pnpm prisma db seed
```

5. **Start Development Server**
```
pnpm dev
```

---

## Project Structure

```
ScribeAI/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (dashboard)/
│   │   │   └── dashboard/
│   │   │       ├── page.tsx      # Dashboard home
│   │   │       ├── record/       # Recording interface
│   │   │       └── sessions/     # Session history
│   │   ├── api/                  # API routes
│   │   ├── login/                # Auth pages
│   │   └── signup/
│   │
│   ├── components/
│   │   ├── auth/                 # Auth forms
│   │   ├── dashboard/            # Dashboard components
│   │   ├── recording/            # Recording UI
│   │   ├── sessions/             # Session cards
│   │   └── ui/                   # shadcn/ui components
│   │
│   ├── hooks/
│   │   ├── useRecording.ts       # Core recording logic
│   │   └── useSocket.ts          # Socket.io client hook
│   │
│   ├── lib/
│   │   ├── auth.ts               # Better Auth config
│   │   ├── prisma.ts             # Database client
│   │   └── socket-client.ts      # Socket.io setup
│   │
│   └── stores/
│       └── recordingStore.ts     # Zustand state
│
├── server/
│   ├── services/
│   │   ├── audioProcessor.ts     # Gemini integration
│   │   └── sessionService.ts     # Database operations
│   │
│   ├── socket/
│   │   └── recording.ts          # Socket.io handlers
│   │
│   └── index.ts                  # Server entry point
│
├── prisma/
│   └── schema.prisma             # Database schema
│
└── server.js                     # Socket.io server
```

---

## Screenshots

### Session Details
<img width="1866" alt="Dashboard Home" src="https://github.com/user-attachments/assets/2a720174-b8bf-4bdc-84d3-7dc376860bac" />

*View complete transcript and download options*

### AI Summary
<img width="1874" alt="Recording Interface" src="https://github.com/user-attachments/assets/bf231941-1f96-428e-a957-d048e4567b7d" />

*Automatic summary with key points and action items*

### Session History
<img width="1883" alt="Session History" src="https://github.com/user-attachments/assets/fa5436a7-c846-4310-aa7d-5aec4f2025dd" />

*Browse and manage all recorded sessions*

### Live Transcription
<img width="1849" alt="Live Transcription" src="https://github.com/user-attachments/assets/621b6b9d-2d4f-4c7a-836a-f876c1e2f548" />

*Real-time text appears as you speak*

### Dashboard Overview
<img width="1872" alt="AI Summary" src="https://github.com/user-attachments/assets/b72e76c8-9674-4825-9793-c5a9a42f3bb3" />

*Main dashboard showing session statistics and recent recordings*

### Landing Page
<img width="1907" alt="Session Details" src="https://github.com/user-attachments/assets/6aae450e-4c68-407f-a1d8-fb1d36591d3d" />

*Simple landing page*

---

## Architecture & Design

For complete system architecture, data flow diagrams, and technical decisions:

👉 **[View Architecture Documentation](./docs)**

---

## Demo Video

[📹 Watch Full Walkthrough (5 min)](https://youtu.be/YOUR_VIDEO_ID)

**Demonstration includes:**
- ✅ Microphone recording with live transcription
- ✅ Tab audio capture from YouTube video
- ✅ Pause/Resume functionality
- ✅ Stop recording & AI summary generation
- ✅ Session management & transcript export

---

## Testing & Quality

### Tested Scenarios
- ✅ 5-minute continuous microphone recording
- ✅ Tab audio from Google Meet call
- ✅ Pause/Resume mid-recording
- ✅ Network interruption recovery
- ✅ 1-hour marathon session 

### Code Quality
- TypeScript strict mode enabled
- ESLint + Prettier formatting
- JSDoc comments on key functions
- Prisma type safety throughout

---

## License

MIT License - See [LICENSE](LICENSE) file

---

## Author

**Ritam Pal**  
- GitHub: [@RitamPal26](https://github.com/RitamPal26)
- Email: ritamjunior26@gmail.com

Built as part of AttackCapital technical assignment (November 2025)

---

## Acknowledgments

- Google Gemini API for powerful audio transcription
- Vercel AI SDK for structured output generation
- Better Auth for authentication
- shadcn/ui for beautiful components
- AttackCapital for giving this idea