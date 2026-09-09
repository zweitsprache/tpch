"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize01, Play } from "@untitled-ui/icons-react";

type MediaPlayerProps = {
  src: string;
  title: string;
  kind: "audio" | "video";
  poster?: string;
};

function PauseIcon({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function useExclusivePlayback(mediaRef: React.RefObject<HTMLMediaElement | null>) {
  useEffect(() => {
    function stopOtherMedia(event: Event) {
      const source = (event as CustomEvent<HTMLMediaElement>).detail;
      const media = mediaRef.current;

      if (media && source !== media) {
        media.pause();
        media.currentTime = 0;
      }
    }

    document.addEventListener("media-play", stopOtherMedia);
    return () => document.removeEventListener("media-play", stopOtherMedia);
  }, [mediaRef]);
}

function notifyMediaPlay(media: HTMLMediaElement | null) {
  if (media) {
    document.dispatchEvent(new CustomEvent("media-play", { detail: media }));
  }
}

function MinimalAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useExclusivePlayback(audioRef);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  return (
    <div className="flex w-full items-center gap-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => {
          notifyMediaPlay(audioRef.current);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={() => {
          if (isPlaying) {
            audioRef.current?.pause();
          } else {
            audioRef.current?.play();
          }
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f13b3b] text-white"
      >
        {isPlaying ? <PauseIcon width={16} height={16} /> : <Play width={16} height={16} className="ml-0.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (audioRef.current) {
            audioRef.current.currentTime = value;
          }
          setCurrentTime(value);
        }}
        aria-label="Seek"
        className="media-progress h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
        style={{
            background: `linear-gradient(to right, #f13b3b ${(currentTime / (duration || 1)) * 100}%, #e3e7eb ${(currentTime / (duration || 1)) * 100}%)`,
        }}
      />
      <span className="shrink-0 text-xs tabular-nums text-[#17212b]">
        {formatTime(currentTime)}
      </span>
    </div>
  );
}

function MinimalVideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useExclusivePlayback(videoRef);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [isPlaying]);

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-black"
          : "relative overflow-hidden rounded-lg bg-black"
      }
    >
      <div className={isFullscreen ? "relative min-h-0 flex-1" : "relative aspect-video w-full"}>
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          preload="auto"
          playsInline
          disablePictureInPicture
          className={`h-full w-full object-contain ${!isPlaying && poster ? "opacity-0" : ""}`}
          onPlay={() => {
            notifyMediaPlay(videoRef.current);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        />
        {!isPlaying && poster && (
          <button
            type="button"
            onClick={() => videoRef.current?.play()}
            aria-label="Play video"
            className="absolute inset-0 z-10 block h-full w-full bg-black"
          >
            <img src={poster} alt="Video preview" className="h-full w-full object-contain" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 bg-[#e3e7eb] px-3 py-2 text-[#17212b]">
        <button
          type="button"
          onClick={() => {
            if (isPlaying) {
              videoRef.current?.pause();
            } else {
              videoRef.current?.play();
            }
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f13b3b] text-white"
        >
          {isPlaying ? <PauseIcon width={14} height={14} /> : <Play width={14} height={14} className="ml-0.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (videoRef.current) {
              videoRef.current.currentTime = value;
            }
            setCurrentTime(value);
          }}
          aria-label="Seek"
          className="media-progress h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, #f13b3b ${(currentTime / (duration || 1)) * 100}%, #ffffff ${(currentTime / (duration || 1)) * 100}%)`,
          }}
        />
        <span className="shrink-0 text-xs tabular-nums text-[#17212b]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button
          type="button"
          onClick={() => setIsFullscreen((fullscreen) => !fullscreen)}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-[#17212b]"
        >
          <Maximize01 width={18} height={18} />
        </button>
      </div>
    </div>
  );
}

export function MediaPlayer({ src, kind, poster }: MediaPlayerProps) {
  if (kind === "video") {
    return <MinimalVideoPlayer src={src} poster={poster} />;
  }

  return <MinimalAudioPlayer src={src} />;
}

