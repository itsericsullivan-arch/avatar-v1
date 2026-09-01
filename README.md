# Avatar V1 — Android + Render build

This build serves the mobile avatar UI and the OpenAI Realtime WebRTC session endpoint from one small Node web service.

## Included

- Android-friendly mobile UI
- Installable PWA manifest + service worker
- Everyday / Mint / Power / Cozy / Poolside look structure
- Real microphone capture via browser WebRTC
- OpenAI Realtime voice replies
- Server-side API key protection
- `/health` endpoint for Render
- `render.yaml` Blueprint configuration
- Explicit `0.0.0.0` binding for Render

## Fastest Render deployment

1. Put the contents of this `avatar-v1` folder in a GitHub, GitLab, or Bitbucket repository.
2. In Render, choose **New > Blueprint** and select that repository. Render will read `render.yaml`.
3. When prompted for `OPENAI_API_KEY`, enter your OpenAI API key as a secret.
4. Deploy the free web service.
5. Open the resulting HTTPS `onrender.com` URL in Chrome on Android.
6. Grant microphone permission.
7. Chrome menu > **Add to Home screen** / **Install app**.

The default Realtime model is `gpt-realtime-2.1` and default voice is `marin`.

## Manual Render settings (if not using Blueprint)

- Service type: Web Service
- Runtime: Node
- Plan: Free
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`
- Environment secret: `OPENAI_API_KEY`
- Optional: `OPENAI_REALTIME_MODEL=gpt-realtime-2.1`
- Optional: `OPENAI_VOICE=marin`

## Local run

```bash
export OPENAI_API_KEY="YOUR_KEY_HERE"
npm start
```

Then open `http://localhost:3000`.

## Notes

- The API key never ships to browser JavaScript.
- Render free web services may spin down after inactivity, so the first launch after a while can be slow.
- This app uses the OpenAI API and does not automatically share ChatGPT conversation history or ChatGPT Memory.
