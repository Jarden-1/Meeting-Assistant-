import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type EnhancementChunkResponse } from '../api'
import type { EnhancementAudioChunk } from './audio/AudioCapture'

const DEFAULT_CHUNK_SECONDS = 600
const DEFAULT_OVERLAP_SECONDS = 120

export function useEnhancementChunks(authToken: string | null, sessionId: string | null, notify: (message: string) => void) {
  const chunkSeconds = Number(import.meta.env.VITE_ENHANCEMENT_CHUNK_SECONDS ?? DEFAULT_CHUNK_SECONDS)
  const overlapSeconds = Number(import.meta.env.VITE_ENHANCEMENT_OVERLAP_SECONDS ?? DEFAULT_OVERLAP_SECONDS)
  const [status, setStatus] = useState('精修待开始')
  const [chunks, setChunks] = useState<EnhancementChunkResponse[]>([])
  const nextChunkIndexRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!authToken || !sessionId) return
    try {
      const result = await api.listEnhancementChunks(authToken, sessionId)
      setChunks(result.items)
      nextChunkIndexRef.current = Math.max(nextChunkIndexRef.current, ...result.items.map((item) => item.chunkIndex + 1), 0)
    } catch {
      // 精修状态只是辅助信息，查询失败不影响实时会议。
    }
  }, [authToken, sessionId])

  useEffect(() => {
    if (!authToken || !sessionId) return undefined
    const initialRefresh = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 10000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(timer)
    }
  }, [authToken, refresh, sessionId])

  const upload = useCallback(
    async (chunk: EnhancementAudioChunk) => {
      if (!authToken || !sessionId) return
      nextChunkIndexRef.current = Math.max(nextChunkIndexRef.current, chunk.chunkIndex + 1)
      setStatus(`正在上传 ${formatDuration(Math.floor(chunk.startMs / 1000))}-${formatDuration(Math.floor(chunk.endMs / 1000))} 精修分片`)
      try {
        const audioBase64 = await blobToBase64(chunk.wavBlob)
        const saved = await api.createEnhancementChunk(authToken, sessionId, {
          chunkIndex: chunk.chunkIndex,
          audioStartMs: chunk.startMs,
          audioEndMs: chunk.endMs,
          overlapMs: chunk.overlapMs,
          provider: 'moss',
          audioBase64,
          audioMimeType: chunk.wavBlob.type || 'audio/wav',
        })
        setChunks((items) => upsertChunk(items, saved))
        setStatus(`已提交第 ${chunk.chunkIndex + 1} 段精修任务`)
      } catch (error) {
        setStatus('精修分片上传失败，实时转写仍会保留')
        notify(error instanceof Error ? error.message : '精修分片上传失败')
      }
    },
    [authToken, notify, sessionId],
  )

  return {
    chunkSeconds,
    overlapSeconds,
    nextChunkIndexRef,
    status,
    summary: summarizeChunks(chunks, chunkSeconds, overlapSeconds),
    upload,
  }
}

function upsertChunk(current: EnhancementChunkResponse[], incoming: EnhancementChunkResponse) {
  const byId = new Map(current.map((item) => [item.id, item]))
  byId.set(incoming.id, incoming)
  return [...byId.values()].sort((left, right) => left.chunkIndex - right.chunkIndex)
}

function summarizeChunks(chunks: EnhancementChunkResponse[], chunkSeconds: number, overlapSeconds: number) {
  if (chunks.length === 0) return `窗口 ${Math.round(chunkSeconds / 60)} 分钟，重叠 ${Math.round(overlapSeconds / 60)} 分钟`
  const total = chunks.length
  const completed = chunks.filter((chunk) => chunk.status === 'completed').length
  const running = chunks.filter((chunk) => chunk.status === 'running').length
  const queued = chunks.filter((chunk) => chunk.status === 'queued').length
  const failed = chunks.filter((chunk) => chunk.status === 'failed').length
  return `精修分片 ${completed}/${total} 完成 · ${running} 处理中 · ${queued} 排队 · ${failed} 失败`
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? '').split(',').pop() ?? '')
    reader.onerror = () => reject(reader.error ?? new Error('音频分片读取失败'))
    reader.readAsDataURL(blob)
  })
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}
