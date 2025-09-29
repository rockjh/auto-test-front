/**
 * 自动化测试模块通用类型定义，保持与后端 API 文档一致。
 */
export interface SwaggerProjectVO {
  id: number
  name: string
  swaggerSource: string
  swaggerType: number
  swaggerVersion?: string
  swaggerHash?: string
  syncStatus: number
  syncTime?: string
}

export interface ProjectCreateRequest {
  name: string
  swaggerSource: string
  swaggerType: number
}

export interface ProjectSyncRequest {
  triggerType?: number
  overrideSource?: string
  remark?: string
  allowRemoteFetch?: boolean
  requestHeaders?: Record<string, string>
}

export interface SwaggerDiffVO {
  syncId: number
  status: number
  diffSummary?: string
  startTime?: string
  endTime?: string
  errorMessage?: string
}

export interface ProjectEnvironmentVO {
  id: number
  projectId: number
  name: string
  envType?: number
  host: string
  headers?: Record<string, string>
  variables?: Record<string, any>
  isDefault?: boolean
  status?: number
  remark?: string
  createTime?: string
  updateTime?: string
}

export interface ProjectEnvironmentCreateRequest {
  projectId: number
  name: string
  envType?: number
  host: string
  headers?: Record<string, string>
  variables?: Record<string, any>
  isDefault?: boolean
  status?: number
  remark?: string
}

export interface ProjectEnvironmentUpdateRequest extends ProjectEnvironmentCreateRequest {}

export interface CurlVariantVO {
  id: number
  projectId: number
  groupId: number
  variantType: string
  curlTemplate: string
  paramRules?: string
  needReview?: boolean
}

export interface TemplatePreviewRequest {
  variables?: Record<string, any>
}

export interface ScenarioStepRequest {
  curlVariantId: number
  stepAlias?: string
  orderNo?: number
  variableMapping?: string
  invokeOptions?: string
}

export interface ScenarioSaveRequest {
  projectId: number
  name: string
  defaultEnvId?: number
  remark?: string
  steps: ScenarioStepRequest[]
}

export interface ScenarioPublishRequest {
  remark?: string
}

export interface ScenarioStepVO extends ScenarioStepRequest {
  id?: number
}

export interface ScenarioVO {
  id: number
  projectId: number
  name: string
  status: number
  defaultEnvId?: number
  remark?: string
  needReview?: boolean
  createTime?: string
  steps?: ScenarioStepVO[]
}

export interface ExecutionTriggerRequest {
  scenarioId: number
  envId?: number
  remark?: string
}

export interface ExecutionDetailVO {
  id: number
  scenarioStepId: number
  stepOrder: number
  status: number
  requestSnapshot?: string
  responseSnapshot?: string
  errorMessage?: string
  startTime?: string
  endTime?: string
}

export interface ExecutionVO {
  id: number
  scenarioId: number
  status: number
  startTime?: string
  endTime?: string
  durationMs?: number
  remark?: string
  steps?: ExecutionDetailVO[]
}

export interface ExecutionLogVO {
  id: number
  executionId: number
  scenarioStepId?: number
  logTime: string
  level: string
  message: string
  extra?: string
  notificationChannel?: string
  notificationStatus?: number
}

export interface DiffSnapshotVO {
  id: number
  projectId: number
  sourceType: string
  sourceRefId?: number
  relatedId?: number
  diffType?: string
  diffPayload?: string
  needReview?: boolean
  reviewStatus?: number
  reviewComment?: string
  createTime?: string
}

export interface DiffReviewRequest {
  reviewStatus: number
  reviewComment?: string
}
