/** Browser-local animation capture. No upload, camera, microphone, or server. */
export const ANIMATION_RESOLUTIONS = [
  { id: "720p", name: "HD · 720p" },
  { id: "1080p", name: "Full HD · 1080p" },
  { id: "1440p", name: "QHD · 1440p" },
  { id: "4k", name: "4K UHD" },
] as const;
export type AnimationResolution = (typeof ANIMATION_RESOLUTIONS)[number]["id"];
export const ANIMATION_FRAME_RATES = [24, 30, 60, 120, 144, 240] as const;
export type AnimationFps = (typeof ANIMATION_FRAME_RATES)[number];
export const MAX_ANIMATION_BYTES = 128 * 1024 * 1024;

export type AnimationOptions = {
  width: number;
  height: number;
  duration: 6 | 10;
  fps: AnimationFps;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

export function getAnimationSize(
  format: { width: number; height: number },
  resolution: AnimationResolution,
) {
  const sizes = {
    "720p": { long: 1280, square: 720 },
    "1080p": { long: 1920, square: 1080 },
    "1440p": { long: 2560, square: 1440 },
    "4k": { long: 3840, square: 2160 },
  };
  const target = sizes[resolution];
  if (
    !target ||
    !Number.isFinite(format.width) ||
    !Number.isFinite(format.height) ||
    format.width <= 0 ||
    format.height <= 0
  )
    throw new Error("Choose a valid wallpaper format and resolution.");
  const scale =
    format.width === format.height
      ? target.square / format.width
      : target.long / Math.max(format.width, format.height);
  return {
    width: Math.round((format.width * scale) / 2) * 2,
    height: Math.round((format.height * scale) / 2) * 2,
  };
}

export function getAnimationBitrate(
  options: Pick<AnimationOptions, "width" | "height" | "fps">,
) {
  return Math.round(
    Math.min(
      80_000_000,
      Math.max(4_500_000, options.width * options.height * options.fps * 0.14),
    ),
  );
}

export function getAnimationSupport(): {
  supported: boolean;
  mimeType: string | null;
  frameAccurate: boolean;
} {
  const frameAccurate =
    typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
  if (
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement === "undefined" ||
    typeof HTMLCanvasElement.prototype.captureStream !== "function"
  )
    return { supported: frameAccurate, mimeType: null, frameAccurate };
  const mimeType =
    ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    ) ?? null;
  return {
    supported: frameAccurate || mimeType !== null,
    mimeType,
    frameAccurate,
  };
}

export function validateAnimationOptions(options: AnimationOptions) {
  if (
    !Number.isInteger(options.width) ||
    !Number.isInteger(options.height) ||
    options.width < 16 ||
    options.height < 16 ||
    options.width % 2 !== 0 ||
    options.height % 2 !== 0 ||
    options.width > 3840 ||
    options.height > 3840 ||
    options.width * options.height > 8_300_000 ||
    ![6, 10].includes(options.duration) ||
    !ANIMATION_FRAME_RATES.includes(options.fps)
  )
    throw new Error(
      "Choose a 6 or 10 second animation up to 4K at 24, 30, 60, 120, 144, or 240 fps, with even dimensions.",
    );
}

const codecChecks = new Map<
  string,
  Promise<import("mediabunny").VideoCodec | null>
>();
function canRecordRealtime(options: AnimationOptions, mimeType: string | null) {
  return (
    mimeType !== null &&
    options.width <= 1280 &&
    options.height <= 1280 &&
    options.width * options.height <= 1_000_000 &&
    options.fps === 24
  );
}

async function selectFrameCodec(options: AnimationOptions) {
  const key = `${options.width}x${options.height}:${options.fps}`;
  let check = codecChecks.get(key);
  if (!check) {
    check = import("mediabunny").then(
      ({ getFirstEncodableVideoCodec, Quality }) =>
        getFirstEncodableVideoCodec(["vp9", "vp8"], {
          width: options.width,
          height: options.height,
          frameRate: options.fps,
          quality: new Quality({ bitrate: getAnimationBitrate(options) }),
        }),
    );
    codecChecks.set(key, check);
    check.catch(() => codecChecks.delete(key));
  }
  return check;
}

/** Probe the selected encoder before allocating a large GPU buffer. */
export async function assertAnimationSupported(options: AnimationOptions) {
  validateAnimationOptions(options);
  if (options.signal?.aborted)
    throw new DOMException("Animation export cancelled.", "AbortError");
  const support = getAnimationSupport();
  if (support.frameAccurate) {
    if (
      !(await selectFrameCodec(options)) &&
      !canRecordRealtime(options, support.mimeType)
    )
      throw new Error(
        "This browser cannot encode that resolution and frame rate. Try a lower resolution or frame rate.",
      );
  } else if (!support.mimeType) {
    throw new Error(
      "WebM export is unavailable in this browser. PNG export is still available.",
    );
  } else if (!canRecordRealtime(options, support.mimeType)) {
    throw new Error(
      "High-resolution and high-frame-rate export needs a browser with WebCodecs. Choose HD at 24 fps for basic export.",
    );
  }
  if (options.signal?.aborted)
    throw new DOMException("Animation export cancelled.", "AbortError");
}

/** Every frame is rendered at its video timestamp, independent of device speed. */
export async function recordAnimation(args: {
  canvas: HTMLCanvasElement;
  options: AnimationOptions;
  renderFrame: (seconds: number) => void;
}): Promise<Blob> {
  await assertAnimationSupported(args.options);
  return getAnimationSupport().frameAccurate &&
    (await selectFrameCodec(args.options))
    ? renderFrameAnimation(args)
    : recordRealtimeAnimation(args);
}

async function renderFrameAnimation({
  canvas,
  options,
  renderFrame,
}: {
  canvas: HTMLCanvasElement;
  options: AnimationOptions;
  renderFrame: (seconds: number) => void;
}): Promise<Blob> {
  const { BufferTarget, CanvasSource, Output, Quality, WebMOutputFormat } =
    await import("mediabunny");
  const codec = await selectFrameCodec(options);
  if (!codec)
    throw new Error(
      "The selected animation encoder is unavailable. Try a lower quality.",
    );
  if (document.hidden)
    throw new Error("Keep this tab visible while exporting an animation.");
  const recordingCanvas = document.createElement("canvas");
  recordingCanvas.width = options.width;
  recordingCanvas.height = options.height;
  const context = recordingCanvas.getContext("2d", { alpha: false });
  if (!context)
    throw new Error("This browser could not create an animation canvas.");
  const output = new Output({
    format: new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  let bytes = 0;
  let encodedFrameCount = 0;
  let failure: Error | null = null;
  let timer = 0;
  let finalization: Promise<void> | null = null;
  let rejectFailure: (error: Error) => void = () => {};
  const failed = new Promise<never>((_, reject) => {
    rejectFailure = reject;
  });
  // An event may fire between awaited operations. Keep that rejection handled.
  void failed.catch(() => {});
  const stop = (error: Error) => {
    if (failure) return;
    failure = error;
    rejectFailure(error);
    void output.cancel().catch(() => {});
  };
  const abort = () =>
    stop(new DOMException("Animation export cancelled.", "AbortError"));
  const visibility = () => {
    if (document.hidden)
      stop(
        new Error(
          "Export stopped because the tab was hidden. Keep it visible and try again.",
        ),
      );
  };
  const contextLost = () =>
    stop(
      new Error(
        "The 3D renderer was interrupted. Reload the preview and try again.",
      ),
    );
  const checkpoint = () => {
    if (options.signal?.aborted) abort();
    if (failure) throw failure;
    clearTimeout(timer);
    timer = window.setTimeout(
      () =>
        stop(
          new Error(
            "The video encoder stopped responding. Try a lower resolution or frame rate.",
          ),
        ),
      60_000,
    );
  };
  const wait = <T>(work: Promise<T>) => Promise.race([work, failed]);
  const source = new CanvasSource(recordingCanvas, {
    codec,
    quality: new Quality({ bitrate: getAnimationBitrate(options) }),
    latencyMode: "quality",
    onEncodedPacket(packet) {
      encodedFrameCount++;
      bytes += packet.byteLength;
      if (bytes > MAX_ANIMATION_BYTES)
        stop(
          new Error(
            "The animation exceeded 128 MB. Try a shorter loop or lower resolution.",
          ),
        );
    },
  });
  output.addVideoTrack(source, { frameRate: options.fps });
  options.signal?.addEventListener("abort", abort, { once: true });
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", abort);
  canvas.addEventListener("webglcontextlost", contextLost);
  try {
    checkpoint();
    await wait(output.start());
    const frameCount = options.duration * options.fps;
    for (let frame = 0; frame < frameCount; frame++) {
      checkpoint();
      renderFrame(frame / options.fps);
      context.drawImage(canvas, 0, 0, options.width, options.height);
      await wait(source.add(frame / options.fps, 1 / options.fps));
      if (failure) throw failure;
      options.onProgress?.(((frame + 1) / frameCount) * 0.97);
      // Allow progress, input and visibility events even with a fast encoder.
      if (frame % 4 === 0)
        await wait(
          new Promise<void>((resolve) => window.setTimeout(resolve, 0)),
        );
    }
    checkpoint();
    finalization = output.finalize();
    await wait(finalization);
    if (failure) throw failure;
    if (encodedFrameCount !== options.duration * options.fps)
      throw new Error(
        "The encoder did not retain every requested frame. Try a lower frame rate or resolution.",
      );
    const buffer = output.target.buffer;
    if (!buffer?.byteLength || buffer.byteLength > MAX_ANIMATION_BYTES)
      throw new Error(
        "The encoder could not produce an animation within the export size limit.",
      );
    options.onProgress?.(1);
    return new Blob([buffer], { type: "video/webm" });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", abort);
    canvas.removeEventListener("webglcontextlost", contextLost);
    // Mediabunny cannot cancel once finalization starts. Keep the caller busy
    // until its flush settles, including when cancellation wins the race, so a
    // retry cannot overlap a still-running encoder. Failed exports are discarded.
    if (finalization) await finalization.catch(() => {});
    else if (output.state !== "finalized")
      await output.cancel().catch(() => {});
    recordingCanvas.width = 0;
    recordingCanvas.height = 0;
  }
}

/**
 * Calls the renderer with elapsed loop time, then copies actual artwork into a
 * dedicated recording canvas. The owner snapshots/restores its renderer in a
 * finally block. Capture is real-time; keeping the tab visible is required.
 */
async function recordRealtimeAnimation({
  canvas,
  options,
  renderFrame,
}: {
  canvas: HTMLCanvasElement;
  options: AnimationOptions;
  renderFrame: (seconds: number) => void;
}): Promise<Blob> {
  validateAnimationOptions(options);
  const support = getAnimationSupport();
  if (!support.supported || !support.mimeType)
    throw new Error(
      "WebM animation export is unavailable in this browser. PNG export is still available.",
    );
  if (options.signal?.aborted)
    throw new DOMException("Animation export cancelled.", "AbortError");
  if (document.hidden)
    throw new Error("Keep this tab visible while exporting an animation.");

  const output = document.createElement("canvas");
  output.width = options.width;
  output.height = options.height;
  const context = output.getContext("2d", { alpha: false });
  if (!context)
    throw new Error("This browser could not create an animation canvas.");
  const paint = (seconds: number) => {
    renderFrame(seconds);
    context.drawImage(canvas, 0, 0, output.width, output.height);
  };
  paint(0);
  let stream: MediaStream;
  try {
    stream = output.captureStream(options.fps);
  } catch {
    throw new Error(
      "This browser could not capture the artwork. Try PNG export instead.",
    );
  }
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: support.mimeType,
      videoBitsPerSecond: 4_500_000,
    });
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error(
      "The video encoder could not start. Try another browser or download a PNG.",
    );
  }

  return new Promise<Blob>((resolve, reject) => {
    const chunks: Blob[] = [];
    let bytes = 0;
    let animationFrame = 0;
    let watchdog = 0;
    let settled = false;
    let stopping = false;
    let lastFrame = -1;
    let started = 0;
    const cleanup = () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(watchdog);
      options.signal?.removeEventListener("abort", abort);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", abort);
      canvas.removeEventListener("webglcontextlost", contextLost);
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      output.width = 0;
      output.height = 0;
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        error instanceof Error
          ? error
          : new Error("Animation export failed. Please try again."),
      );
    };
    const abort = () =>
      fail(new DOMException("Animation export cancelled.", "AbortError"));
    const visibility = () => {
      if (document.hidden)
        fail(
          new Error(
            "Animation export stopped because the tab was hidden. Keep it visible and try again.",
          ),
        );
    };
    const contextLost = () =>
      fail(
        new Error(
          "The 3D renderer was interrupted. Reload the preview and try again.",
        ),
      );
    const finish = () => {
      if (stopping || settled) return;
      stopping = true;
      cancelAnimationFrame(animationFrame);
      recorder.stop();
    };
    const step = (now: number) => {
      if (settled || stopping) return;
      try {
        const elapsed = Math.max(0, (now - started) / 1000);
        if (elapsed >= options.duration) {
          finish();
          return;
        }
        const frame = Math.floor(elapsed * options.fps);
        if (frame !== lastFrame) {
          paint(frame / options.fps);
          lastFrame = frame;
          options.onProgress?.(Math.min(0.99, elapsed / options.duration));
        }
        animationFrame = requestAnimationFrame(step);
      } catch (error) {
        fail(error);
      }
    };
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
        bytes += event.data.size;
        if (bytes > 32_000_000)
          fail(
            new Error(
              "The animation exceeded the browser export size limit. Try a shorter loop.",
            ),
          );
      }
    };
    recorder.onerror = () =>
      fail(
        new Error(
          "The video encoder failed. Try another browser or download a PNG.",
        ),
      );
    recorder.onstop = () => {
      if (settled) return;
      if (!stopping) {
        fail(
          new Error(
            "The video encoder stopped before the animation was complete.",
          ),
        );
        return;
      }
      const blob = new Blob(chunks, { type: "video/webm" });
      if (!blob.size) {
        fail(
          new Error(
            "The browser produced an empty animation. Please try again.",
          ),
        );
        return;
      }
      settled = true;
      cleanup();
      options.onProgress?.(1);
      resolve(blob);
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", abort, { once: true });
    canvas.addEventListener("webglcontextlost", contextLost);
    try {
      recorder.start(1000);
      started = performance.now();
      options.onProgress?.(0);
      watchdog = window.setTimeout(
        () =>
          fail(new Error("The animation encoder timed out. Please try again.")),
        (options.duration + 8) * 1000,
      );
      animationFrame = requestAnimationFrame(step);
    } catch (error) {
      fail(error);
    }
  });
}
