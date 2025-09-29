import request from '@/config/axios'
import type { ScenarioPublishRequest, ScenarioSaveRequest, ScenarioVO } from './types'

/**
 * 创建自动化场景草稿。
 */
export const createScenario = (data: ScenarioSaveRequest) => {
  return request.post<number>({ url: '/api/scenario', data })
}

/**
 * 更新场景草稿。
 */
export const updateScenario = (id: number, data: ScenarioSaveRequest) => {
  return request.put<void>({ url: `/api/scenario/${id}`, data })
}

/**
 * 发布场景。
 */
export const publishScenario = (id: number, data?: ScenarioPublishRequest) => {
  return request.post<void>({ url: `/api/scenario/${id}/publish`, data })
}

/**
 * 查询场景详情。
 */
export const getScenarioDetail = (id: number) => {
  return request.get<ScenarioVO>({ url: `/api/scenario/${id}` })
}

/**
 * 根据项目编号查询场景列表。
 */
export const listScenarioByProject = (projectId: number) => {
  return request.get<ScenarioVO[]>({ url: '/api/scenario', params: { projectId } })
}
