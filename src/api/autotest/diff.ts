import request from '@/config/axios'
import type { DiffReviewRequest, DiffSnapshotVO } from './types'

/**
 * 查询差异快照列表。
 */
export const listDiffSnapshots = (projectId?: number) => {
  return request.get<DiffSnapshotVO[]>({ url: '/api/diff', params: { projectId } })
}

/**
 * 提交差异复核结果。
 */
export const reviewDiffSnapshot = (id: number, data: DiffReviewRequest) => {
  return request.post<DiffSnapshotVO>({ url: `/api/diff/${id}/review`, data })
}
