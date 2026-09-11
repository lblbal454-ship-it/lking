import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Home, Compass, Plus, Radio, User, Heart, MessageCircle, Share2, Upload, LogIn, LogOut, X, BarChart3, Users, Gift, Send, Mic, MicOff, Video, VideoOff, Search, Bookmark, MoreHorizontal, Volume2, VolumeX, Bell, Settings, Grid3X3, Film, Lock, UserPlus, UserCheck, Music2, ChevronRight, Flag, Download, ImagePlus } from "lucide-react";
import { Room, RoomEvent, createLocalTracks } from "livekit-client";
import { supabase } from "./supabase";
import "./styles.css";

const livekitConfigured = Boolean(import.meta.env.VITE_LIVEKIT_URL);
const APP_URL = "https://lking.vercel.app/";

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
  const [feedMode, setFeedMode] = useState("forYou");
  const [posts, setPosts] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [liveRoom, setLiveRoom] = useState(null);
  const [studio, setStudio] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data?.session || null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (active) setSession(nextSession || null); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const loadPosts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("creator_posts").select("id,media_url,caption,views,likes,creator_id,created_at").eq("status", "published").order("created_at", { ascending: false }).limit(50);
    if (!error) setPosts(data || []);
  };
  useEffect(() => { loadPosts(); }, [session]);

  return <div className="app">
    <header>
      <button className="brand" onClick={() => setTab("home")}><span className="brand-mark">L</span><span className="brand-name">Lking</span></button>
      {tab === "home" && <div className="feed-tabs"><button className={feedMode === "forYou" ? "active" : ""} onClick={() => setFeedMode("forYou")}>لك</button><button className={feedMode === "following" ? "active" : ""} onClick={() => setFeedMode("following")}>أتابع</button></div>}
      <div className="top-actions"><button onClick={() => setSearchOpen(true)}><Search/></button><button onClick={() => setInboxOpen(true)}><Bell/></button>{session ? <button className="mini-avatar" onClick={() => setTab("profile")}>L</button> : <button className="login-top" onClick={() => setAuthOpen(true)}><LogIn/> دخول</button>}</div>
    </header>

    <main className="content">
      {tab === "home" && <ShortsFeed posts={posts} session={session} auth={() => setAuthOpen(true)} mode={feedMode}/>} 
      {tab === "explore" && <Explore posts={posts}/>} 
      {tab === "create" && <Create session={session} auth={() => setAuthOpen(true)} reload={loadPosts} live={() => setTab("live")}/>} 
      {tab === "live" && <Live session={session} auth={() => setAuthOpen(true)} open={setLiveRoom}/>} 
      {tab === "inbox" && <Inbox session={session} auth={() => setAuthOpen(true)}/>} 
      {tab === "profile" && <Profile session={session} auth={() => setAuthOpen(true)} posts={posts}/>} 
    </main>

    <nav className="bottom-nav">
      <NavButton active={tab === "home"} label="الرئيسية" icon={Home} onClick={() => setTab("home")}/>
      <NavButton active={tab === "explore"} label="اكتشف" icon={Compass} onClick={() => setTab("explore")}/>
      <button className="create-fab" onClick={() => setTab("create")}><span><Plus/></span></button>
      <NavButton active={tab === "live"} label="مباشر" icon={Radio} onClick={() => setTab("live")}/>
      <NavButton active={tab === "profile"} label="حسابي" icon={User} onClick={() => setTab("profile")}/>
    </nav>

    {authOpen && <Auth close={() => setAuthOpen(false)} done={(s) => { setSession(s); setAuthOpen(false); }}/>} 
    {searchOpen && <SearchModal posts={posts} close={() => setSearchOpen(false)} openProfile={() => { setSearchOpen(false); setTab("profile"); }}/>} 
    {inboxOpen && <InboxQuick close={() => setInboxOpen(false)} open={() => { setInboxOpen(false); setTab("inbox"); }}/>} 
    {liveRoom && <LiveRoom room={liveRoom} session={session} close={() => setLiveRoom(null)}/>} 
    {studio && <Studio close={() => setStudio(false)}/>} 
  </div>;
}

function NavButton({ active, label, icon: Icon, onClick }) { return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon/><small>{label}</small></button>; }

function ShortsFeed({ posts, session, auth, mode }) {
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [followed, setFollowed] = useState({});
  const [muted, setMuted] = useState(true);
  const [comments, setComments] = useState(null);
  const [share, setShare] = useState(null);
  const touchStart = useRef(null);
  const lock = useRef(false);
  const post = useMemo(() => posts.length ? posts[(index + posts.length) % posts.length] : null, [posts, index]);
  const next = () => posts.length > 1 && setIndex(v => v + 1);
  const prev = () => posts.length > 1 && setIndex(v => v - 1);
  const wheel = (e) => { if (lock.current || Math.abs(e.deltaY) < 18) return; lock.current = true; e.deltaY > 0 ? next() : prev(); setTimeout(() => { lock.current = false; }, 450); };
  const touchEnd = (e) => { if (touchStart.current == null) return; const d = e.changedTouches[0].clientY - touchStart.current; touchStart.current = null; if (Math.abs(d) < 60) return; d < 0 ? next() : prev(); };
  const toggleLike = async () => { if (!post) return; if (!session) { auth(); return; } setLiked(x => ({ ...x, [post.id]: !x[post.id] })); await supabase?.from("post_likes").insert({ user_id: session.user.id, post_id: post.id }); };
  const sharePost = async () => { if (!post) return; const url = `${APP_URL}?video=${encodeURIComponent(post.id)}`; try { if (navigator.share) await navigator.share({ title: "Lking", text: post.caption || "شاهد هذا الفيديو على Lking", url }); else await navigator.clipboard?.writeText(url); } catch {} setShare(post); };
  return <section className="shorts-feed" onWheel={wheel} onTouchStart={e => { touchStart.current = e.touches[0].clientY; }} onTouchEnd={touchEnd}>
    {post ? <article className="video-card">
      <video className="short-video" src={post.media_url} autoPlay loop muted={muted} playsInline onClick={e => { e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause(); }}/>
      <div className="video-shade"/>
      <button className="sound-toggle" onClick={() => setMuted(v => !v)}>{muted ? <VolumeX/> : <Volume2/>}</button>
      <div className="creator-info"><div className="creator-line"><div className="creator-avatar">L</div><b>@lking.creator</b><button className="follow-btn" onClick={() => setFollowed(x => ({ ...x, [post.creator_id]: !x[post.creator_id] }))}>{followed[post.creator_id] ? <><UserCheck/> متابع</> : <><UserPlus/> متابعة</>}</button></div><p>{post.caption || "فيديو جديد على Lking"}</p><div className="music-line"><Music2 size={14}/> الصوت الأصلي · Lking</div></div>
      <div className="side-actions"><button className={`video-action ${liked[post.id] ? "active" : ""}`} onClick={toggleLike}><span className="action-icon"><Heart/></span><span>{(post.likes || 0) + (liked[post.id] ? 1 : 0)}</span></button><button className="video-action" onClick={() => setComments(post)}><span className="action-icon"><MessageCircle/></span><span>تعليقات</span></button><button className={`video-action ${saved[post.id] ? "active" : ""}`} onClick={() => setSaved(x => ({ ...x, [post.id]: !x[post.id] }))}><span className="action-icon"><Bookmark/></span><span>حفظ</span></button><button className="video-action" onClick={sharePost}><span className="action-icon"><Share2/></span><span>مشاركة</span></button><button className="video-action"><span className="action-icon"><MoreHorizontal/></span><span>المزيد</span></button></div>
      <div className="video-progress"/><div className="swipe-label">اسحب للأعلى</div>
    </article> : <div className="feed-empty"><ImagePlus size={54}/><h2>{mode === "following" ? "لا توجد حسابات أتابعها بعد" : "مرحبًا بك في Lking"}</h2><p>انشر أول فيديو وابدأ ببناء جمهورك.</p></div>}
    {comments && <CommentsModal close={() => setComments(null)}/>} {share && <ShareModal close={() => setShare(null)}/>} 
  </section>;
}

function Explore({ posts }) {
  const [query, setQuery] = useState("");
  const cats = ["لك", "ألعاب", "كوميديا", "موسيقى", "رياضة", "تقنية", "ترند"];
  const filtered = posts.filter(p => !query || (p.caption || "").toLowerCase().includes(query.toLowerCase()));
  return <section className="explore-page"><div className="explore-search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث في Lking"/></div><div className="explore-head"><div><h1>اكتشف</h1><p>فيديوهات رائجة وصناع محتوى وبث مباشر.</p></div><button className="filter-btn"><Compass/> الفئات</button></div><div className="category-row">{cats.map((c,i) => <button key={c} className={i===0 ? "active" : ""}>{c}</button>)}</div>{filtered.length ? <div className="discover-grid">{filtered.map(p => <button className="discover-card" key={p.id}><video src={p.media_url} muted playsInline/><div><b>{p.caption || "فيديو على Lking"}</b><small><Heart size={13}/> {p.likes || 0} · {p.views || 0} مشاهدة</small></div></button>)}</div> : <div className="empty-box"><Search/><p>لا توجد نتائج.</p></div>}</section>;
}

function Create({ session, auth, reload, live }) {
  const [file, setFile] = useState(null), [caption, setCaption] = useState(""), [message, setMessage] = useState(""), [preview, setPreview] = useState("");
  useEffect(() => { if (!file) return setPreview(""); const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);
  const publish = async () => { if (!session) return auth(); if (!file) return setMessage("اختر فيديو أولًا."); if (!supabase) return setMessage("Supabase غير متصل."); try { const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${session.user.id}/${crypto.randomUUID()}-${safe}`; const { error: ue } = await supabase.storage.from("videos").upload(path, file); if (ue) throw ue; const { data: pd } = supabase.storage.from("videos").getPublicUrl(path); const { error: pe } = await supabase.from("creator_posts").insert({ creator_id: session.user.id, media_url: pd.publicUrl, caption, status: "published" }); if (pe) throw pe; setMessage("تم نشر الفيديو بنجاح."); setFile(null); setCaption(""); await reload(); } catch (e) { setMessage(e?.message || "حدث خطأ أثناء النشر."); } };
  return <section className="create-page"><div className="create-layout"><div className="create-preview">{preview ? <video src={preview} autoPlay loop muted playsInline/> : <><Upload size={45}/><span>معاينة الفيديو</span></>}</div><div className="create-panel"><div className="create-top"><h1>إنشاء فيديو</h1><button onClick={live}><Radio/> بث مباشر</button></div><label className="upload-box"><Upload/><span>رفع فيديو</span><small>MP4 أو WebM · فيديو عمودي يفضل 9:16</small><input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)}/></label>{file && <p className="form-message">{file.name}</p>}<textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="اكتب وصفًا للفيديو، أضف #هاشتاغ..."/><div className="create-options"><button><Users/> من يمكنه المشاهدة: الجميع <ChevronRight/></button><button><MessageCircle/> السماح بالتعليقات <ChevronRight/></button><button><Download/> حفظ على الجهاز <ChevronRight/></button></div><div className="create-actions"><button className="secondary-btn">مسودة</button><button className="primary" onClick={publish}>نشر الفيديو</button></div>{message && <p className="form-message">{message}</p>}</div></div></section>;
}

function Live({ session, auth, open }) {
  const [rooms, setRooms] = useState([]);
  useEffect(() => { if (!supabase) return; const load = async () => { const { data } = await supabase.from("live_rooms").select("*").eq("status", "live").order("started_at", { ascending: false }); setRooms(data || []); }; load(); const c = supabase.channel("live-rooms").on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, load).subscribe(); return () => supabase.removeChannel(c); }, []);
  return <section className="live-page"><div className="live-hero"><div><div className="live-pill"><span/> مباشر الآن</div><h1>البث المباشر</h1><p>شاهد صناع Lking وتفاعل معهم في الوقت الحقيقي.</p></div><button className="primary" onClick={() => session ? open("create") : auth()}><Radio/> ابدأ بثًا</button></div>{!livekitConfigured && <div className="warning">البث يحتاج إعداد LiveKit في Vercel.</div>}{rooms.length ? <div className="live-grid">{rooms.map(r => <button className="live-card" key={r.id} onClick={() => open(r)}><div className="live-thumb"><Radio/><span>LIVE</span></div><div className="live-card-info"><b>{r.title}</b><small>{r.viewer_count || 0} مشاهد</small></div></button>)}</div> : <div className="empty-box"><Radio/><p>لا يوجد بث مباشر الآن. كن أول من يبدأ.</p></div>}</section>;
}

function Inbox({ session, auth }) { if (!session) return <section className="inbox-page"><div className="empty-box"><Bell/><h2>سجّل الدخول لعرض الوارد</h2><button className="primary" onClick={auth}>دخول</button></div></section>; return <section className="inbox-page"><h1>الوارد</h1><div className="inbox-tabs"><button className="active">النشاط</button><button>الرسائل</button></div><div className="inbox-row"><div className="inbox-icon"><Heart/></div><div><b>الإعجابات</b><p>ستظهر هنا الإعجابات الجديدة على فيديوهاتك.</p></div><small>الآن</small></div><div className="inbox-row"><div className="inbox-icon"><UserPlus/></div><div><b>المتابعون</b><p>متابعون جدد وتفاعلات مع حسابك.</p></div><small>اليوم</small></div><div className="message-card"><div className="chat-avatar">L</div><div><b>رسائل Lking</b><p>ابدأ المحادثات مع صناع المحتوى.</p></div><MessageCircle/></div></section>; }

function Profile({ session, auth, posts }) {
  const [profileTab, setProfileTab] = useState("videos"); const [following, setFollowing] = useState(false);
  if (!session) return <section className="profile-page guest"><div className="profile-cover"><div className="cover-glow"/></div><div className="profile-main"><div className="big-avatar">L</div><h1>أنشئ حسابك على Lking</h1><p className="handle">شارك، تابع، وابنِ مجتمعك.</p><button className="primary" onClick={auth}>تسجيل الدخول</button><div className="empty-profile"><User/><p>سجّل الدخول للوصول إلى ملفك الشخصي والفيديوهات المحفوظة.</p></div></div></section>;
  return <section className="profile-page"><div className="profile-cover"><div className="cover-glow"/></div><div className="profile-main"><div className="profile-head"><div className="big-avatar">L</div><div className="profile-actions"><button className="profile-btn" onClick={() => setFollowing(v => !v)}>{following ? <UserCheck/> : <UserPlus/>}{following ? "متابع" : "متابعة"}</button><button className="icon-btn"><Settings/></button></div></div><h1>Lking Creator</h1><div className="handle">@{session.user.email?.split("@")[0] || "creator"}</div><div className="profile-stats"><div><b>{posts.length}</b><span>فيديو</span></div><div><b>0</b><span>متابع</span></div><div><b>0</b><span>أتابع</span></div><div><b>0</b><span>إعجاب</span></div></div><p className="profile-bio">صانع محتوى على Lking · ألعاب · ترفيه · بث مباشر</p><div className="profile-tabs"><button className={profileTab === "videos" ? "active" : ""} onClick={() => setProfileTab("videos")}><Grid3X3/> الفيديوهات</button><button className={profileTab === "liked" ? "active" : ""} onClick={() => setProfileTab("liked")}><Heart/> أعجبتني</button><button className={profileTab === "saved" ? "active" : ""} onClick={() => setProfileTab("saved")}><Bookmark/> المحفوظ</button></div>{profileTab === "videos" ? <div className="profile-grid">{posts.length ? <div className="discover-grid">{posts.map(p => <button className="discover-card" key={p.id}><video src={p.media_url} muted playsInline/><div><b>{p.caption || "فيديو"}</b></div></button>)}</div> : <div className="empty-profile"><Film/><p>لم تنشر أي فيديو بعد.</p></div>}</div> : <div className="empty-profile"><Lock/><p>هذا القسم لا يحتوي على محتوى بعد.</p></div>}<button className="secondary-btn full" onClick={() => supabase?.auth.signOut()}><LogOut/> تسجيل الخروج</button></div></section>;
}

function Auth({ close, done }) {
  const [signup, setSignup] = useState(false); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const oauth = async () => { if (!supabase) return setMessage("Supabase غير متصل."); try { setLoading(true); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: APP_URL } }); if (error) throw error; } catch (e) { setMessage(e?.message || "تعذر تسجيل الدخول."); setLoading(false); } };
  const submit = async () => { if (!supabase) return setMessage("Supabase غير متصل."); if (!email || !password) return setMessage("أدخل البريد الإلكتروني وكلمة المرور."); try { setLoading(true); const r = signup ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: APP_URL } }) : await supabase.auth.signInWithPassword({ email, password }); if (r.error) throw r.error; if (r.data.session) done(r.data.session); else setMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني."); } catch (e) { setMessage(e?.message || "حدث خطأ."); } finally { setLoading(false); } };
  return <Modal close={close}><div className="auth-screen"><div className="auth-logo"><img src="/lking-logo.svg" alt="Lking"/></div><h2>{signup ? "إنشاء حساب" : "تسجيل الدخول"}</h2><button className="oauth google" onClick={oauth} disabled={loading}><strong>G</strong><span>المتابعة باستخدام Google</span></button><div className="auth-divider"><span>أو</span></div><input placeholder="البريد الإلكتروني" type="email" value={email} onChange={e => setEmail(e.target.value)}/><input placeholder="كلمة المرور" type="password" value={password} onChange={e => setPassword(e.target.value)}/><button className="primary auth-submit" onClick={submit} disabled={loading}>{loading ? "انتظر..." : signup ? "إنشاء الحساب" : "دخول"}</button>{message && <p className="auth-message">{message}</p>}<button className="link" onClick={() => { setSignup(v => !v); setMessage(""); }}>{signup ? "لدي حساب" : "إنشاء حساب جديد"}</button></div></Modal>;
}

function SearchModal({ posts, close, openProfile }) { const [q, setQ] = useState(""); const results = posts.filter(p => (p.caption || "").toLowerCase().includes(q.toLowerCase())); return <Modal close={close}><div className="search-modal"><h2>بحث</h2><div className="explore-search"><Search/><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="اكتب اسمًا أو موضوعًا"/></div><div className="category-row"><button className="active">الأفضل</button><button>الأشخاص</button><button>الفيديوهات</button><button>الأصوات</button></div>{results.slice(0,8).map(p => <button className="message-card" key={p.id} onClick={openProfile}><div className="chat-avatar">L</div><div><b>{p.caption || "فيديو Lking"}</b><p>@lking.creator · فيديو</p></div><ChevronRight/></button>)}</div></Modal>; }
function InboxQuick({ close, open }) { return <Modal close={close}><div className="search-modal"><h2>الإشعارات</h2><div className="inbox-row"><div className="inbox-icon"><Heart/></div><div><b>التفاعل</b><p>آخر نشاط وإعجاباتك.</p></div></div><div className="inbox-row"><div className="inbox-icon"><MessageCircle/></div><div><b>الرسائل</b><p>ابدأ محادثة على Lking.</p></div></div><button className="primary full" onClick={open}>فتح الوارد الكامل</button></div></Modal>; }
function CommentsModal({ close }) { const [text, setText] = useState(""); const [comments, setComments] = useState(["فيديو رائع!", "محتوى جميل!"]); const add = () => { if (!text.trim()) return; setComments(x => [...x, text.trim()]); setText(""); }; return <Modal close={close}><div className="search-modal"><h2>التعليقات</h2><div className="comment-list">{comments.map((c,i) => <div className="inbox-row" key={i}><div className="comment-avatar">L</div><div><b>@user{i+1}</b><p>{c}</p></div></div>)}</div><div className="chat-send"><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="أضف تعليقًا..."/><button onClick={add}><Send/></button></div></div></Modal>; }
function ShareModal({ close }) { return <Modal close={close}><div className="search-modal"><h2>مشاركة الفيديو</h2><button className="message-card"><Share2/><div><b>نسخ الرابط</b><p>شارك رابط الفيديو مع أصدقائك.</p></div></button><button className="message-card"><Users/><div><b>الأصدقاء</b><p>أرسل إلى الأشخاص الذين تتابعهم.</p></div></button><button className="message-card"><Flag/><div><b>إبلاغ</b><p>أبلغ عن مشكلة في هذا الفيديو.</p></div></button></div></Modal>; }

function LiveRoom({ room, session, close }) {
  const localVideo = useRef(null), roomRef = useRef(null), chatSub = useRef(null); const isHost = room === "create"; const [roomId, setRoomId] = useState(isHost ? null : room.id); const [started, setStarted] = useState(false), [title, setTitle] = useState(isHost ? "بث Lking" : room.title), [chat, setChat] = useState([]), [message, setMessage] = useState(""), [muted, setMuted] = useState(false), [camera, setCamera] = useState(true), [error, setError] = useState("");
  const connect = async () => { try { if (!supabase || !session) throw new Error("يجب تسجيل الدخول أولًا."); if (!livekitConfigured) throw new Error("VITE_LIVEKIT_URL غير مضبوط."); let id = roomId; if (isHost && !id) { const { data, error: ce } = await supabase.from("live_rooms").insert({ host_id: session.user.id, title, category: "عام", status: "live" }).select().single(); if (ce) throw ce; id = data.id; setRoomId(id); } if (!id) throw new Error("غرفة البث غير موجودة."); const token = await liveToken(id, session.user.id, isHost); const r = new Room(); roomRef.current = r; r.on(RoomEvent.TrackSubscribed, track => { if (track.kind === "video") { const el = track.attach(); el.className = "remote-video"; document.getElementById("remote-stage")?.appendChild(el); } }); await r.connect(import.meta.env.VITE_LIVEKIT_URL, token); if (isHost) { const tracks = await createLocalTracks({ audio: true, video: true }); for (const t of tracks) { await r.localParticipant.publishTrack(t); if (t.kind === "video" && localVideo.current) localVideo.current.srcObject = new MediaStream([t.mediaStreamTrack]); } } setStarted(true); chatSub.current = supabase.channel(`chat-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat", filter: `room_id=eq.${id}` }, p => setChat(x => [...x, p.new])).subscribe(); } catch (e) { setError(e?.message || "فشل الاتصال بالبث."); } };
  const stop = async () => { try { if (isHost && roomId && supabase) await supabase.from("live_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", roomId); if (chatSub.current && supabase) await supabase.removeChannel(chatSub.current); if (roomRef.current) await roomRef.current.disconnect(); } finally { close(); } };
  const sendMessage = async () => { if (!message.trim() || !roomId || !session || !supabase) return; const { error: se } = await supabase.from("live_chat").insert({ room_id: roomId, user_id: session.user.id, message: message.trim() }); if (!se) setMessage(""); };
  const toggleMic = async () => { const next = !muted; await roomRef.current?.localParticipant.setMicrophoneEnabled(!next); setMuted(next); }; const toggleCamera = async () => { const next = !camera; await roomRef.current?.localParticipant.setCameraEnabled(next); setCamera(next); };
  return <Modal close={stop}><div className="live-room"><div className="stage" id="remote-stage">{isHost && <video ref={localVideo} autoPlay muted playsInline className="camera"/>}{!started && <div className="start-card"><Radio size={45}/><h2>{isHost ? "ابدأ بثك الآن" : "انضم إلى البث"}</h2>{isHost && <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان البث"/>}<button className="primary" onClick={connect}>{isHost ? "تشغيل الكاميرا والمايك" : "دخول البث"}</button></div>}</div>{started && <div className="live-controls"><button onClick={toggleMic}>{muted ? <MicOff/> : <Mic/>}</button><button onClick={toggleCamera}>{camera ? <Video/> : <VideoOff/>}</button><b>● LIVE</b><button className="end" onClick={stop}>{isHost ? "إنهاء البث" : "خروج"}</button></div>}<div className="chat"><div>{chat.map(m => <p key={m.id}><b>{m.user_id.slice(0,6)}</b> {m.message}</p>)}</div>{started && <div className="chat-send"><input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="اكتب تعليقًا..."/><button onClick={sendMessage}><Send/></button></div>}</div>{error && <p className="error">{error}</p>}</div></Modal>;
}
function Studio({ close }) { return <Modal close={close}><h2>Creator Studio</h2><div className="stats"><div><BarChart3/><b>0</b><small>مشاهدات</small></div><div><Users/><b>0</b><small>متابعون</small></div><div><Gift/><b>500</b><small>مكافآت</small></div></div><div className="studio-box"><b>برنامج صناع المحتوى</b><p>انشر باستمرار، ادخل التحديات وابنِ جمهورك.</p></div></Modal>; }
function Modal({ children, close }) { return <div className="modal"><div className="modal-box"><button className="close" onClick={close}><X/></button>{children}</div></div>; }

createRoot(document.getElementById("root")).render(<App/>);
