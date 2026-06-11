import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Tv, Play, Pause, SkipBack, SkipForward, Shuffle, X,
  Images, ChevronRight, Folder, FolderPlus,
  Pencil, Trash2, ArrowUp, ArrowDown, ImagePlus, Loader2,
  Instagram, Facebook, Cloud, Image as ImageIcon, AlertCircle,
} from "lucide-react";
import { Camera } from "@capacitor/camera";
import { loadState, saveMeta, saveImage } from "./storage";
import AirPlay, { isAirPlaySupported } from "./native/airplay";
import { importFromProvider, PROVIDERS, isProviderEnabled } from "./social";

// ---------- tokens ----------
const C = {
  bg: "#0a0c13",
  card: "#141a2c",
  card2: "#1b2238",
  line: "rgba(235,240,255,0.08)",
  text: "#f4f2ec",
  mut: "#8b91a7",
  amber: "#ffb56b",
  deep: "#ff7a59",
  green: "#4ade80",
  red: "#f87171",
};
const BEAM = `linear-gradient(135deg, ${C.amber}, ${C.deep})`;
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

// Photo sources offered by the import sheet. Native library is always on;
// social providers appear only when configured + enabled in src/social/config.js.
const SOCIAL_SOURCES = [
  { key: "instagram", label: "Instagram", Icon: Instagram },
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "google", label: "Google Photos", Icon: Cloud },
];

const CSS = `
  .kb{animation:kb 9s ease-in-out forwards}
  @keyframes kb{from{transform:scale(1.03)}to{transform:scale(1.16)}}
  .xf{animation:xf .8s ease both}
  @keyframes xf{from{opacity:0}to{opacity:1}}
  .ringA,.ringB{position:absolute;inset:0;border-radius:9999px;border:1.5px solid rgba(255,181,107,.55);animation:pulse2 2.4s ease-out infinite}
  .ringB{animation-delay:1.2s}
  @keyframes pulse2{0%{transform:scale(.42);opacity:.9}100%{transform:scale(1.85);opacity:0}}
  .rise{animation:rise .45s ease both}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .fade{animation:fade .5s ease both}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  .spin{animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  input::placeholder{color:#6b7088}
  ::-webkit-scrollbar{display:none}
  @media (prefers-reduced-motion: reduce){.kb,.xf,.ringA,.ringB,.rise,.fade{animation:none}}
`;

function shuffleArr(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

// downscale an image (from any URL the webview can load) to a JPEG data URL
function urlToDataUrl(srcUrl, max = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("read failed"));
    img.src = srcUrl;
  });
}

// ---------- shared photo visuals ----------
function Fill({ p, fx }) {
  const cls = fx === "cut" ? "" : fx === "crossfade" ? "xf" : "kb xf";
  if (!p) return null;
  if (p.img) {
    return (
      <img
        src={p.img}
        alt={p.t}
        className={cls}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  return (
    <div
      className={cls}
      style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, ${p.g[0]}, ${p.g[1]})`,
      }}
    >
      <span style={{ fontSize: 72, textShadow: "0 4px 26px rgba(0,0,0,.4)" }}>{p.e}</span>
    </div>
  );
}

function Thumb({ p, size = 48, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={p.t}
      className="rounded-xl overflow-hidden shrink-0 relative"
      style={{
        width: size, height: size,
        boxShadow: active ? `0 0 0 2.5px ${C.amber}` : "none",
        opacity: active ? 1 : 0.7,
        background: p.img ? "#000" : `linear-gradient(135deg, ${p.g?.[0]}, ${p.g?.[1]})`,
      }}
    >
      {p.img ? (
        <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-lg">{p.e}</span>
      )}
    </button>
  );
}

// ---------- photo tile (library grid) ----------
function Tile({ p, order, onTap }) {
  const picked = order > 0;
  return (
    <button
      onClick={onTap}
      aria-pressed={picked}
      aria-label={p.t}
      className="relative aspect-square rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ background: p.img ? "#000" : `linear-gradient(135deg, ${p.g?.[0]}, ${p.g?.[1]})` }}
    >
      {p.img ? (
        <img src={p.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-4xl" style={{ textShadow: "0 2px 14px rgba(0,0,0,.35)" }}>
          {p.e}
        </span>
      )}
      {picked && (
        <>
          <span className="absolute inset-0 rounded-2xl" style={{ boxShadow: `inset 0 0 0 3px ${C.amber}`, background: "rgba(10,12,19,.25)" }} />
          <span
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: C.amber, color: "#241204" }}
          >
            {order}
          </span>
        </>
      )}
    </button>
  );
}

// ---------- beam sheet (real AirPlay) ----------
function BeamSheet({ source, onClose, onConnected }) {
  const supported = isAirPlaySupported();
  const [error, setError] = useState(supported ? null : "AirPlay needs a real iPhone or iPad — it isn't available in the browser.");
  const [waiting, setWaiting] = useState(false);

  // Connect when a real external (AirPlay) screen attaches. Also catch the case
  // where one is already connected (mirroring was on before opening the sheet).
  useEffect(() => {
    if (!supported) return;
    let handle;
    AirPlay.isConnected()
      .then(({ connected }) => {
        if (connected) onConnected({ name: "AirPlay display" });
      })
      .catch(() => {});
    AirPlay.addListener("screenConnected", (info) => {
      onConnected({ name: info?.name || "AirPlay display" });
    }).then((h) => {
      handle = h;
    });
    return () => handle?.remove();
  }, [supported, onConnected]);

  const openPicker = async () => {
    setError(null);
    setWaiting(true);
    try {
      await AirPlay.presentRoutePicker();
    } catch (e) {
      setError(e?.message || "Couldn't open the AirPlay picker.");
      setWaiting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end fade" style={{ background: "rgba(5,6,10,.72)" }}>
      <div className="rounded-t-3xl px-5 pt-5 pb-8 rise" style={{ background: C.card, borderTop: `1px solid ${C.line}` }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs tracking-widest" style={{ fontFamily: MONO, color: C.amber }}>
              AIRPLAY
            </div>
            <h2 className="text-xl font-semibold mt-1">Beam to a TV</h2>
            <p className="text-sm mt-0.5" style={{ color: C.mut }}>
              {source.name} · {source.ids.length} photos
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full" style={{ background: C.card2 }}>
            <X size={16} />
          </button>
        </div>

        <div className="relative w-36 h-36 mx-auto my-6">
          {waiting && !error && (
            <>
              <span className="ringA" />
              <span className="ringB" />
            </>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: BEAM, color: "#241204" }}>
              <Tv size={26} />
            </span>
          </span>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl p-3.5 mb-3" style={{ background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.3)" }}>
            <AlertCircle size={18} style={{ color: C.red, flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm" style={{ color: C.text }}>{error}</p>
          </div>
        ) : (
          <p className="text-center text-sm mb-3" style={{ color: C.mut }}>
            {waiting ? "Waiting for the TV to connect…" : "Pick your Apple TV or AirPlay display. Photos start the moment it connects."}
          </p>
        )}

        <button
          onClick={openPicker}
          disabled={!supported}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold"
          style={{ background: supported ? BEAM : C.card2, color: supported ? "#241204" : C.mut }}
        >
          {waiting ? <Loader2 size={18} className="spin" /> : <Tv size={18} />}
          {waiting ? "Searching…" : "Open AirPlay picker"}
        </button>
      </div>
    </div>
  );
}

// ---------- save album sheet ----------
function SaveSheet({ count, onClose, onSave }) {
  const [name, setName] = useState("");
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end fade" style={{ background: "rgba(5,6,10,.72)" }}>
      <div className="rounded-t-3xl px-5 pt-5 pb-8 rise" style={{ background: C.card, borderTop: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Save as album</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full" style={{ background: C.card2 }}>
            <X size={16} />
          </button>
        </div>
        <p className="text-sm mt-1" style={{ color: C.mut }}>{count} photos, in the order you tapped them.</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friday night reel"
          className="w-full mt-4 rounded-2xl px-4 py-3.5 text-base focus:outline-none"
          style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}
        />
        <button
          onClick={() => onSave(name.trim() || `Album · ${count} photos`)}
          className="w-full mt-3 rounded-2xl py-3.5 font-semibold"
          style={{ background: BEAM, color: "#241204" }}
        >
          Save album
        </button>
      </div>
    </div>
  );
}

// ---------- edit album sheet ----------
function EditSheet({ album, lookup, onClose, onSave, onDelete }) {
  const [name, setName] = useState(album.name);
  const [ids, setIds] = useState(album.ids);
  const [confirm, setConfirm] = useState(false);

  const move = (idx, d) => {
    const j = idx + d;
    if (j < 0 || j >= ids.length) return;
    const x = [...ids];
    [x[idx], x[j]] = [x[j], x[idx]];
    setIds(x);
  };
  const remove = (idx) => setIds(ids.filter((_, i) => i !== idx));

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end fade" style={{ background: "rgba(5,6,10,.72)" }}>
      <div
        className="rounded-t-3xl px-5 pt-5 pb-8 rise flex flex-col"
        style={{ background: C.card, borderTop: `1px solid ${C.line}`, maxHeight: "85%" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit album</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full" style={{ background: C.card2 }}>
            <X size={16} />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Album name"
          className="w-full mt-4 rounded-2xl px-4 py-3 text-base focus:outline-none"
          style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}
        />

        <div className="mt-4 space-y-2 overflow-y-auto" style={{ minHeight: 0 }}>
          {ids.map((id, idx) => {
            const p = lookup(id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center gap-3 rounded-2xl p-2 pr-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
                <Thumb p={p} size={44} active onClick={() => {}} />
                <span className="flex-1 text-sm truncate">{p.t}</span>
                <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up" className="p-1.5 rounded-lg" style={{ color: idx === 0 ? "rgba(255,255,255,.18)" : C.mut }}>
                  <ArrowUp size={16} />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === ids.length - 1} aria-label="Move down" className="p-1.5 rounded-lg" style={{ color: idx === ids.length - 1 ? "rgba(255,255,255,.18)" : C.mut }}>
                  <ArrowDown size={16} />
                </button>
                <button onClick={() => remove(idx)} aria-label="Remove from album" className="p-1.5 rounded-lg" style={{ color: C.red }}>
                  <X size={16} />
                </button>
              </div>
            );
          })}
          {ids.length === 0 && (
            <p className="text-center text-sm py-4" style={{ color: C.mut }}>
              Empty albums get deleted on save.
            </p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="px-4 rounded-2xl py-3.5 font-medium flex items-center gap-2"
              style={{ background: "rgba(248,113,113,.12)", color: C.red, border: "1px solid rgba(248,113,113,.3)" }}
            >
              <Trash2 size={16} /> Delete
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="px-4 rounded-2xl py-3.5 font-semibold"
              style={{ background: C.red, color: "#2b0707" }}
            >
              Really delete
            </button>
          )}
          <button
            onClick={() => onSave(name.trim() || album.name, ids)}
            className="flex-1 rounded-2xl py-3.5 font-semibold"
            style={{ background: BEAM, color: "#241204" }}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- now playing ----------
function Playing({ source, tvName, lookup, onStop }) {
  const [order, setOrder] = useState(source.ids);
  const [i, setI] = useState(0);
  const [run, setRun] = useState(true);
  const [shuf, setShuf] = useState(false);
  const [ms, setMs] = useState(5000);
  const [fx, setFx] = useState("kenburns"); // kenburns | crossfade | cut

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setI((x) => (x + 1) % order.length), ms);
    return () => clearInterval(t);
  }, [run, ms, order]);

  const p = lookup(order[i]);

  // Push the current photo to the real AirPlay screen. The in-app frame below
  // mirrors what the TV is showing; the native plugin renders it full-screen.
  useEffect(() => {
    if (!isAirPlaySupported() || !p?.img) return;
    AirPlay.showPhoto({ image: p.img, title: p.t || "" }).catch(() => {});
  }, [p]);

  const step = (d) => setI((x) => (x + d + order.length) % order.length);
  const toggleShuf = () => {
    setOrder(shuf ? source.ids : shuffleArr(source.ids));
    setShuf(!shuf);
    setI(0);
  };

  return (
    <div className="flex-1 flex flex-col fade">
      <header className="px-5 flex items-center gap-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <span className="w-2 h-2 rounded-full" style={{ background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
        <span className="text-sm font-medium">Beaming to {tvName}</span>
        <span className="text-sm ml-auto truncate" style={{ color: C.mut, maxWidth: 160 }}>{source.name}</span>
      </header>

      {/* the TV */}
      <div className="relative px-5 mt-8">
        <div
          className="absolute inset-4 rounded-3xl"
          style={{
            background: p?.img ? "rgba(255,181,107,.5)" : p?.g ? `linear-gradient(135deg, ${p.g[0]}, ${p.g[1]})` : "#000",
            filter: "blur(44px)",
            opacity: 0.45,
          }}
        />
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,.14)", background: "#000", boxShadow: "0 26px 60px rgba(0,0,0,.65)" }}
        >
          <div className="aspect-video relative overflow-hidden">
            <Fill key={`${order[i]}-${i}-${fx}`} p={p} fx={fx} />
            <div
              className="absolute bottom-0 inset-x-0 p-3 flex items-end justify-between"
              style={{ background: "linear-gradient(transparent, rgba(0,0,0,.55))" }}
            >
              <span className="text-sm font-medium">{p?.t}</span>
              <span className="text-xs" style={{ fontFamily: MONO, color: "rgba(255,255,255,.75)" }}>
                {i + 1}/{order.length}
              </span>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-1 w-16 h-1 rounded-full" style={{ background: "rgba(255,255,255,.12)" }} />
      </div>

      {/* filmstrip */}
      <div className="flex gap-2 overflow-x-auto px-5 mt-6 pb-1">
        {order.map((id, idx) => {
          const q = lookup(id);
          if (!q) return null;
          return <Thumb key={`${id}-${idx}`} p={q} active={idx === i} onClick={() => setI(idx)} />;
        })}
      </div>

      {/* transport */}
      <div className="flex items-center justify-center gap-7 mt-6">
        <button onClick={() => step(-1)} aria-label="Previous" className="p-3 rounded-full" style={{ background: C.card }}>
          <SkipBack size={20} />
        </button>
        <button
          onClick={() => setRun(!run)}
          aria-label={run ? "Pause" : "Play"}
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: BEAM, color: "#241204", boxShadow: "0 10px 30px rgba(255,122,89,.35)" }}
        >
          {run ? <Pause size={26} /> : <Play size={26} className="ml-1" />}
        </button>
        <button onClick={() => step(1)} aria-label="Next" className="p-3 rounded-full" style={{ background: C.card }}>
          <SkipForward size={20} />
        </button>
      </div>

      {/* options */}
      <div className="flex items-center justify-center gap-2 mt-5 flex-wrap px-4">
        <button
          onClick={toggleShuf}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm"
          style={{
            background: shuf ? "rgba(255,181,107,.15)" : C.card,
            color: shuf ? C.amber : C.mut,
            border: `1px solid ${shuf ? "rgba(255,181,107,.4)" : C.line}`,
          }}
        >
          <Shuffle size={14} /> Shuffle
        </button>
        {[3000, 5000, 8000].map((v) => (
          <button
            key={v}
            onClick={() => setMs(v)}
            className="px-3.5 py-2 rounded-full text-sm"
            style={{
              background: ms === v ? "rgba(255,181,107,.15)" : C.card,
              color: ms === v ? C.amber : C.mut,
              border: `1px solid ${ms === v ? "rgba(255,181,107,.4)" : C.line}`,
              fontFamily: MONO,
            }}
          >
            {v / 1000}s
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-2.5 px-4">
        {[
          { k: "kenburns", label: "Ken Burns" },
          { k: "crossfade", label: "Crossfade" },
          { k: "cut", label: "Cut" },
        ].map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setFx(k)}
            className="px-3.5 py-2 rounded-full text-sm"
            style={{
              background: fx === k ? "rgba(255,181,107,.15)" : C.card,
              color: fx === k ? C.amber : C.mut,
              border: `1px solid ${fx === k ? "rgba(255,181,107,.4)" : C.line}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-auto px-5 pt-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
        <button
          onClick={onStop}
          className="w-full rounded-2xl py-3.5 font-medium"
          style={{ background: "rgba(248,113,113,.12)", color: C.red, border: "1px solid rgba(248,113,113,.3)" }}
        >
          Stop beaming
        </button>
      </div>
    </div>
  );
}

// ---------- import source sheet ----------
function ImportSheet({ onClose, onNative, onSocial }) {
  const social = SOCIAL_SOURCES.filter((s) => isProviderEnabled(s.key));
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end fade" style={{ background: "rgba(5,6,10,.72)" }}>
      <div className="rounded-t-3xl px-5 pt-5 pb-8 rise" style={{ background: C.card, borderTop: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Import photos</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full" style={{ background: C.card2 }}>
            <X size={16} />
          </button>
        </div>

        <button
          onClick={onNative}
          className="w-full mt-4 flex items-center gap-3 rounded-2xl p-3.5 text-left"
          style={{ background: C.card2, border: `1px solid ${C.line}` }}
        >
          <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,181,107,.12)", color: C.amber }}>
            <ImageIcon size={18} />
          </span>
          <span className="flex-1">
            <span className="block font-medium">Photo Library</span>
            <span className="block text-xs" style={{ color: C.mut }}>From this device</span>
          </span>
          <ChevronRight size={16} style={{ color: C.mut }} />
        </button>

        {social.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onSocial(key)}
            className="w-full mt-2 flex items-center gap-3 rounded-2xl p-3.5 text-left"
            style={{ background: C.card2, border: `1px solid ${C.line}` }}
          >
            <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,181,107,.12)", color: C.amber }}>
              <Icon size={18} />
            </span>
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight size={16} style={{ color: C.mut }} />
          </button>
        ))}

        {social.length === 0 && (
          <p className="text-center text-xs mt-4" style={{ color: C.mut }}>
            Connect Instagram, Facebook, or Google Photos by configuring src/social/config.js (see SOCIAL.md).
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- app ----------
export default function App() {
  const [tab, setTab] = useState("library");
  const [sel, setSel] = useState([]); // ordered photo ids
  const [albums, setAlbums] = useState([]);
  const [imported, setImported] = useState([]); // user photos {id,t,img,file,grp}
  const [sheet, setSheet] = useState(null); // 'beam' | 'save' | 'import' | {edit: album}
  const [source, setSource] = useState(null); // { name, ids }
  const [screen, setScreen] = useState("home");
  const [tvName, setTvName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const saveTimer = useRef(null);

  const allPhotos = imported;
  const lookup = useCallback(
    (id) => imported.find((p) => p.id === id),
    [imported]
  );
  const GROUPS = [...new Set(allPhotos.map((p) => p.grp))];

  // ----- load persisted state (Capacitor Preferences + Filesystem) -----
  useEffect(() => {
    (async () => {
      try {
        const d = await loadState();
        if (d) {
          if (Array.isArray(d.albums)) setAlbums(d.albums);
          if (Array.isArray(d.imported)) setImported(d.imported);
        }
      } catch {
        // first run — nothing saved yet
      }
      setLoading(false);
    })();
  }, []);

  // ----- persist metadata (debounced). Image bytes are saved at import time. -----
  useEffect(() => {
    if (loading) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveMeta(albums, imported);
      } catch {
        setToast("Couldn't save your changes.");
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [albums, imported, loading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ----- import photos via the native picker -----
  const importPhotos = async () => {
    let result;
    try {
      result = await Camera.pickImages({ quality: 90, limit: 12 });
    } catch {
      return; // user cancelled or permission denied
    }
    if (!result?.photos?.length) return;
    setImporting(true);
    const added = [];
    for (const [idx, photo] of result.photos.entries()) {
      try {
        const dataUrl = await urlToDataUrl(photo.webPath);
        const id = `u${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const file = await saveImage(id, dataUrl);
        added.push({
          id,
          t: `Import ${new Date().toLocaleDateString()} · ${idx + 1}`,
          img: dataUrl,
          file,
          grp: "Your imports",
        });
      } catch {
        // skip unreadable file
      }
    }
    setImported((x) => [...added, ...x]);
    setImporting(false);
    if (added.length) setToast(`Imported ${added.length} photo${added.length > 1 ? "s" : ""}`);
  };

  // ----- import photos from a social provider (Instagram / Facebook / Google) -----
  const importSocial = async (providerKey) => {
    setSheet(null);
    setImporting(true);
    const label = PROVIDERS[providerKey]?.label || providerKey;
    try {
      const items = await importFromProvider(providerKey);
      const added = [];
      for (const it of items) {
        try {
          const id = `${providerKey}-${it.id}`;
          // Re-encode through the same downscale pipeline as native imports.
          const dataUrl = await urlToDataUrl(it.dataUrl);
          const file = await saveImage(id, dataUrl);
          added.push({ id, t: it.title || label, img: dataUrl, file, grp: label });
        } catch {
          // skip unreadable item
        }
      }
      setImported((x) => [...added, ...x]);
      setToast(added.length ? `Imported ${added.length} from ${label}` : `Nothing to import from ${label}`);
    } catch (e) {
      setToast(e?.message || `${label} import failed`);
    } finally {
      setImporting(false);
    }
  };

  const toggle = (id) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const beam = (name, ids) => {
    setSource({ name, ids });
    setSheet("beam");
  };
  const onConnected = (tv) => {
    setTvName(tv.name);
    setSheet(null);
    setScreen("playing");
  };
  const stop = () => {
    AirPlay.disconnect().catch(() => {});
    setScreen("home");
    setTvName(null);
    setSel([]);
  };
  const saveAlbum = (name) => {
    setAlbums((a) => [{ id: String(Date.now()), name, ids: sel }, ...a]);
    setSel([]);
    setSheet(null);
    setTab("albums");
    setToast("Album saved");
  };
  const updateAlbum = (id, name, ids) => {
    setAlbums((a) =>
      ids.length === 0
        ? a.filter((x) => x.id !== id)
        : a.map((x) => (x.id === id ? { ...x, name, ids } : x))
    );
    setSheet(null);
  };
  const deleteAlbum = (id) => {
    setAlbums((a) => a.filter((x) => x.id !== id));
    setSheet(null);
    setToast("Album deleted");
  };

  return (
    <div
      className="min-h-screen w-full flex justify-center"
      style={{ background: C.bg, color: C.text, fontFamily: '-apple-system, "SF Pro Text", "Segoe UI", sans-serif' }}
    >
      <style>{CSS}</style>
      <div className="w-full max-w-md min-h-screen flex flex-col relative" style={{ background: C.bg }}>
        {screen === "playing" && source ? (
          <Playing source={source} tvName={tvName} lookup={lookup} onStop={stop} />
        ) : (
          <>
            <header
              className="px-5 pb-2 flex items-start justify-between"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}
            >
              <div>
                <div className="text-xs tracking-widest" style={{ fontFamily: MONO, color: C.amber }}>
                  AIRPLAY, MINUS THE FRICTION
                </div>
                <h1 className="text-3xl font-semibold tracking-tight mt-1">PhotoBeam</h1>
                <p className="text-sm mt-1" style={{ color: C.mut }}>
                  Pick photos. Tap a TV. They're on the big screen.
                </p>
              </div>
              <button
                onClick={() => setSheet("import")}
                aria-label="Import photos"
                className="mt-2 p-3 rounded-2xl"
                style={{ background: C.card, border: `1px solid ${C.line}`, color: C.amber }}
              >
                {importing ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}
              </button>
            </header>

            {/* content */}
            <main className="flex-1 overflow-y-auto px-4 pb-44">
              {loading ? (
                <div className="flex items-center justify-center pt-16" style={{ color: C.mut }}>
                  <Loader2 size={20} className="spin" />
                </div>
              ) : tab === "library" ? (
                allPhotos.length === 0 ? (
                  <div className="text-center pt-16" style={{ color: C.mut }}>
                    <ImageIcon size={28} className="mx-auto mb-2" />
                    <p className="text-sm">No photos yet.</p>
                    <button
                      onClick={() => setSheet("import")}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold"
                      style={{ background: BEAM, color: "#241204" }}
                    >
                      <ImagePlus size={16} /> Import photos
                    </button>
                  </div>
                ) : (
                <>
                  {sel.length === 0 && (
                    <p className="px-1 pt-3 text-xs" style={{ color: C.mut }}>
                      Tap photos in the order you want them to play. Use the import button to add more.
                    </p>
                  )}
                  {GROUPS.map((g) => (
                    <section key={g} className="mt-5">
                      <h3 className="px-1 mb-2 text-xs tracking-wider" style={{ fontFamily: MONO, color: C.mut }}>
                        {g.toUpperCase()}
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {allPhotos.filter((p) => p.grp === g).map((p) => (
                          <Tile key={p.id} p={p} order={sel.indexOf(p.id) + 1} onTap={() => toggle(p.id)} />
                        ))}
                      </div>
                    </section>
                  ))}
                </>
                )
              ) : (
                <div className="mt-4 space-y-3">
                  {albums.map((a) => (
                    <div
                      key={a.id}
                      className="w-full flex items-center gap-3 rounded-2xl p-3"
                      style={{ background: C.card, border: `1px solid ${C.line}` }}
                    >
                      <span className="grid grid-cols-2 gap-0.5 w-12 h-12 rounded-xl overflow-hidden shrink-0">
                        {a.ids.slice(0, 4).map((id) => {
                          const p = lookup(id);
                          return p?.img ? (
                            <img key={id} src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span key={id} style={{ background: p ? `linear-gradient(135deg, ${p.g[0]}, ${p.g[1]})` : C.card2 }} />
                          );
                        })}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">{a.name}</span>
                        <span className="block text-xs" style={{ color: C.mut }}>{a.ids.length} photos</span>
                      </span>
                      <button
                        onClick={() => setSheet({ edit: a })}
                        aria-label={`Edit ${a.name}`}
                        className="p-2.5 rounded-full"
                        style={{ background: C.card2, color: C.mut }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => beam(a.name, a.ids)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold"
                        style={{ background: BEAM, color: "#241204" }}
                      >
                        <Tv size={14} /> Beam
                      </button>
                    </div>
                  ))}
                  {albums.length === 0 && (
                    <div className="text-center pt-10" style={{ color: C.mut }}>
                      <Folder size={28} className="mx-auto mb-2" />
                      <p className="text-sm">No albums yet.</p>
                    </div>
                  )}
                  <p className="text-center text-xs pt-2" style={{ color: C.mut }}>
                    Select photos in Library to build a new album.
                  </p>
                </div>
              )}
            </main>

            {/* selection bar */}
            {sel.length > 0 && tab === "library" && (
              <div
                className="absolute bottom-24 left-4 right-4 z-20 rounded-2xl p-2.5 flex items-center gap-2 rise"
                style={{ background: "rgba(20,26,44,.92)", backdropFilter: "blur(14px)", border: `1px solid ${C.line}`, boxShadow: "0 16px 40px rgba(0,0,0,.5)" }}
              >
                <button
                  onClick={() => beam(`${sel.length} photos`, sel)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold"
                  style={{ background: BEAM, color: "#241204" }}
                >
                  <Tv size={17} /> Beam {sel.length} to TV
                </button>
                <button onClick={() => setSheet("save")} aria-label="Save as album" className="p-3 rounded-xl" style={{ background: C.card2 }}>
                  <FolderPlus size={18} />
                </button>
                <button onClick={() => setSel([])} aria-label="Clear selection" className="p-3 rounded-xl" style={{ background: C.card2, color: C.mut }}>
                  <X size={18} />
                </button>
              </div>
            )}

            {/* toast */}
            {toast && (
              <div
                className="absolute bottom-44 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-full text-sm rise whitespace-nowrap"
                style={{ background: "rgba(20,26,44,.95)", border: `1px solid ${C.line}`, backdropFilter: "blur(10px)" }}
              >
                {toast}
              </div>
            )}

            {/* tab bar */}
            <nav
              className="absolute bottom-0 inset-x-0 z-10 flex justify-around px-6 pt-3"
              style={{
                background: "rgba(10,12,19,.9)",
                backdropFilter: "blur(14px)",
                borderTop: `1px solid ${C.line}`,
                paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
              }}
            >
              {[
                { k: "library", label: "Library", I: Images },
                { k: "albums", label: "Albums", I: Folder },
              ].map(({ k, label, I }) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className="flex flex-col items-center gap-1 text-xs"
                  style={{ color: tab === k ? C.amber : C.mut }}
                >
                  <I size={20} />
                  {label}
                </button>
              ))}
            </nav>
          </>
        )}

        {sheet === "import" && (
          <ImportSheet
            onClose={() => setSheet(null)}
            onNative={() => { setSheet(null); importPhotos(); }}
            onSocial={importSocial}
          />
        )}
        {sheet === "beam" && source && <BeamSheet source={source} onClose={() => setSheet(null)} onConnected={onConnected} />}
        {sheet === "save" && <SaveSheet count={sel.length} onClose={() => setSheet(null)} onSave={saveAlbum} />}
        {sheet?.edit && (
          <EditSheet
            album={sheet.edit}
            lookup={lookup}
            onClose={() => setSheet(null)}
            onSave={(name, ids) => updateAlbum(sheet.edit.id, name, ids)}
            onDelete={() => deleteAlbum(sheet.edit.id)}
          />
        )}
      </div>
    </div>
  );
}
