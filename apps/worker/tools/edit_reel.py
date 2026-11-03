#!/usr/bin/env python3
"""Auto-edit a talking-head reel: cut silences, transcribe, burn subtitles, export 9:16.

  python3 tools/edit_reel.py raw/051.mp4 --out content/reels/051-slug/edit --lang ar

Outputs in --out:  cut.mp4, captions.srt, final.mp4, report.json
Needs: ffmpeg (with libass) and, for subtitles, `pip install faster-whisper`.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys


def run(cmd, cwd=None):
    return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)


def duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float(r.stdout.strip())


def speech_segments(path, noise, min_sil, pad, dur):
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
             "-af", f"silencedetect=noise={noise}dB:d={min_sil}", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    keep, t = [], 0.0
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else dur
        if s > t:
            keep.append((t, s))
        t = max(t, e)
    if t < dur:
        keep.append((t, dur))
    merged = []
    for s, e in keep:
        s, e = max(0.0, s - pad), min(dur, e + pad)
        if e - s < 0.2:
            continue
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def cut(src, dst, segments):
    expr = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in segments)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", src,
           "-vf", f"fps=30,select='{expr}',setpts=N/FRAME_RATE/TB",
           "-af", f"aselect='{expr}',asetpts=N/SR/TB",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "160k", dst]
    r = run(cmd)
    if r.returncode != 0:
        sys.exit(f"ffmpeg cut failed:\n{r.stderr[-2000:]}")


def ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def transcribe(path, lang, model_name, max_words):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None, "faster-whisper not installed (pip install faster-whisper): no subtitles"
    try:
        model = WhisperModel(model_name, device="auto", compute_type="int8")
        segments, _ = model.transcribe(path, language=lang or None, word_timestamps=True, vad_filter=True)
        words = [w for seg in segments for w in (seg.words or [])]
    except Exception as exc:  # model download blocked, no internet, corrupt file...
        return None, f"transcription failed ({type(exc).__name__}: {str(exc)[:200]}): no subtitles"
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        long_enough = len(cur) >= max_words or (cur[-1].end - cur[0].start) > 1.8
        if long_enough or w.word.strip().endswith((".", "؟", "?", "!", "،", ",")):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return [(c[0].start, c[-1].end, "".join(w.word for w in c).strip()) for c in chunks], None


def write_srt(chunks, path):
    with open(path, "w", encoding="utf-8") as f:
        for i, (s, e, text) in enumerate(chunks, 1):
            f.write(f"{i}\n{ts(s)} --> {ts(max(e, s + 0.3))}\n{text}\n\n")


def final(src, out_dir, srt, args):
    if args.fit == "crop":
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
    else:
        vf = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
    if srt:
        style = (f"FontName={args.font},FontSize={args.size},Bold=1,PrimaryColour=&H00FFFFFF,"
                 "OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,"
                 f"MarginV={args.margin}")
        sub = f"subtitles={os.path.basename(srt)}:force_style='{style}'"
        if args.fonts_dir:
            sub += f":fontsdir={os.path.abspath(args.fonts_dir)}"
        vf += "," + sub
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", os.path.abspath(src), "-vf", vf,
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k",
           "-movflags", "+faststart", "final.mp4"]
    r = run(cmd, cwd=out_dir)
    if r.returncode != 0:
        sys.exit(f"ffmpeg final export failed:\n{r.stderr[-2000:]}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("input")
    p.add_argument("--out", required=True)
    p.add_argument("--lang", default="ar")
    p.add_argument("--model", default="small")
    p.add_argument("--noise", type=float, default=-35)
    p.add_argument("--min-silence", type=float, default=0.45)
    p.add_argument("--pad", type=float, default=0.12)
    p.add_argument("--words", type=int, default=4)
    p.add_argument("--no-cut", action="store_true")
    p.add_argument("--no-subs", action="store_true")
    p.add_argument("--srt", help="use this SRT instead of transcribing (re-burn after corrections)")
    p.add_argument("--font", default="Cairo")
    p.add_argument("--fonts-dir")
    p.add_argument("--size", type=int, default=12)
    p.add_argument("--margin", type=int, default=80)
    p.add_argument("--fit", choices=["crop", "pad"], default="crop")
    p.add_argument("--trim-start", type=float, default=0.0, help="seconds removed from the start of the edit")
    p.add_argument("--trim-end", type=float, default=0.0, help="seconds removed from the end of the edit")
    args = p.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found")
    os.makedirs(args.out, exist_ok=True)
    report = {"input": args.input, "warnings": []}
    din = duration(args.input)
    report["duration_in"] = round(din, 2)

    cut_path = os.path.join(args.out, "cut.mp4")
    if args.no_cut:
        shutil.copyfile(args.input, cut_path)
        report["segments"] = [[0, round(din, 2)]]
    elif args.srt and os.path.exists(cut_path) and os.path.getmtime(cut_path) > os.path.getmtime(args.input):
        report["segments"] = "reused existing cut.mp4"
    else:
        segs = speech_segments(args.input, args.noise, args.min_silence, args.pad, din)
        if not segs:
            sys.exit("no speech detected - try --noise -45")
        cut(args.input, cut_path, segs)
        report["segments"] = [[round(s, 2), round(e, 2)] for s, e in segs]
    if args.trim_start or args.trim_end:
        trimmed = os.path.join(args.out, "cut_trim.mp4")
        d = duration(cut_path)
        end = max(0.5, d - args.trim_end)
        r = run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{args.trim_start:.3f}", "-to", f"{end:.3f}",
                 "-i", cut_path, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "160k", trimmed])
        if r.returncode != 0:
            sys.exit(f"ffmpeg trim failed:\n{r.stderr[-2000:]}")
        os.replace(trimmed, cut_path)
        report["trimmed"] = [args.trim_start, args.trim_end]
    dout = duration(cut_path)
    report["duration_out"] = round(dout, 2)
    report["removed_seconds"] = round(din - dout, 2)

    srt_path = os.path.join(args.out, "captions.srt")
    if args.no_subs:
        srt_path = None
    elif args.srt:
        if os.path.abspath(args.srt) != os.path.abspath(srt_path):
            shutil.copyfile(args.srt, srt_path)
    else:
        chunks, warn = transcribe(cut_path, args.lang, args.model, args.words)
        if warn:
            report["warnings"].append(warn)
            srt_path = None
        else:
            write_srt(chunks, srt_path)
            report["transcript"] = " ".join(c[2] for c in chunks)

    final(cut_path, args.out, srt_path, args)
    report["final"] = os.path.join(args.out, "final.mp4")
    report["subtitles"] = bool(srt_path)
    json.dump(report, open(os.path.join(args.out, "report.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    print(json.dumps({k: v for k, v in report.items() if k not in ("segments", "transcript")},
                     ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
