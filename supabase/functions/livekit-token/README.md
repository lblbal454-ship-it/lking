# LiveKit token function

Deploy this Supabase Edge Function as `livekit-token`.

Required Supabase secrets:
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Frontend environment:
- `VITE_LIVEKIT_URL=wss://YOUR_PROJECT.livekit.cloud`

The browser must never receive `LIVEKIT_API_SECRET`.
