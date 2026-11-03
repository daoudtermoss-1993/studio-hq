"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function UploadRecording({ reelId, labels }: { reelId: string; labels: { upload: string; uploading: string; uploaded: string } }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  function send(file: File) {
    setMsg("");
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/reels/${reelId}/recording`);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status < 300) {
        setMsg(labels.uploaded);
        router.refresh();
      } else setMsg(xhr.responseText || `Error ${xhr.status}`);
    };
    xhr.onerror = () => {
      setProgress(null);
      setMsg("Network error");
    };
    xhr.send(file);
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" data-testid="recording-input"
        onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      <button type="button" className="btn-gold" disabled={progress !== null} onClick={() => input.current?.click()}>
        {progress === null ? `⬆ ${labels.upload}` : `${labels.uploading} ${progress}%`}
      </button>
      {progress !== null && (
        <div className="h-2 w-full max-w-xs overflow-hidden rounded bg-ink" dir="ltr"><div className="h-full bg-gold" style={{ width: `${progress}%` }} /></div>
      )}
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
