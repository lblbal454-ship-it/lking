import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Home, Compass, Plus, Radio, User, Heart, MessageCircle, Share2, Upload, LogIn, LogOut, X, BarChart3, Users, Gift, Send, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Room, RoomEvent, createLocalTracks } from "livekit-client";
import { supabase } from "./supabase";
import "./styles.css";

const livekitConfigured = Boolean(import.meta.env.VITE_LIVEKIT_URL);

async function liveToken(roomName, identity, canPublish) {
  if (!supabase) throw new Error("Supabase غير متصل.");
  const { data, error } = await supabase.functions.invoke("livekit-token", { body: { roomName, identity, canPublish } });
  if (error) throw error;
  if (!data?.token) throw new Error("لم يتم الحصول على LiveKit Token.");
  return data.token;
}

function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("home");
  const [posts, setPosts] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [liveRoom, setLiveRoom] = useState(null);
  const [studio, setStudio] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadPosts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("creator_posts").select("id,media_url,caption,views,likes,creator_id,created_at").eq("status", "published").order("created_at", { ascending: false }).limit(30);
    if (!error) setPosts(data || []);
  };

  useEffect(() => { loadPosts(); }, [session]);

  return <div className="app">
    <header><div className="logo"><b>L</b><strong>Lking</strong></div><div className="header-actions">{session ? <><button onClick={() => setStudio(true)}><BarChart3 /> Studio</button><button onClick={() => supabase?.auth.signOut()}><LogOut /></button></> : <button onClick={() => setAuthOpen(true)}><LogIn /> دخول</button>}</div></header>
    <main>{tab === "home" && <Feed posts={posts} session={session} auth={() => setAuthOpen(true)} />}{tab === "explore" && <Explore posts={posts} />}{tab === "live" && <Live session={session} auth={() => setAuthOpen(true)} open={(room) => setLiveRoom(room)} />}{tab === "create" && <Create session={session} auth={() => setAuthOpen(true)} reload={loadPosts} live={() => setTab("live")} />}{tab === "profile" && <Profile session={session} auth={() => setAuthOpen(true)} />}</main>
    <nav>{[[Home,"الرئيسية","home"],[Compass,"اكتشف","explore"],[Plus,"","create"],[Radio,"مباشر","live"],[User,"حسابي","profile"]].map(([Icon,label,target],index) => <button key={target} className={index === 2 ? `plus ${tab === target ? "active" : ""}` : tab === target ? "active" : ""} onClick={() => setTab(target)}><Icon /><small>{label}</small></button>)}</nav>
    {authOpen && <Auth close={() => setAuthOpen(false)} done={(s) => { setSession(s); setAuthOpen(false); }} />}
    {liveRoom && <LiveRoom room={liveRoom} session={session} close={() => setLiveRoom(null)} />}
    {studio && <Studio close={() => setStudio(false)} />}
  </div>;
}

function Feed({ posts, session, auth }) {
  const [index, setIndex] = useState(0); const touchStartY = useRef(null); const wheelLock = useRef(false); const post = posts.length ? posts[(index + posts.length) % posts.length] : null;
  const next = () => posts.length > 1 && setIndex((v) => v + 1); const prev = () => posts.length > 1 && setIndex((v) => v - 1);
  const onTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; }; const onTouchEnd = (e) => { if (touchStartY.current == null) return; const d = e.changedTouches[0].clientY - touchStartY.current; touchStartY.current = null; if (Math.abs(d) < 60) return; d < 0 ? next() : prev(); };
  const onWheel = (e) => { if (wheelLock.current || Math.abs(e.deltaY) < 15) return; wheelLock.current = true; e.deltaY > 0 ? next() : prev(); window.setTimeout(() => { wheelLock.current = false; }, 450); };
  const likePost = async () => { if (!session) { auth(); return; } if (supabase && post) await supabase.from("post_likes").insert({ user_id: session.user.id, post_id: post.id }); };
  return <section className="feed" onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>{post ? <article className="post"><video src={post.media_url} controls playsInline /><div className="caption"><b>@creator</b><p>{post.caption}</p></div><div className="actions"><button onClick={likePost}><Heart /><span>{post.likes || 0}</span></button><button><MessageCircle /><span>تعليقات</span></button><button><Share2 /><span>مشاركة</span></button></div><div className="feed-hint">اسحب للأعلى أو للأسفل</div></article> : <div className="empty"><h1>مرحبًا بك في Lking</h1><p>ابدأ بنشر أول فيديو وبناء جمهورك.</p></div>}</section>;
}

function Explore({ posts }) { return <section className="page"><h1>اكتشف</h1><p>اكتشف أحدث محتوى صناع Lking.</p><div className="grid">{posts.map((p) => <video key={p.id} src={p.media_url} muted playsInline controls />)}</div></section>; }

function Live({ session, auth, open }) {
  const [rooms, setRooms] = useState([]);
  useEffect(() => { if (!supabase) return; const loadRooms = async () => { const { data } = await supabase.from("live_rooms").select("*").eq("status", "live").order("started_at", { ascending: false }); setRooms(data || []); }; loadRooms(); const c = supabase.channel("live-rooms").on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, loadRooms).subscribe(); return () => supabase.removeChannel(c); }, []);
  return <section className="page"><div className="row"><div><h1>البث المباشر</h1><p>بث حقيقي عبر LiveKit مع غرفة ومشاهدين ودردشة.</p></div><button className="primary" onClick={() => session ? open("create") : auth()}><Radio /> ابدأ بثًا</button></div>{!livekitConfigured && <div className="warning">أضف VITE_LIVEKIT_URL ثم انشر Edge Function قبل تشغيل البث.</div>}{rooms.length ? <div className="room-grid">{rooms.map((r) => <button className="room" key={r.id} onClick={() => open(r)}><span>LIVE</span><Radio /><b>{r.title}</b><small>{r.viewer_count || 0} مشاهد</small></button>)}</div> : <div className="empty">لا يوجد بث مباشر الآن.<br />كن أول من يبدأ.</div>}</section>;
}

function Create({ session, auth, reload, live }) {
  const [file, setFile] = useState(null); const [caption, setCaption] = useState(""); const [message, setMessage] = useState("");
  const publish = async () => { if (!session) { auth(); return; } if (!file) { setMessage("اختر فيديو أولًا."); return; } if (!supabase) { setMessage("Supabase غير متصل."); return; } try { const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${session.user.id}/${crypto.randomUUID()}-${safe}`; const { error: ue } = await supabase.storage.from("videos").upload(path, file); if (ue) throw ue; const { data: pd } = supabase.storage.from("videos").getPublicUrl(path); const { error: pe } = await supabase.from("creator_posts").insert({ creator_id: session.user.id, media_url: pd.publicUrl, caption, status: "published" }); if (pe) throw pe; setMessage("تم نشر الفيديو بنجاح."); setFile(null); setCaption(""); await reload(); } catch (e) { setMessage(e?.message || "حدث خطأ أثناء نشر الفيديو."); } };
  return <section className="create"><div><Upload size={50} /><h1>انشر على Lking</h1><label className="picker">اختيار فيديو<input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>{file && <p>{file.name}</p>}<textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="اكتب وصف الفيديو..." /><button className="primary" onClick={publish}>نشر الفيديو</button><button onClick={live}><Radio /> بث مباشر</button>{message && <p>{message}</p>}</div></section>;
}

function Profile({ session, auth }) { return <section className="page center"><img src="/lking-logo.svg" alt="Lking" className="profile-logo" /><h1>{session ? "حسابك" : "كن صانع محتوى على Lking"}</h1><p>{session ? session.user.email : "انشر، ابنِ جمهورك وشارك في البث المباشر."}</p>{!session && <button className="primary" onClick={auth}>إنشاء حساب</button>}<div className="pitch"><Users /><div><b>برنامج صناع المحتوى</b><small>تحديات ومكافآت وفرص لتحقيق الدخل.</small></div></div></section>; }

function Auth({ close, done }) {
  const [signup, setSignup] = useState(false); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const redirectTo = `${window.location.origin}/`;
  const oauth = async (provider) => { if (!supabase) { setMessage("Supabase غير متصل."); return; } try { setLoading(true); setMessage(""); const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } }); if (error) throw error; } catch (e) { setMessage(e?.message || `تعذر تسجيل الدخول عبر ${provider}.`); setLoading(false); } };
  const submit = async () => { if (!supabase) { setMessage("Supabase غير متصل."); return; } if (!email || !password) { setMessage("أدخل البريد الإلكتروني وكلمة المرور."); return; } try { setLoading(true); const result = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password }); if (result.error) throw result.error; if (result.data.session) done(result.data.session); else setMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني."); } catch (e) { setMessage(e?.message || "حدث خطأ أثناء تسجيل الدخول."); } finally { setLoading(false); } };
  return <Modal close={close}><div className="auth-screen"><img src="/lking-logo.svg" alt="Lking" className="auth-logo" /><h2>{signup ? "إنشاء حساب" : "تسجيل الدخول"}</h2><button className="oauth google" onClick={() => oauth("google")} disabled={loading}><strong>G</strong><span>المتابعة باستخدام Google</span></button><button className="oauth apple" onClick={() => oauth("apple")} disabled={loading}><strong></strong><span>المتابعة باستخدام Apple</span></button><div className="auth-divider"><span>أو</span></div><input placeholder="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><input placeholder="كلمة المرور" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="primary auth-submit" onClick={submit} disabled={loading}>{loading ? "انتظر..." : signup ? "إنشاء الحساب" : "دخول"}</button>{message && <p className="auth-message">{message}</p>}<button className="link" onClick={() => { setSignup((v) => !v); setMessage(""); }}>{signup ? "لدي حساب" : "إنشاء حساب جديد"}</button></div></Modal>;
}

function LiveRoom({ room, session, close }) {
  const localVideo = useRef(null); const roomRef = useRef(null); const chatSub = useRef(null); const isHost = room === "create"; const [roomId, setRoomId] = useState(isHost ? null : room.id); const [started, setStarted] = useState(false); const [title, setTitle] = useState(isHost ? "بث Lking" : room.title); const [chat, setChat] = useState([]); const [message, setMessage] = useState(""); const [muted, setMuted] = useState(false); const [camera, setCamera] = useState(true); const [error, setError] = useState("");
  const connect = async () => { try { if (!supabase || !session) throw new Error("يجب تسجيل الدخول أولًا."); if (!livekitConfigured) throw new Error("VITE_LIVEKIT_URL غير مضبوط."); let id = roomId; if (isHost && !id) { const { data, error: ce } = await supabase.from("live_rooms").insert({ host_id: session.user.id, title, category: "عام", status: "live" }).select().single(); if (ce) throw ce; id = data.id; setRoomId(id); } if (!id) throw new Error("غرفة البث غير موجودة."); const token = await liveToken(id, session.user.id, isHost); const r = new Room(); roomRef.current = r; r.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === "video") { const el = track.attach(); el.className = "remote-video"; document.getElementById("remote-stage")?.appendChild(el); } }); await r.connect(import.meta.env.VITE_LIVEKIT_URL, token); if (isHost) { const tracks = await createLocalTracks({ audio: true, video: true }); for (const t of tracks) { await r.localParticipant.publishTrack(t); if (t.kind === "video" && localVideo.current) localVideo.current.srcObject = new MediaStream([t.mediaStreamTrack]); } } setStarted(true); chatSub.current = supabase.channel(`chat-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat", filter: `room_id=eq.${id}` }, (p) => setChat((x) => [...x, p.new])).subscribe(); } catch (e) { setError(e?.message || "فشل الاتصال بالبث."); } };
  const stop = async () => { try { if (isHost && roomId && supabase) await supabase.from("live_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", roomId); if (chatSub.current && supabase) await supabase.removeChannel(chatSub.current); if (roomRef.current) await roomRef.current.disconnect(); } finally { close(); } };
  const sendMessage = async () => { if (!message.trim() || !roomId || !session || !supabase) return; const { error: se } = await supabase.from("live_chat").insert({ room_id: roomId, user_id: session.user.id, message: message.trim() }); if (!se) setMessage(""); };
  const toggleMic = async () => { const next = !muted; await roomRef.current?.localParticipant.setMicrophoneEnabled(!next); setMuted(next); }; const toggleCamera = async () => { const next = !camera; await roomRef.current?.localParticipant.setCameraEnabled(next); setCamera(next); };
  return <Modal close={stop}><div className="live-room"><div className="stage" id="remote-stage">{isHost && <video ref={localVideo} autoPlay muted playsInline className="camera" />}{!started && <div className="start-card"><Radio size={45} /><h2>{isHost ? "ابدأ بثك الآن" : "انضم إلى البث"}</h2>{isHost && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان البث" />}<button className="primary" onClick={connect}>{isHost ? "تشغيل الكاميرا والمايك" : "دخول البث"}</button></div>}</div>{started && <div className="live-controls"><button onClick={toggleMic}>{muted ? <MicOff /> : <Mic />}</button><button onClick={toggleCamera}>{camera ? <Video /> : <VideoOff />}</button><b>● LIVE</b><button className="end" onClick={stop}>{isHost ? "إنهاء البث" : "خروج"}</button></div>}<div className="chat"><div>{chat.map((m) => <p key={m.id}><b>{m.user_id.slice(0,6)}</b> {m.message}</p>)}</div>{started && <div className="chat-send"><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="اكتب تعليقًا..." /><button onClick={sendMessage}><Send /></button></div>}</div>{error && <p className="error">{error}</p>}</div></Modal>;
}

function Studio({ close }) { return <Modal close={close}><h2>Creator Studio</h2><div className="stats"><div><BarChart3 /><b>0</b><small>مشاهدات</small></div><div><Users /><b>0</b><small>متابعون</small></div><div><Gift /><b>500</b><small>مكافآت البداية</small></div></div><div className="studio-box"><b>برنامج صناع المحتوى</b><p>انشر باستمرار، ادخل التحديات، وابنِ جمهورك.</p></div></Modal>; }
function Modal({ children, close }) { return <div className="modal"><div className="modal-box"><button className="close" onClick={close}><X /></button>{children}</div></div>; }

createRoot(document.getElementById("root")).render(<App />);
