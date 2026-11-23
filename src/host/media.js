/** Shared asset identity: current_version is authoritative, never substitute an old take. */
export function videoVersion(asset) {
  const explicit = Number(asset?.version)
  if (Number.isInteger(explicit) && explicit > 0) return explicit
  const match = /_v(\d+)(?:\.[^.]+)?$/i.exec(String(asset?.path ?? ''))
    ?? /_v(\d+)$/i.exec(String(asset?.id ?? ''))
  return match ? Number(match[1]) : undefined
}

export function shotVideos(work, shot) {
  return (work.assets ?? []).filter(a => a.type === 'video' && a.shot_id === shot.id)
}

export function currentVideo(work, shot) {
  const videos = shotVideos(work, shot).filter(a => a.status !== 'deprecated')
  const version = Number(shot.current_version)
  if (!Number.isInteger(version) || version < 1) return undefined
  const matches = videos.filter(a => videoVersion(a) === version)
  return matches.length === 1 ? matches[0] : undefined
}

export function isFinalVideo(asset) {
  return asset?.type === 'video' && asset.status !== 'deprecated'
    && (asset.purpose === 'final' || (typeof asset.path === 'string' && asset.path.includes('final')))
}
