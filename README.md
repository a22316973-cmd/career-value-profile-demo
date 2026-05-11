# 104 Career Value Profile Demo

A React and Vite demo for exploring career value profiles. The app can run in mock mode for demos and can also call an OpenAI-powered backend endpoint when an API key is configured locally.

Original AI Studio app:
https://ai.studio/apps/4f6be58c-3645-48da-b99d-bb2760f77707

## Features

- Career value profile interface
- Mock mode for safe local demos
- Optional OpenAI backend route through `server.ts`
- Vite build setup for frontend preview and deployment

## Tech Stack

- React
- TypeScript
- Vite
- Express
- OpenAI SDK

## Run Locally

Prerequisite: Node.js

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` only if you want to use the OpenAI-powered mode.

3. Start the local dev server:

   ```bash
   npm run dev
   ```

By default, mock mode can be used without calling OpenAI.

## Scripts

```bash
npm run dev      # Start the local Express/Vite dev server
npm run build    # Build the frontend
npm run preview  # Preview the built frontend
npm run lint     # Type-check the project
```

## Environment Variables

Create a local `.env` file when needed:

```bash
OPENAI_API_KEY=your_api_key_here
```

Do not commit `.env` or real API keys. This repository keeps `.env.example` only.

## Deployment Notes

For a static frontend deployment, run `npm run build` and deploy the generated `dist/` output.

For OpenAI-powered mode, deploy the backend route in `server.ts` or adapt `/api/career-insight` to the hosting platform's serverless function format. Store `OPENAI_API_KEY` as an environment variable in the hosting platform.
