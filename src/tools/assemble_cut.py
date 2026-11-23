"""Local rough cut. Input/output stay in the work; no provider or network calls."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


def atomic_json(path, value):
    if path.exists():
        existing = json.loads(path.read_text(encoding='utf-8'))
        if existing.get('id') != value.get('id'):
            raise RuntimeError('装配任务已被替换，停止写入旧任务')
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for attempt in range(5):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            if attempt == 4:
                raise
            time.sleep(0.1 * (attempt + 1))


def run(args, cwd=None):
    result = subprocess.run(args, capture_output=True, encoding='utf-8', errors='replace',
                            timeout=1800, cwd=cwd, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise RuntimeError(result.stderr[-2400:] or '媒体处理失败')
    return result.stdout


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))


def within(root, path):
    target = (root / path).resolve()
    target.relative_to(root)
    return target


def main():
    root = Path(sys.argv[1]).resolve()
    job_path = within(root, sys.argv[2])
    job = json.loads(job_path.read_text(encoding='utf-8'))
    width, height = job['width'], job['height']
    job['workerPid'] = os.getpid()
    atomic_json(job_path, job)
    folder = job_path.parent / job['id']
    scratch = folder / 'segments'
    scratch.mkdir(exist_ok=True)
    try:
        for tool in ['ffmpeg', 'ffprobe']:
            if not shutil.which(tool):
                raise RuntimeError(f'找不到 {tool}，请安装并加入 PATH 后重试')
        for index, shot in enumerate(job['shots']):
            source = within(root, shot['path'])
            info = probe(source)
            video = next((s for s in info['streams'] if s['codec_type'] == 'video'), None)
            if video is None:
                raise RuntimeError(f"镜头 {shot['id']} 没有可读取的视频流")
            duration = float(video.get('duration') or info['format'].get('duration') or 0)
            if duration <= 0:
                raise RuntimeError(f"镜头 {shot['id']} 无法读取时长")
            has_audio = any(s['codec_type'] == 'audio' for s in info['streams'])
            args = ['ffmpeg', '-v', 'error', '-nostdin', '-y', '-threads', '2', '-i', str(source)]
            if not has_audio:
                args += ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
            args += ['-map', '0:v:0', '-map', '0:a:0' if has_audio else '1:a:0',
                     '-vf', f'scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24',
                     '-af', 'aresample=48000,apad', '-t', str(duration), '-c:v', 'libx264',
                     '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2',
                     '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-avoid_negative_ts', 'make_zero',
                     str(scratch / f'{index:06d}.mp4')]
            run(args)
            job['completed'] = index + 1
            job['message'] = f"已处理 {index + 1} / {len(job['shots'])} 镜"
            atomic_json(job_path, job)
        listing = scratch / 'concat.txt'
        listing.write_text(''.join(f"file '{index:06d}.mp4'\n" for index in range(len(job['shots']))), encoding='utf-8')
        output = within(root, job['output'])
        output.parent.mkdir(exist_ok=True, parents=True)
        # Relative concat URL avoids treating a # in a Windows parent path as a URL fragment.
        run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '1', '-i', 'concat.txt',
             '-vf', 'fps=24', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
             '-threads', '2', '-af', 'aresample=48000:async=1', '-c:a', 'aac', '-ar', '48000', '-ac', '2',
             '-movflags', '+faststart', str(output)], cwd=scratch)
        info = probe(output)
        sha = hashlib.sha256()
        with output.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                sha.update(block)
        job['result'] = {'durationSec': float(info['format']['duration']), 'bytes': output.stat().st_size,
                         'sha256': sha.hexdigest(), 'hasAudio': True}
        job['message'] = '视频已完成，正在登记资产'
        atomic_json(job_path, job)
    except Exception as exc:
        job['status'] = 'failed'
        job['message'] = str(exc)
        atomic_json(job_path, job)
        raise
    finally:
        shutil.rmtree(scratch, ignore_errors=True)


if __name__ == '__main__':
    main()
