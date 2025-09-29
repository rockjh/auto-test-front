import request from '@/config/axios'
import type {
  ProjectCreateRequest,
  ProjectEnvironmentCreateRequest,
  ProjectEnvironmentUpdateRequest,
  ProjectEnvironmentVO,
  ProjectSyncRequest,
  SwaggerDiffVO,
  SwaggerProjectVO
} from './types'

/**
 * 查询当前租户下的 Swagger 项目列表。
 */
export const listSwaggerProjects = () => {
  return request.get<SwaggerProjectVO[]>({ url: '/api/swagger/projects' })
}

/**
 * 创建 Swagger 项目并返回项目编号。
 */
export const createSwaggerProject = (data: ProjectCreateRequest) => {
  return request.post<number>({ url: '/api/swagger/projects', data })
}

/**
 * 获取单个 Swagger 项目的基础信息。
 */
export const getSwaggerProject = (id: number) => {
  return request.get<SwaggerProjectVO>({ url: `/api/swagger/projects/${id}` })
}

/**
 * 触发 Swagger 同步流程并返回差异概要。
 */
export const syncSwaggerProject = (id: number, data?: ProjectSyncRequest) => {
  return request.post<SwaggerDiffVO>({ url: `/api/swagger/projects/${id}/sync`, data })
}

/**
 * 查询项目最近一次同步的差异信息。
 */
export const getSwaggerProjectDiff = (id: number) => {
  return request.get<SwaggerDiffVO>({ url: `/api/swagger/projects/${id}/diff` })
}

/**
 * 查询指定项目下的环境配置列表。
 */
export const listProjectEnvironments = (projectId: number) => {
  return request.get<ProjectEnvironmentVO[]>({ url: `/api/swagger/projects/${projectId}/envs` })
}

/**
 * 新增项目环境。
 */
export const createProjectEnvironment = (
  projectId: number,
  data: ProjectEnvironmentCreateRequest
) => {
  return request.post<number>({ url: `/api/swagger/projects/${projectId}/envs`, data })
}

/**
 * 更新项目环境。
 */
export const updateProjectEnvironment = (
  projectId: number,
  envId: number,
  data: ProjectEnvironmentUpdateRequest
) => {
  return request.put<boolean>({ url: `/api/swagger/projects/${projectId}/envs/${envId}`, data })
}

/**
 * 删除项目环境。
 */
export const deleteProjectEnvironment = (projectId: number, envId: number) => {
  return request.delete<boolean>({ url: `/api/swagger/projects/${projectId}/envs/${envId}` })
}

/**
 * 查询项目环境详情。
 */
export const getProjectEnvironment = (projectId: number, envId: number) => {
  return request.get<ProjectEnvironmentVO>({ url: `/api/swagger/projects/${projectId}/envs/${envId}` })
}
