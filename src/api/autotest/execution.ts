import request from '@/config/axios'
import type { ExecutionLogVO, ExecutionTriggerRequest, ExecutionVO } from './types'

/**
 * 触发场景执行。
 */
export const triggerExecution = (data: ExecutionTriggerRequest) => {
  return request.post<number>({ url: '/api/execution/trigger', data })
}

/**
 * 查询执行详情。
 */
export const getExecutionDetail = (id: number) => {
  return request.get<ExecutionVO>({ url: `/api/execution/${id}` })
}

/**
 * 分页查询执行日志。
 */
export const getExecutionLogs = (id: number, pageNo = 1, pageSize = 20) => {
  return request.get<PageResult<ExecutionLogVO>>({
    url: `/api/execution/${id}/logs`,
    params: { pageNo, pageSize }
  })
}
