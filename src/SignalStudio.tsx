// AFTERIMAGE studio interface by 马路Milo, 2026-10-16.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  FiArrowUpRight,
  FiCheck,
  FiCopy,
  FiDownload,
  FiFilm,
  FiImage,
  FiMaximize,
  FiMoon,
  FiPause,
  FiPlay,
  FiPlus,
  FiRefreshCcw,
  FiSliders,
  FiSun,
  FiUpload,
  FiX,
} from "react-icons/fi";
import useDithering from "./hooks/useDithering";
import useVideoDithering from "./hooks/useVideoDithering";
import useVideoRecording from "./hooks/useVideoRecording";
import { algorithms } from "./utils/algorithms";
import { predefinedPalettes } from "./utils/palettes";
import {
  canvasToSVG,
  exportAtOriginalResolution,
  exportVideoFrameAtOriginalResolution,
} from "./utils/export";
import { createPreset, loadPresets, savePresets } from "./utils/presets";
import type { DitherPreset } from "./utils/presets";
import type { SerpentinePattern } from "./types/serpentinePatterns";
import { validateImage } from "./utils/validation";
import "./studio.css";

type RGB = [number, number, number];
type Media = { id: string; url: string; name: string; kind: "image" | "video" };
const SAMPLE = `${import.meta.env.BASE_URL}base-sample.webp`;
const palettes: { id: string; name: string; colors: RGB[] }[] = [
  {
    id: "paper",
    name: "骨白",
    colors: [
      [32, 32, 28],
      [231, 226, 212],
    ],
  },
  {
    id: "mono",
    name: "黑白",
    colors: [
      [0, 0, 0],
      [255, 255, 255],
    ],
  },
  {
    id: "amber",
    name: "琥珀",
    colors: [
      [28, 23, 17],
      [222, 164, 77],
    ],
  },
  {
    id: "red",
    name: "朱砂",
    colors: [
      [48, 21, 22],
      [215, 91, 77],
      [238, 219, 195],
    ],
  },
  ...predefinedPalettes,
];
const query = new URLSearchParams(window.location.search);
function numberParam(key: string, fallback: number, min: number, max: number) {
  const raw = query.get(key);
  const n = raw === null ? fallback : Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function time(t: number) {
  const n = Number.isFinite(t) ? Math.max(0, t) : 0;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function Range({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        <span>{label}</span>
        <output>{hint ?? value}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function SignalStudio() {
  const [mode, setMode] = useState<"image" | "video">(
    window.location.pathname.includes("/Image") ? "image" : "video",
  );
  const [media, setMedia] = useState<Media[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active =
    media.find((m) => m.id === activeId && m.kind === mode) ?? media.find((m) => m.kind === mode) ?? null;
  const [pattern, setPattern] = useState(() => {
    const n = numberParam("p", 1, 1, 30);
    return algorithms.some((a) => a.id === n) ? n : 1;
  });
  const [threshold, setThreshold] = useState(numberParam("t", 128, 0, 255));
  const [resolution, setResolution] = useState(numberParam("r", 480, 64, 1920));
  const [paletteId, setPaletteId] = useState(
    palettes.some((p) => p.id === query.get("palette")) ? query.get("palette")! : "paper",
  );
  const [invert, setInvert] = useState(query.get("invert") === "1");
  const [serpentine, setSerpentine] = useState(true);
  const [scan, setScan] = useState<SerpentinePattern>("standard");
  const [strength, setStrength] = useState(100);
  const [contrast, setContrast] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [highlights, setHighlights] = useState(0);
  const [blur, setBlur] = useState(0);
  const [asciiRamp, setAsciiRamp] = useState(" .:-=+*#%@");
  const [kernel, setKernel] = useState([
    [0, 0, 7],
    [3, 5, 1],
  ]);
  const [divisor, setDivisor] = useState(16);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(12);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const [grid, setGrid] = useState(false);
  const [dark, setDark] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [frameFormat, setFrameFormat] = useState("png");
  const [exportBusy, setExportBusy] = useState(false);
  const [presets, setPresets] = useState<DitherPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState("");
  const [customColors, setCustomColors] = useState(["#20201c", "#e7e2d4"]);
  const fileInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const originalVideo = useRef<HTMLVideoElement>(null);
  const urls = useRef(new Set<string>());
  const selected = algorithms.find((a) => a.id === pattern)!;
  const palette = useMemo<RGB[] | undefined>(() => {
    if (!selected.supportsPalette) return undefined;
    if (paletteId === "custom")
      return customColors.map(
        (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as RGB,
      );
    const colors = palettes.find((p) => p.id === paletteId)?.colors;
    return (pattern === 15 || pattern === 10) && colors && colors.length > 2
      ? [colors[0], colors[colors.length - 1]]
      : colors;
  }, [paletteId, customColors, selected.supportsPalette, pattern]);
  const params = {
    pattern,
    threshold,
    workingResolution: resolution,
    invert,
    serpentine,
    serpentinePattern: scan,
    errorDiffusionStrength: strength,
    isErrorDiffusion: selected.category === "Error Diffusion",
    paletteColors: palette,
    asciiRamp,
    contrast,
    midtones: gamma,
    highlights,
    blurRadius: blur,
    customKernel: kernel,
    customKernelDivisor: divisor,
  };
  const imageUrl = mode === "image" && active ? active.url : !active ? SAMPLE : null;
  const imageHook = useDithering({ image: imageUrl, ...params });
  const videoHook = useVideoDithering({
    video: mode === "video" ? (active?.url ?? null) : null,
    ...params,
    fps,
    playing,
  });
  const isVideo = mode === "video" && !!active;
  const canvasRef = isVideo ? videoHook.canvasRef : imageHook.canvasRef;
  const ready = isVideo ? videoHook.hasApplied : imageHook.hasApplied;
  const dimensions = isVideo ? videoHook.naturalDims : imageHook.origDims;
  const recording = useVideoRecording({
    videoItem: isVideo ? active : null,
    canvasRef,
    videoHook,
    videoFps: fps,
    setVideoPlaying: setPlaying,
  });
  const [downloaded, setDownloaded] = useState(false);

  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (exportOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [exportOpen]);
  useEffect(() => {
    const v = originalVideo.current;
    if (v && Math.abs(v.currentTime - videoHook.currentTime) > 0.15) v.currentTime = videoHook.currentTime;
  }, [videoHook.currentTime, compare]);
  useEffect(() => {
    const v = videoHook.videoElRef.current;
    if (!v) return;
    const fail = () => {
      setPlaying(false);
      setError("浏览器无法解码这个视频，请尝试 H.264 MP4 或 WebM。");
    };
    v.addEventListener("error", fail);
    return () => v.removeEventListener("error", fail);
  }, [active, isVideo, videoHook.videoElRef]);
  const switchMode = (next: "image" | "video") => {
    if (recording.recordingVideo) return;
    setMode(next);
    setPlaying(false);
    setCompare(false);
    setError("");
  };
  const importFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || recording.recordingVideo) return;
      setError("");
      const added: Media[] = [];
      for (const file of files) {
        const kind = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
            ? "video"
            : null;
        if (!kind) {
          setError("请选择 PNG、JPG、WebP 图片或 MP4、WebM、MOV 视频。");
          continue;
        }
        if (kind === "image") {
          const check = await validateImage(file);
          if (!check.valid) {
            setError(check.error ?? "无法读取图片。");
            continue;
          }
        }
        if (file.size > 100 * 1024 * 1024) {
          setError("请使用 100 MB 以内的文件。");
          continue;
        }
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        added.push({ id: crypto.randomUUID(), url, name: file.name, kind });
      }
      if (added.length) {
        setMedia((m) => [...m, ...added]);
        setMode(added[0].kind);
        setActiveId(added[0].id);
        setPlaying(false);
        setCompare(false);
      }
    },
    [recording.recordingVideo],
  );
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        void importFiles(files);
      }
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [importFiles]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea") || exportOpen) return;
      if (e.code === "Space" && isVideo) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key.toLowerCase() === "g") setGrid((g) => !g);
      if (e.key.toLowerCase() === "c") setCompare((c) => !c);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [isVideo, exportOpen]);
  function reset() {
    setPattern(1);
    setThreshold(128);
    setResolution(480);
    setPaletteId("paper");
    setInvert(false);
    setSerpentine(true);
    setContrast(0);
    setGamma(1);
    setHighlights(0);
    setBlur(0);
    setStrength(100);
    setScan("standard");
    setNotice("参数已复位");
  }
  function applyPreset(p: DitherPreset) {
    setPattern(p.pattern);
    setThreshold(p.threshold);
    setResolution(p.workingResolution);
    setInvert(p.invert);
    setSerpentine(p.serpentine);
    setPaletteId(p.paletteId ?? "paper");
    setNotice(`已载入「${p.name}」`);
  }
  function storePreset() {
    if (!presetName.trim()) return;
    const p = createPreset(presetName.trim(), {
      pattern,
      threshold,
      workingResolution: resolution,
      invert,
      serpentine,
      isErrorDiffusion: params.isErrorDiffusion,
      paletteId,
      activePaletteColors: palette ?? null,
    });
    const next = [...presets, p];
    setPresets(next);
    savePresets(next);
    setPresetName("");
    setNotice("预设已保存在此浏览器");
  }
  async function copySettings() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      p: String(pattern),
      t: String(threshold),
      r: String(resolution),
      palette: paletteId,
      invert: invert ? "1" : "0",
    }).toString();
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("参数链接已复制");
    } catch {
      setError("剪贴板不可用，请在支持剪贴板的浏览器中重试。");
    }
  }
  function seek(t: number) {
    if (recording.recordingVideo) return;
    videoHook.seekTo(t);
  }
  async function exportFrame() {
    if (!ready || exportBusy) return;
    setExportBusy(true);
    setError("");
    try {
      const c =
        isVideo && videoHook.videoElRef.current
          ? exportVideoFrameAtOriginalResolution({ videoElement: videoHook.videoElRef.current, ...params })
          : await exportAtOriginalResolution({ imageUrl: imageUrl ?? SAMPLE, ...params });
      const name = (active?.name ?? "afterimage-sample").replace(/\.[^.]+$/, "");
      if (frameFormat === "svg") {
        const { svg } = canvasToSVG(canvasRef.current!);
        const sizedSvg = svg.replace(
          /(<svg[^>]*?)width="[0-9]+" height="[0-9]+"/,
          `$1width="${c.width}" height="${c.height}"`,
        );
        download(new Blob([sizedSvg], { type: "image/svg+xml" }), `${name}-afterimage.svg`);
      } else {
        const mime = frameFormat === "jpg" ? "image/jpeg" : `image/${frameFormat}`;
        const blob = await new Promise<Blob>((resolve, reject) =>
          c.toBlob((b) => (b ? resolve(b) : reject(new Error("导出失败"))), mime, 0.95),
        );
        download(blob, `${name}-afterimage.${blob.type === "image/png" ? "png" : frameFormat}`);
      }
      setNotice("画面已导出");
    } catch {
      setError("导出未完成，请降低分辨率后重试。");
    } finally {
      setExportBusy(false);
    }
  }
  const displayColors = palette ?? [
    [0, 0, 0],
    [255, 255, 255],
  ];
  return (
    <div
      className={dark ? "studio night" : "studio"}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void importFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <a className="skip" href="#workspace">
        跳至工作区
      </a>
      <header className="masthead">
        <div className="brand">
          <a href={import.meta.env.BASE_URL} aria-label="余像 AFTERIMAGE 首页">
            <span className="wordmark">
              AFTERIMAGE<span className="brand-dot">.</span>
            </span>
            <span className="brand-cn">余像 / 像素暗房</span>
          </a>
        </div>
        <nav className="mode-switch" aria-label="媒体模式">
          <button
            aria-pressed={mode === "image"}
            onClick={() => switchMode("image")}
            disabled={recording.recordingVideo}
          >
            <FiImage />
            图像<span>IMAGE</span>
          </button>
          <button
            aria-pressed={mode === "video"}
            onClick={() => switchMode("video")}
            disabled={recording.recordingVideo}
          >
            <FiFilm />
            视频<span>VIDEO</span>
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="icon-button theme-button"
            aria-label={dark ? "切换浅色" : "切换深色"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <FiSun /> : <FiMoon />}
          </button>
          <button
            className="import-button"
            onClick={() => fileInput.current?.click()}
            disabled={recording.recordingVideo}
          >
            <FiPlus />
            导入素材<span>IMPORT</span>
          </button>
        </div>
      </header>
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept="image/*,video/*,.mov,.m4v"
        multiple
        aria-label="选择图片或视频"
        onChange={(e) => {
          void importFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="workspace" id="workspace">
        <main className="viewer-column">
          <div className="viewer-heading">
            <span className="eyebrow">01 / MONITOR</span>
            <div className="live-status">
              <i />
              {isVideo ? (playing ? "SIGNAL PLAYING" : "SIGNAL HELD") : "STILL SIGNAL"}
            </div>
          </div>
          <section className="monitor" ref={stage} aria-label="画面预览">
            <div className="monitor-topline">
              <span>{active ? "LOCAL SOURCE" : "DEMO STILL"}</span>
              <span>
                {String(pattern).padStart(2, "0")} / {selected.name.toUpperCase()}
              </span>
            </div>
            <div
              className={grid ? "media-shell with-grid" : "media-shell"}
              style={{
                aspectRatio: dimensions.width ? `${dimensions.width}/${dimensions.height}` : "1.499/1",
              }}
            >
              <canvas
                ref={imageHook.canvasRef}
                className={!isVideo ? "output-canvas" : "output-canvas hidden-canvas"}
                aria-label="抖色图像预览"
              />
              <canvas
                ref={videoHook.canvasRef}
                className={isVideo ? "output-canvas" : "output-canvas hidden-canvas"}
                aria-label="抖色视频预览"
              />
              {compare && (
                <div className="original-layer" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                  {isVideo ? (
                    <video ref={originalVideo} src={active!.url} muted playsInline preload="auto" />
                  ) : (
                    <img src={imageUrl ?? SAMPLE} alt="原始画面" />
                  )}
                  <span>原始画面</span>
                </div>
              )}
              {compare && (
                <>
                  <div className="compare-divider" style={{ left: `${split}%` }}>
                    <span />
                  </div>
                  <input
                    className="compare-slider"
                    type="range"
                    aria-label="对比位置"
                    min="0"
                    max="100"
                    value={split}
                    onChange={(e) => setSplit(Number(e.target.value))}
                  />
                </>
              )}
              {!ready && (
                <div className="loading-signal">
                  正在接收画面<span>ACQUIRING SIGNAL</span>
                </div>
              )}
            </div>
            <div className="monitor-bottomline">
              <span>
                {dimensions.width || "—"} × {dimensions.height || "—"}
                <span className="screen-divider">/</span>
                {resolution} PX
              </span>
              <span>{paletteId === "paper" ? "BONE WHITE" : paletteId.toUpperCase()}</span>
            </div>
          </section>
          <div className="transport">
            <div className="file-info">
              <span className="file-symbol">{isVideo ? <FiFilm /> : <FiImage />}</span>
              <div>
                <span className="filename" title={active?.name ?? "SWANS / 001"}>
                  {active?.name ?? "SWANS / 001"}
                </span>
                <span className="file-caption">{active ? "本地素材" : "示例静帧 · 可直接调节参数"}</span>
              </div>
            </div>
            <div className="transport-actions">
              <button
                className={compare ? "text-button is-active" : "text-button"}
                aria-pressed={compare}
                onClick={() => setCompare(!compare)}
              >
                原图对比<span>C</span>
              </button>
              <button
                className="icon-button"
                aria-label="全屏预览"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void stage.current?.requestFullscreen().catch(() => setNotice("当前浏览器不支持全屏"));
                }}
              >
                <FiMaximize />
              </button>
            </div>
          </div>
          {isVideo && (
            <div className="timeline">
              <button
                className="icon-button"
                aria-label={playing ? "暂停视频" : "播放视频"}
                disabled={!ready || recording.recordingVideo}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <FiPause /> : <FiPlay />}
              </button>
              <span>{time(videoHook.currentTime)}</span>
              <input
                aria-label="视频进度"
                type="range"
                min="0"
                max={videoHook.duration || 1}
                step="0.05"
                value={videoHook.currentTime}
                disabled={recording.recordingVideo}
                onChange={(e) => seek(Number(e.target.value))}
              />
              <span>{time(videoHook.duration)}</span>
              <label className="fps-label">
                <select
                  aria-label="预览帧率"
                  value={fps}
                  disabled={recording.recordingVideo}
                  onChange={(e) => setFps(Number(e.target.value))}
                >
                  {[6, 12, 24, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} FPS
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="material-strip">
            {media
              .filter((m) => m.kind === mode)
              .map((m) => (
                <div className={m.id === active?.id ? "material selected" : "material"} key={m.id}>
                  <button
                    onClick={() => {
                      setActiveId(m.id);
                      setPlaying(false);
                    }}
                    disabled={recording.recordingVideo}
                  >
                    {m.kind === "image" ? <img src={m.url} alt="" /> : <FiFilm />}
                    <span>{m.name}</span>
                  </button>
                  <button
                    aria-label={`移除 ${m.name}`}
                    className="remove-media"
                    disabled={recording.recordingVideo}
                    onClick={() => {
                      setMedia((list) => list.filter((item) => item.id !== m.id));
                      if (m.id === activeId) setActiveId(null);
                      setPlaying(false);
                      URL.revokeObjectURL(m.url);
                      urls.current.delete(m.url);
                    }}
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            <button
              className="add-source"
              onClick={() => fileInput.current?.click()}
              disabled={recording.recordingVideo}
            >
              <FiUpload />
              <span>
                {active ? "添加素材" : `导入${mode === "video" ? "视频" : "图片"}，让像素留下余像`}
                <small>{mode === "video" ? "MP4 / WEBM / MOV" : "PNG / JPG / WEBP / GIF"}</small>
              </span>
              <FiArrowUpRight />
            </button>
          </div>
          <div className="viewer-footnote">
            <span>拖入文件开始 / 粘贴亦可</span>
            <span>全部在本地处理，素材不上传</span>
          </div>
        </main>
        <aside className="controls">
          <div className="controls-heading">
            <span className="eyebrow">02 / DARKROOM</span>
            <button
              className="icon-button"
              aria-label="重置参数"
              title="重置参数"
              onClick={reset}
              disabled={recording.recordingVideo}
            >
              <FiRefreshCcw />
            </button>
          </div>
          <fieldset disabled={recording.recordingVideo} className="parameter-fields">
            <section className="control-section algorithm-section">
              <div className="section-title">
                <h2>抖色算法</h2>
                <span>ALGORITHM</span>
              </div>
              <select
                aria-label="抖色算法"
                className="algorithm-select"
                value={pattern}
                onChange={(e) => setPattern(Number(e.target.value))}
              >
                {["Error Diffusion", "Ordered", "Other"].map((category) => (
                  <optgroup key={category} label={category}>
                    {algorithms
                      .filter((a) => a.category === category)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <div className="quick-algorithms">
                {[
                  { id: 1, name: "Floyd" },
                  { id: 3, name: "Atkinson" },
                  { id: 2, name: "Bayer" },
                  { id: 25, name: "ASCII" },
                ].map((a) => (
                  <button key={a.id} aria-pressed={pattern === a.id} onClick={() => setPattern(a.id)}>
                    {a.name}
                  </button>
                ))}
              </div>
              <p className="algorithm-note">
                {selected.category === "Error Diffusion"
                  ? "把误差交给下一个像素。"
                  : selected.category === "Ordered"
                    ? "在规则的矩阵里，重建明暗。"
                    : "让影像换一种语言。"}
              </p>
            </section>
            {pattern === 26 && (
              <section className="control-section">
                <div className="section-title">
                  <h2>自定义扩散核</h2>
                  <span>KERNEL</span>
                </div>
                <div className="kernel-grid">
                  {kernel.flatMap((row, y) =>
                    row.map((cell, x) => (
                      <input
                        key={`${y}-${x}`}
                        type="number"
                        aria-label={`核权重 ${y + 1}-${x + 1}`}
                        min={-100}
                        max={100}
                        value={cell}
                        onChange={(e) =>
                          setKernel((old) =>
                            old.map((r, j) =>
                              r.map((v, i) =>
                                j === y && i === x
                                  ? Math.max(-100, Math.min(100, Number(e.target.value)))
                                  : v,
                              ),
                            ),
                          )
                        }
                      />
                    )),
                  )}
                </div>
                <label className="input-field">
                  除数
                  <input
                    aria-label="扩散核除数"
                    type="number"
                    min={1}
                    max={1000}
                    value={divisor}
                    onChange={(e) => setDivisor(Math.max(1, Number(e.target.value)))}
                  />
                </label>
              </section>
            )}
            <section className="control-section">
              <div className="section-title">
                <h2>光与颗粒</h2>
                <span>TONE & GRAIN</span>
              </div>
              <Range label="明暗阈值" value={threshold} min={0} max={255} onChange={setThreshold} />
              <Range
                label="像素精度"
                hint={`${resolution} px`}
                value={resolution}
                min={64}
                max={1920}
                step={16}
                onChange={setResolution}
              />
              <div className="scale-labels">
                <span>粗颗粒</span>
                <span>细颗粒</span>
              </div>
              <label className="toggle-row">
                <span>反转明暗</span>
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                <span className="toggle-track" aria-hidden="true" />
              </label>
            </section>
            <section className="control-section palette-section">
              <div className="section-title">
                <h2>色彩记忆</h2>
                <span>PALETTE</span>
              </div>
              <div className="palette-quick">
                {["paper", "mono", "amber", "gb", "red"].map((id) => {
                  const p = palettes.find((p) => p.id === id)!;
                  return (
                    <button
                      key={p.id}
                      aria-label={`${p.name}调色板`}
                      aria-pressed={paletteId === p.id}
                      disabled={!selected.supportsPalette}
                      title={p.name}
                      onClick={() => setPaletteId(p.id)}
                    >
                      <span className="palette-preview">
                        {p.colors.map((color, i) => (
                          <i key={i} style={{ backgroundColor: `rgb(${color.join(",")})` }} />
                        ))}
                      </span>
                      <span>{p.name.replace(" (4)", "")}</span>
                    </button>
                  );
                })}
              </div>
              <select
                className="palette-select"
                aria-label="更多调色板"
                value={paletteId}
                disabled={!selected.supportsPalette}
                onChange={(e) => setPaletteId(e.target.value)}
              >
                {palettes.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="custom">自定义双色</option>
              </select>
              {paletteId === "custom" && (
                <div className="custom-colors">
                  {customColors.map((c, i) => (
                    <label key={i}>
                      颜色 {i + 1}
                      <input
                        type="color"
                        aria-label={`自定义颜色 ${i + 1}`}
                        value={c}
                        onChange={(e) =>
                          setCustomColors((old) => old.map((v, n) => (n === i ? e.target.value : v)))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              {!selected.supportsPalette && <p className="small-note">此算法使用固定黑白色。</p>}
            </section>
            <details className="advanced">
              <summary>
                <span>
                  <FiSliders />
                  精细调整
                </span>
                <FiPlus />
              </summary>
              <div className="advanced-inner">
                <Range label="对比度" min={-100} max={100} value={contrast} onChange={setContrast} />
                <Range
                  label="中间调"
                  min={0.5}
                  max={2}
                  step={0.05}
                  hint={gamma.toFixed(2)}
                  value={gamma}
                  onChange={setGamma}
                />
                <Range label="高光压缩" min={0} max={100} value={highlights} onChange={setHighlights} />
                <Range label="柔化" min={0} max={5} step={0.1} value={blur} onChange={setBlur} />
                {selected.category === "Error Diffusion" && (
                  <>
                    <Range
                      label="误差扩散"
                      min={0}
                      max={150}
                      step={5}
                      hint={`${Math.round(strength)}%`}
                      value={strength}
                      onChange={setStrength}
                    />
                    <label className="toggle-row">
                      <span>蛇形扫描</span>
                      <input
                        type="checkbox"
                        checked={serpentine}
                        onChange={(e) => setSerpentine(e.target.checked)}
                      />
                      <span className="toggle-track" aria-hidden="true" />
                    </label>
                    <select
                      aria-label="扫描路径"
                      value={scan}
                      onChange={(e) => setScan(e.target.value as SerpentinePattern)}
                    >
                      <option value="standard">标准往复</option>
                      <option value="zigzag">对角折线</option>
                      <option value="spiral">螺旋</option>
                      <option value="hilbert">Hilbert 曲线</option>
                      <option value="vertical">垂直</option>
                    </select>
                  </>
                )}
                {pattern === 25 && (
                  <label className="input-field">
                    ASCII 字符
                    <input
                      value={asciiRamp}
                      maxLength={100}
                      onChange={(e) => setAsciiRamp(e.target.value || " .#")}
                    />
                  </label>
                )}
                <label className="toggle-row">
                  <span>像素网格</span>
                  <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
                  <span className="toggle-track" aria-hidden="true" />
                </label>
              </div>
            </details>
            <details className="advanced presets">
              <summary>
                <span>我的预设</span>
                <span className="preset-count">{presets.length.toString().padStart(2, "0")}</span>
              </summary>
              <div className="advanced-inner">
                <form
                  className="preset-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    storePreset();
                  }}
                >
                  <input
                    aria-label="预设名称"
                    placeholder="给这次实验命名"
                    maxLength={40}
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                  />
                  <button className="icon-button" aria-label="保存预设" disabled={!presetName.trim()}>
                    <FiPlus />
                  </button>
                </form>
                {presets.map((p) => (
                  <div className="preset-item" key={p.id}>
                    <button onClick={() => applyPreset(p)}>{p.name}</button>
                    <button
                      className="icon-button"
                      aria-label={`删除预设 ${p.name}`}
                      onClick={() => {
                        const next = presets.filter((item) => item.id !== p.id);
                        setPresets(next);
                        savePresets(next);
                      }}
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
                <button className="text-button copy-settings" onClick={() => void copySettings()}>
                  <FiCopy />
                  复制参数链接
                </button>
              </div>
            </details>
          </fieldset>
          <div className="export-area">
            <div className="output-info">
              <span>OUTPUT</span>
              <span>
                {displayColors.length} COLORS / {Math.min(resolution, dimensions.width || resolution)} PX
              </span>
            </div>
            <button
              className="export-button"
              disabled={!ready}
              onClick={() => {
                setDownloaded(false);
                setExportOpen(true);
              }}
            >
              <FiDownload />
              <span>导出{isVideo ? "影像" : "画面"}</span>
              <FiArrowUpRight />
            </button>
            <p>把此刻，留在像素里。</p>
          </div>
        </aside>
      </div>
      <footer className="colophon">
        <div>
          <span className="colophon-brand">AFTERIMAGE</span>
          <a href="https://www.kanshao2077.cn/" target="_blank" rel="noreferrer">
            @ 马路Milo
            <FiArrowUpRight />
          </a>
        </div>
        <span className="footer-center">AN EXPERIMENT IN DIGITAL MEMORY</span>
        <span className="edition-number">
          EST. 2026
          <span className="red-square" />
          VOL. 001
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <FiCheck />
          {notice}
        </div>
      )}
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button className="icon-button" aria-label="关闭错误提示" onClick={() => setError("")}>
            <FiX />
          </button>
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <FiUpload />
          <p>松开，接收新的画面。</p>
          <span>DROP TO IMPORT</span>
        </div>
      )}
      <dialog
        ref={dialog}
        className="export-dialog"
        onCancel={(e) => {
          if (recording.recordingVideo) e.preventDefault();
          else setExportOpen(false);
        }}
        onClose={() => setExportOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget && !recording.recordingVideo) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              setExportOpen(false);
          }
        }}
      >
        <div className="dialog-header">
          <span className="eyebrow">03 / OUTPUT</span>
          <button
            className="icon-button"
            aria-label="关闭导出"
            disabled={recording.recordingVideo}
            onClick={() => setExportOpen(false)}
          >
            <FiX />
          </button>
        </div>
        <h2>留住余像。</h2>
        <p className="dialog-description">
          {isVideo ? "导出当前帧，或记录整段抖色影像。" : "保留颗粒，以原图尺寸导出。"}
        </p>
        <label className="input-field">
          画面格式
          <select aria-label="画面格式" value={frameFormat} onChange={(e) => setFrameFormat(e.target.value)}>
            <option value="png">PNG / 无损图像</option>
            <option value="jpg">JPEG / 轻量图像</option>
            <option value="webp">WEBP / 网页图像</option>
            {!isVideo && <option value="svg">SVG / 像素矢量</option>}
          </select>
        </label>
        <button
          className="dialog-primary"
          disabled={exportBusy || recording.recordingVideo}
          onClick={() => void exportFrame()}
        >
          <FiDownload />
          {exportBusy ? "正在导出…" : isVideo ? "导出当前帧" : "导出图像"}
        </button>
        {isVideo && (
          <div className="video-export">
            <label className="input-field">
              视频格式
              <select
                aria-label="视频格式"
                value={recording.videoExportFormat}
                disabled={recording.recordingVideo}
                onChange={(e) => recording.setVideoExportFormat(e.target.value as "mp4" | "webm" | "gif")}
              >
                <option value="mp4">MP4</option>
                <option value="webm">WEBM</option>
                <option value="gif">GIF</option>
              </select>
            </label>
            {recording.recordingVideo ? (
              <>
                <progress max="1" value={recording.recordingProgress} />
                <p className="small-note">
                  正在记录 {Math.round(recording.recordingProgress * 100)}% · 请保持本页打开
                </p>
                <button className="dialog-secondary" onClick={recording.cancelVideoExport}>
                  停止记录
                </button>
              </>
            ) : (
              <button
                className="dialog-primary"
                disabled={!ready || exportBusy}
                onClick={() => {
                  setDownloaded(false);
                  void recording.startVideoExport();
                }}
              >
                <FiFilm />
                记录整段视频
              </button>
            )}
            {recording.recordedBlobUrl && !recording.recordingVideo && (
              <a
                className="dialog-secondary download-video"
                href={recording.recordedBlobUrl}
                download={`afterimage.${recording.videoExportFormat === "gif" ? "gif" : recording.recordingMimeRef.current.includes("mp4") ? "mp4" : "webm"}`}
                onClick={() => setDownloaded(true)}
              >
                {downloaded ? <FiCheck /> : <FiDownload />}
                {downloaded ? "已下载，可再次保存" : "下载生成的视频"}
              </a>
            )}
            {recording.videoFormatNote && <p className="small-note">{recording.videoFormatNote}</p>}
            {recording.recordingError && (
              <p role="alert" className="inline-error">
                {recording.recordingError}
              </p>
            )}
            <p className="small-note">静音导出 · 编码支持取决于浏览器，MP4 不可用时自动使用 WebM。</p>
          </div>
        )}
      </dialog>
    </div>
  );
}
