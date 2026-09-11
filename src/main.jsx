import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home,
  Compass,
  Plus,
  Radio,
  User,
  Heart,
  MessageCircle,
  Share2,
  Upload,
  LogIn,
  LogOut,
  X,
  BarChart3,
  Users,
  Gift,
  Send,
  Mic,
  MicOff,
  Video,
  VideoOff
} from 'lucide-react';

import {
  Room,
  RoomEvent,
  createLocalTracks
} from 'livekit-client';

import { supabase } from './supabase';
import './styles.css';

const livekitConfigured = Boolean(
  import.meta.env.VITE_LIVEKIT_URL
);

async function liveToken(roomName, identity, canPublish) {
  if (!supabase) {
    throw new Error('Supabase غير متصل.');
  }

  const { data, error } = await supabase.functions.invoke(
    'livekit-token',
    {
      body: {
        roomName,
        identity,
        canPublish
      }
    }
  );

  if (error) {
    throw error;
  }

  if (!data?.token) {
    throw new Error('لم يتم الحصول على LiveKit token.');
  }

  return data.token;
}

/* =========================
   APP
========================= */

function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('home');
  const [posts, setPosts] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [liveRoom, setLiveRoom] = useState(null);
  const [studio, setStudio] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data?.session || null);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadPosts = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('creator_posts')
      .select(
        'id,media_url,caption,views,likes,comments,creator_id'
      )
      .eq('status', 'published')
      .order('created_at', {
        ascending: false
      })
      .limit(30);

    if (error) {
      console.error('Posts error:', error);
      return;
    }

    setPosts(data || []);
  };

  useEffect(() => {
    loadPosts();
  }, [session]);

  return (
    <div className="app">

      <header>
        <div className="logo">
          <b>L</b>
          <strong>Lking</strong>
        </div>

        <div className="header-actions">
          {session ? (
            <>
              <button onClick={() => setStudio(true)}>
                <BarChart3 />
                Studio
              </button>

              <button
                onClick={() => supabase?.auth.signOut()}
                title="تسجيل الخروج"
              >
                <LogOut />
              </button>
            </>
          ) : (
            <button onClick={() => setAuthOpen(true)}>
              <LogIn />
              دخول
            </button>
          )}
        </div>
      </header>

      <main>
        {tab === 'home' && (
          <Feed
            posts={posts}
            session={session}
            auth={() => setAuthOpen(true)}
          />
        )}

        {tab === 'explore' && (
          <Explore posts={posts} />
        )}

        {tab === 'live' && (
          <Live
            session={session}
            auth={() => setAuthOpen(true)}
            open={(room) => setLiveRoom(room)}
          />
        )}

        {tab === 'create' && (
          <Create
            session={session}
            auth={() => setAuthOpen(true)}
            reload={loadPosts}
            live={() => setTab('live')}
          />
        )}

        {tab === 'profile' && (
          <Profile
            session={session}
            auth={() => setAuthOpen(true)}
          />
        )}
      </main>

      <nav>
        {[
          [Home, 'الرئيسية', 'home'],
          [Compass, 'اكتشف', 'explore'],
          [Plus, '', 'create'],
          [Radio, 'مباشر', 'live'],
          [User, 'حسابي', 'profile']
        ].map(([Icon, label, target], index) => (
          <button
            key={target}
            className={
              index === 2
                ? `plus ${tab === target ? 'active' : ''}`
                : tab === target
                  ? 'active'
                  : ''
            }
            onClick={() => setTab(target)}
          >
            <Icon />
            <small>{label}</small>
          </button>
        ))}
      </nav>

      {authOpen && (
        <Auth
          close={() => setAuthOpen(false)}
          done={(newSession) => {
            setSession(newSession);
            setAuthOpen(false);
          }}
        />
      )}

      {liveRoom && (
        <LiveRoom
          room={liveRoom}
          session={session}
          close={() => setLiveRoom(null)}
        />
      )}

      {studio && (
        <Studio
          close={() => setStudio(false)}
        />
      )}

    </div>
  );
}

/* =========================
   FEED
========================= */

function Feed({ posts, session, auth }) {
  const [index, setIndex] = useState(0);

  const post =
    posts.length > 0
      ? posts[index % posts.length]
      : null;

  const likePost = async () => {
    if (!session) {
      auth();
      return;
    }

    if (!supabase || !post) return;

    const { error } = await supabase
      .from('post_likes')
      .insert({
        user_id: session.user.id,
        post_id: post.id
      });

    if (error) {
      console.error('Like error:', error);
    }
  };

  return (
    <section
      className="feed"
      onWheel={(event) => {
        if (event.deltaY > 15 && posts.length > 1) {
          setIndex((value) => value + 1);
        }
      }}
    >

      {post ? (
        <article className="post">

          <video
            src={post.media_url}
            controls
            playsInline
          />

          <div className="caption">
            <b>@creator</b>
            <p>{post.caption}</p>
          </div>

          <div className="actions">

            <button onClick={likePost}>
              <Heart />
              <span>{post.likes || 0}</span>
            </button>

            <button>
              <MessageCircle />
              <span>تعليقات</span>
            </button>

            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    window.location.href
                  );
                } catch {
                  // Clipboard may be blocked by browser.
                }
              }}
            >
              <Share2 />
              <span>مشاركة</span>
            </button>

          </div>

        </article>
      ) : (
        <div className="empty">
          <h1>مرحبًا بك في Lking</h1>
          <p>
            ابدأ بنشر أول فيديو وبناء جمهورك.
          </p>
        </div>
      )}

    </section>
  );
}

/* =========================
   EXPLORE
========================= */

function Explore({ posts }) {
  return (
    <section className="page">

      <h1>اكتشف</h1>

      <p>
        اكتشف أحدث محتوى صناع Lking.
      </p>

      <div className="grid">

        {posts.map((post) => (
          <video
            key={post.id}
            src={post.media_url}
            muted
            playsInline
            controls
          />
        ))}

      </div>

    </section>
  );
}

/* =========================
   LIVE LIST
========================= */

function Live({ session, auth, open }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const getRooms = async () => {
      const { data, error } = await supabase
        .from('live_rooms')
        .select('*')
        .eq('status', 'live')
        .order('started_at', {
          ascending: false
        });

      if (error) {
        console.error('Live rooms error:', error);
      }

      if (mounted) {
        setRooms(data || []);
        setLoading(false);
      }
    };

    getRooms();

    const channel = supabase
      .channel('lking-live-rooms')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_rooms'
        },
        () => {
          getRooms();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="page">

      <div className="row">

        <div>
          <h1>البث المباشر</h1>

          <p>
            بث حقيقي عبر LiveKit مع غرفة ومشاهدين ودردشة.
          </p>
        </div>

        <button
          className="primary"
          onClick={() => {
            if (session) {
              open('create');
            } else {
              auth();
            }
          }}
        >
          <Radio />
          ابدأ بثًا
        </button>

      </div>

      {!livekitConfigured && (
        <div className="warning">
          أضف VITE_LIVEKIT_URL في Vercel ثم أعد النشر.
        </div>
      )}

      {loading ? (
        <div className="empty">
          جاري تحميل البث...
        </div>
      ) : rooms.length > 0 ? (

        <div className="room-grid">

          {rooms.map((room) => (
            <button
              className="room"
              key={room.id}
              onClick={() => open(room)}
            >

              <span>LIVE</span>

              <Radio />

              <b>{room.title}</b>

              <small>
                {room.viewer_count || 0} مشاهد
              </small>

            </button>
          ))}

        </div>

      ) : (

        <div className="empty">
          لا يوجد بث مباشر الآن.
          كن أول من يبدأ.
        </div>

      )}

    </section>
  );
}

/* =========================
   CREATE POST
========================= */

function Create({
  session,
  auth,
  reload,
  live
}) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  const publish = async () => {
    if (!session) {
      auth();
      return;
    }

    if (!supabase) {
      setMessage('Supabase غير متصل.');
      return;
    }

    if (!file) {
      setMessage('اختر فيديو أولًا.');
      return;
    }

    try {
      setUploading(true);
      setMessage('');

      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      const path =
        `${session.user.id}/` +
        `${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } =
        await supabase.storage
          .from('videos')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false
          });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: publicData
      } = supabase.storage
        .from('videos')
        .getPublicUrl(path);

      const { error: postError } =
        await supabase
          .from('creator_posts')
          .insert({
            creator_id: session.user.id,
            media_url: publicData.publicUrl,
            caption,
            status: 'published'
          });

      if (postError) {
        throw postError;
      }

      setMessage('تم نشر الفيديو بنجاح.');

      setFile(null);
      setCaption('');

      await reload();

    } catch (error) {
      console.error(error);

      setMessage(
        error?.message ||
        'حدث خطأ أثناء نشر الفيديو.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="create">

      <div>

        <Upload size={50} />

        <h1>انشر على Lking</h1>

        <label className="picker">

          اختيار فيديو

          <input
            type="file"
            accept="video/*"
            onChange={(event) => {
              setFile(
                event.target.files?.[0] || null
              );
            }}
          />

        </label>

        {file && (
          <p>
            الملف المختار: {file.name}
          </p>
        )}

        <textarea
          value={caption}
          onChange={(event) =>
            setCaption(event.target.value)
          }
          placeholder="اكتب وصف الفيديو..."
        />

        <button
          className="primary"
          onClick={publish}
          disabled={uploading}
        >
          {uploading
            ? 'جاري النشر...'
            : 'نشر الفيديو'}
        </button>

        <button onClick={live}>
          <Radio />
          بث مباشر
        </button>

        {message && (
          <p>{message}</p>
        )}

      </div>

    </section>
  );
}

/* =========================
   PROFILE
========================= */

function Profile({ session, auth }) {
  return (
    <section className="page center">

      <div className="avatar">
        L
      </div>

      <h1>
        {session
          ? 'حسابك'
          : 'كن صانع محتوى على Lking'}
      </h1>

      <p>
        {session
          ? session.user.email
          : 'انشر، ابنِ جمهورك وشارك في البث المباشر.'}
      </p>

      {!session && (
        <button
          className="primary"
          onClick={auth}
        >
          إنشاء حساب
        </button>
      )}

      <div className="pitch">

        <Users />

        <div>
          <b>برنامج صناع المحتوى</b>

          <small>
            تحديات ومكافآت وفرص لتحقيق الدخل.
          </small>
        </div>

      </div>

    </section>
  );
}

/* =========================
   AUTH
========================= */

function Auth({ close, done }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const go = async () => {
    if (!supabase) {
      setMessage('اربط Supabase أولًا.');
      return;
    }

    if (!email || !password) {
      setMessage(
        'أدخل البريد الإلكتروني وكلمة المرور.'
      );
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const result = signup
        ? await supabase.auth.signUp({
            email,
            password
          })
        : await supabase.auth.signInWithPassword({
            email,
            password
          });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      if (result.data?.session) {
        done(result.data.session);
      } else {
        setMessage(
          'تم إنشاء الحساب. تحقق من بريدك الإلكتروني.'
        );
      }

    } catch (error) {
      setMessage(
        error?.message ||
        'حدث خطأ.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal close={close}>

      <h2>
        {signup
          ? 'إنشاء حساب'
          : 'تسجيل الدخول'}
      </h2>

      <input
        placeholder="البريد الإلكتروني"
        value={email}
        onChange={(event) =>
          setEmail(event.target.value)
        }
      />

      <input
        placeholder="كلمة المرور"
        type="password"
        value={password}
        onChange={(event) =>
          setPassword(event.target.value)
        }
      />

      <button
        className="primary"
        onClick={go}
        disabled={loading}
      >
        {loading
          ? 'انتظر...'
          : signup
            ? 'إنشاء الحساب'
            : 'دخول'}
      </button>

      {message && (
        <p>{message}</p>
      )}

      <button
        className="link"
        onClick={() => {
          setSignup((value) => !value);
          setMessage('');
        }}
      >
        {signup
          ? 'لدي حساب'
          : 'إنشاء حساب جديد'}
      </button>

    </Modal>
  );
}

/* =========================
   LIVE ROOM
========================= */

function LiveRoom({
  room,
  session,
  close
}) {
  const localVideo = useRef(null);
  const roomRef = useRef(null);
  const chatSub = useRef(null);

  const isHost = room === 'create';

  const [roomId, setRoomId] = useState(
    isHost ? null : room.id
  );

  const [started, setStarted] = useState(false);

  const [title, setTitle] = useState(
    isHost
      ? 'بث Lking'
      : room.title
  );

  const [chat, setChat] = useState([]);

  const [message, setMessage] = useState('');

  const [muted, setMuted] = useState(false);

  const [camera, setCamera] = useState(true);

  const [error, setError] = useState('');

  const connect = async () => {
    try {
      setError('');

      if (!supabase) {
        throw new Error(
          'Supabase غير متصل.'
        );
      }

      if (!session) {
        throw new Error(
          'يجب تسجيل الدخول.'
        );
      }

      if (!livekitConfigured) {
        throw new Error(
          'VITE_LIVEKIT_URL غير مضبوط.'
        );
      }

      let id = roomId;

      if (isHost && !id) {
        const { data, error: createError } =
          await supabase
            .from('live_rooms')
            .insert({
              host_id: session.user.id,
              title,
              status: 'live'
            })
            .select()
            .single();

        if (createError) {
          throw createError;
        }

        id = data.id;
        setRoomId(id);
      }

      if (!id) {
        throw new Error(
          'غرفة البث غير موجودة.'
        );
      }

      const token = await liveToken(
        id,
        session.user.id,
        isHost
      );

      const liveRoomInstance = new Room();

      roomRef.current = liveRoomInstance;

      liveRoomInstance.on(
        RoomEvent.TrackSubscribed,
        (track) => {
          if (track.kind !== 'video') {
            return;
          }

          const element =
            track.attach();

          element.className =
            'remote-video';

          const stage =
            document.getElementById(
              'remote-stage'
            );

          if (stage) {
            stage.appendChild(element);
          }
        }
      );

      await liveRoomInstance.connect(
        import.meta.env.VITE_LIVEKIT_URL,
        token
      );

      if (isHost) {
        const tracks =
          await createLocalTracks({
            audio: true,
            video: true
          });

        for (const track of tracks) {
          await liveRoomInstance.localParticipant.publishTrack(
            track
          );

          if (
            track.kind === 'video' &&
            localVideo.current
          ) {
            localVideo.current.srcObject =
              new MediaStream([
                track.mediaStreamTrack
              ]);
          }
        }
      }

      setStarted(true);

      chatSub.current =
        supabase
          .channel(`chat-${id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'live_chat',
              filter: `room_id=eq.${id}`
            },
            (payload) => {
              setChat((current) => [
                ...current,
                payload.new
              ]);
            }
          )
          .subscribe();

    } catch (error) {
      console.error(error);

      setError(
        error?.message ||
        'تعذر الاتصال بالبث.'
      );
    }
  };

  const stop = async () => {
    try {
      if (
        isHost &&
        roomId &&
        supabase
      ) {
        await supabase
          .from('live_rooms')
          .update({
            status: 'ended',
            ended_at:
              new Date().toISOString()
          })
          .eq('id', roomId);
      }

      if (
        chatSub.current &&
        supabase
      ) {
        await supabase.removeChannel(
          chatSub.current
        );
      }

      if (roomRef.current) {
        await roomRef.current.disconnect();
      }

    } finally {
      close();
    }
  };

  const send = async () => {
    if (!message.trim()) return;
    if (!roomId) return;
    if (!session) return;
    if (!supabase) return;

    const { error: sendError } =
      await supabase
        .from('live_chat')
        .insert({
          room_id: roomId,
          user_id: session.user.id,
          message: message.trim()
        });

    if (sendError) {
      setError(sendError.message);
      return;
    }

    setMessage('');
  };

  const toggleMic = async () => {
    if (!roomRef.current) return;

    const next = !muted;

    await roomRef.current.localParticipant
      .setMicrophoneEnabled(!next);

    setMuted(next);
  };

  const toggleCamera = async () => {
    if (!roomRef.current) return;

    const next = !camera;

    await roomRef.current.localParticipant
      .setCameraEnabled(next);

    setCamera(next);
  };

  return (
    <Modal close={stop}>

      <div className="live-room">

        <div
          className="stage"
          id="remote-stage"
        >

          {isHost && (
            <video
              ref={localVideo}
              autoPlay
              muted
              playsInline
              className="camera"
            />
          )}

          {!started && (
            <div className="start-card">

              <Radio size={45} />

              <h2>
                {isHost
                  ? 'ابدأ بثك الآن'
                  : 'انضم إلى البث'}
              </h2>

              {isHost && (
                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="عنوان البث"
                />
              )}

              <button
                className="primary"
                onClick={connect}
              >
                {isHost
                  ? 'تشغيل الكاميرا والمايك'
                  : 'دخول البث'}
              </button>

            </div>
          )}

        </div>

        {started && (
          <div className="live-controls">

            <button onClick={toggleMic}>
              {muted
                ? <MicOff />
                : <Mic />}
            </button>

            <button onClick={toggleCamera}>
              {camera
                ? <Video />
                : <VideoOff />}
            </button>

            <b>● LIVE</b>

            <button
              className="end"
              onClick={stop}
            >
              {isHost
                ? 'إنهاء البث'
                : 'خروج'}
            </button>

          </div>
        )}

        <div className="chat">

          <div>
            {chat.map((item) => (
              <p key={item.id}>
                <b>
                  {item.user_id
                    ? item.user_id.slice(0, 6)
                    : 'user'}
                </b>{' '}
                {item.message}
              </p>
            ))}
          </div>

          {started && (
            <div className="chat-send">

              <input
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter'
                  ) {
                    send();
                  }
                }}
                placeholder="اكتب تعليقًا..."
              />

              <button onClick={send}>
                <Send />
              </button>

            </div>
          )}

        </div>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

      </div>

    </Modal>
  );
}

/* =========================
   STUDIO
========================= */

function Studio({ close }) {
  return (
    <Modal close={close}>

      <h2>Creator Studio</h2>

      <div className="stats">

        <div>
          <BarChart3 />
          <b>0</b>
          <small>مشاهدات</small>
        </div>

        <div>
          <Users />
          <b>0</b>
          <small>متابعون</small>
        </div>

        <div>
          <Gift />
          <b>500</b>
          <small>مكافآت البداية</small>
        </div>

      </div>

      <div className="studio-box">

        <b>
          برنامج صناع المحتوى
        </b>

        <p>
          انشر باستمرار، ادخل التحديات،
          وابنِ جمهورك.
          الهدايا وتحقيق الدخل يضافان
          بعد تفعيل الدفع ومكافحة الاحتيال.
        </p>

      </div>

    </Modal>
  );
}

/* =========================
   MODAL
========================= */

function Modal({
  children,
  close
}) {
  return (
    <div className="modal">

      <div className="modal-box">

        <button
          className="close"
          onClick={close}
          aria-label="إغلاق"
        >
          <X />
        </button>

        {children}

      </div>

    </div>
  );
}

/* =========================
   START
========================= */

const rootElement =
  document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'لم يتم العثور على عنصر #root في index.html'
  );
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
