# إعداد Lking LIVE الحقيقي

## 1. LiveKit
أنشئ مشروع LiveKit Cloud أو شغّل LiveKit SFU مستضافًا ذاتيًا.

## 2. Supabase
فعّل Auth وDatabase وRealtime، ثم نفّذ جداول `live_rooms` و`live_chat` الموجودة في ملفات SQL بالمشروع.

## 3. Edge Function
انشر `supabase/functions/livekit-token/index.ts` باسم `livekit-token`.

ضع الأسرار على Supabase فقط:
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET

## 4. Frontend
ضع في `.env`:
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_LIVEKIT_URL=wss://...

## 5. النشر
`npm install`
`npm run build`

## ملاحظة
هذه البنية تستخدم LiveKit كـSFU، لذلك المشاهدون لا يعتمدون على اتصال mesh بين كل الأجهزة. يلزم تشغيل LiveKit وSupabase فعليًا قبل أن يصبح البث متاحًا على الإنترنت.
