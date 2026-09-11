import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
  VideoOff,
} from "lucide-react";
import {
  Room,
  RoomEvent,
  createLocalTracks,
} from "livekit-client";

import { supabase } from "./supabase";
import "./styles.css";

const livekitConfigured = Boolean(
  import.meta.env.VITE_LIVEKIT_URL
);

async function liveToken(roomName, identity, canPublish) {
  if (!supabase) {
    throw new Error("Supabase غير متصل.");
  }

  const { data, error } = await supabase.functions.invoke(
    "livekit-token",
    {
      body: {
        roomName,
        identity,
        canPublish,
      },
    }
  );

  if (error) {
    throw error;
  }

  if (!data?.token) {
    throw new Error("لم يتم الحصول على LiveKit Token.");
  }

  return data.token;
}

/* =========================
   APP
========================= */

function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("home");
  const [posts, setPosts] = useState([]);
  const [auth, setAuth] = useState(false);
  const [liveRoom, setLiveRoom] = useState(null);
  const [studio, setStudio] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: subscriptionData,
    } = supabase.auth.onAuthStateChange((_event, sessionData) => {
      setSession(sessionData);
    });

    return () => {
      subscriptionData.subscription.unsubscribe();
    };
  }, []);

  const loadPosts = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("creator_posts")
      .select(
        "id,media_url,caption,views,likes,creator_id,created_at"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error) {
      setPosts(data || []);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [session]);

  const openAuth = () => {
    setAuth(true);
  };

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

              <button onClick={() => supabase?.auth.signOut()}>
                <LogOut />
              </button>
            </>
          ) : (
            <button onClick={openAuth}>
              <LogIn />
              دخول
            </button>
          )}
        </div>
      </header>

      <main>
        {tab === "home" && (
          <Feed
            posts={posts}
            session={session}
            auth={openAuth}
          />
        )}

        {tab === "explore" && (
          <Explore posts={posts} />
        )}

        {tab === "live" && (
          <Live
            session={session}
            auth={openAuth}
            open={(room) => setLiveRoom(room)}
          />
        )}

        {tab === "create" && (
          <Create
            session={session}
            auth={openAuth}
            reload={loadPosts}
            live={() => setTab("live")}
          />
        )}

        {tab === "profile" && (
          <Profile
            session={session}
            auth={openAuth}
          />
        )}
      </main>

      <nav>
        {[
          [Home, "الرئيسية", "home"],
          [Compass, "اكتشف", "explore"],
          [Plus, "", "create"],
          [Radio, "مباشر", "live"],
          [User, "حسابي", "profile"],
        ].map(([Icon, label, target], index) => (
          <button
            key={target}
            className={
              index === 2
                ? `plus ${tab === target ? "active" : ""}`
                : tab === target
                ? "active"
                : ""
            }
            onClick={() => setTab(target)}
          >
            <Icon />
            <small>{label}</small>
          </button>
        ))}
      </nav>

      {auth && (
        <Auth
          close={() => setAuth(false)}
          done={(newSession) => {
            setSession(newSession);
            setAuth(false);
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

    const { error } = await supabase
      .from("post_likes")
      .insert({
        user_id: session.user.id,
        post_id: post.id,
      });

    if (!error) {
      await supabase
        .from("creator_posts")
        .update({
          likes: (post.likes || 0) + 1,
        })
        .eq("id", post.id);
    }
  };

  return (
    <section
      className="feed"
      onWheel={(event) => {
        if (event.deltaY > 15) {
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

            <button>
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

  useEffect(() => {
    if (!supabase) return;

    const loadRooms = async () => {
      const { data } = await supabase
        .from("live_rooms")
        .select("*")
        .eq("status", "live")
        .order("started_at", {
          ascending: false,
        });

      setRooms(data || []);
    };

    loadRooms();

    const channel = supabase
      .channel("live-rooms")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_rooms",
        },
        loadRooms
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="page">
      <div className="row">
        <div>
          <h1>البث المباشر</h1>

          <p>
            بث حقيقي عبر LiveKit مع غرفة
            ومشاهدين ودردشة.
          </p>
        </div>

        <button
          className="primary"
          onClick={() =>
            session ? open("create") : auth()
          }
        >
          <Radio />
          ابدأ بثًا
        </button>
      </div>

      {!livekitConfigured && (
        <div className="warning">
          أضف VITE_LIVEKIT_URL ثم انشر Edge
          Function قبل تشغيل البث.
        </div>
      )}

      {rooms.length > 0 ? (
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
          <br />
          كن أول من يبدأ.
        </div>
      )}
    </section>
  );
}

/* =========================
   CREATE
========================= */

function Create({
  session,
  auth,
  reload,
  live,
}) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState("");

  const publish = async () => {
    if (!session) {
      auth();
      return;
    }

    if (!file) {
      setMessage("اختر فيديو أولًا.");
      return;
    }

    if (!supabase) {
      setMessage("Supabase غير متصل.");
      return;
    }

    try {
      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const path =
        `${session.user.id}/` +
        `${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } =
        await supabase.storage
          .from("videos")
          .upload(path, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } =
        supabase.storage
          .from("videos")
          .getPublicUrl(path);

      const { error: postError } =
        await supabase
          .from("creator_posts")
          .insert({
            creator_id: session.user.id,
            media_url: publicData.publicUrl,
            caption,
            status: "published",
          });

      if (postError) {
        throw postError;
      }

      setMessage("تم نشر الفيديو بنجاح.");
      setFile(null);
      setCaption("");

      await reload();
    } catch (error) {
      setMessage(
        error?.message ||
          "حدث خطأ أثناء نشر الفيديو."
      );
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
            الفيديو المختار: {file.name}
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
        >
          نشر الفيديو
        </button>

        <button onClick={live}>
          <Radio />
          بث مباشر
        </button>

        {message && <p>{message}</p>}
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
      <div className="avatar">L</div>

      <h1>
        {session
          ? "حسابك"
          : "كن صانع محتوى على Lking"}
      </h1>

      <p>
        {session
          ? session.user.email
          : "انشر، ابنِ جمهورك وشارك في البث المباشر."}
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!supabase) {
      setMessage("اربط Supabase أولًا.");
      return;
    }

    if (!email || !password) {
      setMessage(
        "أدخل البريد الإلكتروني وكلمة المرور."
      );
      return;
    }

    try {
      const result = signup
        ? await supabase.auth.signUp({
            email,
            password,
          })
        : await supabase.auth.signInWithPassword({
            email,
            password,
          });

      if (result.error) {
        throw result.error;
      }

      if (result.data.session) {
        done(result.data.session);
      } else {
        setMessage(
          "تم إنشاء الحساب. تحقق من بريدك الإلكتروني."
        );
      }
    } catch (error) {
      setMessage(
        error?.message ||
          "حدث خطأ أثناء تسجيل الدخول."
      );
    }
  };

  return (
    <Modal close={close}>
      <h2>
        {signup
          ? "إنشاء حساب"
          : "تسجيل الدخول"}
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
        onClick={submit}
      >
        {signup
          ? "إنشاء الحساب"
          : "دخول"}
      </button>

      {message && <p>{message}</p>}

      <button
        className="link"
        onClick={() =>
          setSignup((value) => !value)
        }
      >
        {signup
          ? "لدي حساب"
          : "إنشاء حساب جديد"}
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
  close,
}) {
  const localVideo = useRef(null);
  const roomRef = useRef(null);
  const chatSub = useRef(null);

  const isHost = room === "create";

  const [roomId, setRoomId] = useState(
    isHost ? null : room.id
  );

  const [started, setStarted] =
    useState(false);

  const [title, setTitle] = useState(
    isHost ? "بث Lking" : room.title
  );

  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [error, setError] = useState("");

  const connect = async () => {
    try {
      if (!supabase || !session) {
        throw new Error(
          "يجب تسجيل الدخول أولًا."
        );
      }

      if (!livekitConfigured) {
        throw new Error(
          "VITE_LIVEKIT_URL غير مضبوط."
        );
      }

      let id = roomId;

      if (isHost && !id) {
        const { data, error: createError } =
          await supabase
            .from("live_rooms")
            .insert({
              host_id: session.user.id,
              title,
              category: "عام",
              status: "live",
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
          "غرفة البث غير موجودة."
        );
      }

      const token = await liveToken(
        id,
        session.user.id,
        isHost
      );

      const livekitRoom = new Room();

      roomRef.current = livekitRoom;

      livekitRoom.on(
        RoomEvent.TrackSubscribed,
        (track) => {
          if (track.kind === "video") {
            const element = track.attach();

            element.className =
              "remote-video";

            document
              .getElementById("remote-stage")
              ?.appendChild(element);
          }
        }
      );

      await livekitRoom.connect(
        import.meta.env.VITE_LIVEKIT_URL,
        token
      );

      if (isHost) {
        const tracks =
          await createLocalTracks({
            audio: true,
            video: true,
          });

        for (const track of tracks) {
          await livekitRoom.localParticipant.publishTrack(
            track
          );

          if (
            track.kind === "video" &&
            localVideo.current
          ) {
            localVideo.current.srcObject =
              new MediaStream([
                track.mediaStreamTrack,
              ]);
          }
        }
      }

      setStarted(true);

      chatSub.current = supabase
        .channel(`chat-${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "live_chat",
            filter: `room_id=eq.${id}`,
          },
          (payload) => {
            setChat((current) => [
              ...current,
              payload.new,
            ]);
          }
        )
        .subscribe();
    } catch (connectError) {
      setError(
        connectError?.message ||
          "فشل الاتصال بالبث."
      );
    }
  };

  const stop = async () => {
    try {
      if (isHost && roomId && supabase) {
        await supabase
          .from("live_rooms")
          .update({
            status: "ended",
            ended_at:
              new Date().toISOString(),
          })
          .eq("id", roomId);
      }

      if (chatSub.current && supabase) {
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

  const sendMessage = async () => {
    if (!message.trim() || !roomId) {
      return;
    }

    if (!supabase || !session) {
      return;
    }

    const { error: sendError } =
      await supabase
        .from("live_chat")
        .insert({
          room_id: roomId,
          user_id: session.user.id,
          message,
        });

    if (!sendError) {
      setMessage("");
    }
  };

  const toggleMic = async () => {
    const next = !muted;

    await roomRef.current?.localParticipant
      .setMicrophoneEnabled(!next);

    setMuted(next);
  };

  const toggleCamera = async () => {
    const next = !camera;

    await roomRef.current?.localParticipant
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
                  ? "ابدأ بثك الآن"
                  : "انضم إلى البث"}
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
                  ? "تشغيل الكاميرا والمايك"
                  : "دخول البث"}
              </button>
            </div>
          )}
        </div>

        {started && (
          <div className="live-controls">
            <button onClick={toggleMic}>
              {muted ? <MicOff /> : <Mic />}
            </button>

            <button onClick={toggleCamera}>
              {camera ? (
                <Video />
              ) : (
                <VideoOff />
              )}
            </button>

            <b>● LIVE</b>

            <button
              className="end"
              onClick={stop}
            >
              {isHost
                ? "إنهاء البث"
                : "خروج"}
            </button>
          </div>
        )}

        <div className="chat">
          <div>
            {chat.map((item) => (
              <p key={item.id}>
                <b>
                  {item.user_id.slice(0, 6)}
                </b>{" "}
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
                  if (event.key === "Enter") {
                    sendMessage();
                  }
                }}
                placeholder="اكتب تعليقًا..."
              />

              <button onClick={sendMessage}>
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
        <b>برنامج صناع المحتوى</b>

        <p>
          انشر باستمرار، ادخل التحديات،
          وابنِ جمهورك.
        </p>
      </div>
    </Modal>
  );
}

/* =========================
   MODAL
========================= */

function Modal({ children, close }) {
  return (
    <div className="modal">
      <div className="modal-box">
        <button
          className="close"
          onClick={close}
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

createRoot(
  document.getElementById("root")
).render(<App />);
