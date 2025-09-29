<template>
  <div class="auto-test-project">
    <ContentWrap>
      <div class="flex items-center justify-between">
        <div>
          <el-button type="primary" @click="openProjectDialog">
            <Icon class="mr-5px" icon="ep:plus" />
            新建项目
          </el-button>
          <el-button @click="loadProjects">
            <Icon class="mr-5px" icon="ep:refresh" />
            刷新
          </el-button>
        </div>
      </div>
    </ContentWrap>

    <ContentWrap>
      <el-table v-loading="tableLoading" :data="projectList" row-key="id">
        <el-table-column label="项目名称" min-width="160" prop="name" />
        <el-table-column label="Swagger 来源" min-width="220" prop="swaggerSource" show-overflow-tooltip />
        <el-table-column label="来源类型" width="120">
          <template #default="{ row }">
            {{ resolveSwaggerType(row.swaggerType) }}
          </template>
        </el-table-column>
        <el-table-column label="版本号" width="120" prop="swaggerVersion" />
        <el-table-column label="最近同步" width="200" prop="syncTime" />
        <el-table-column label="同步状态" width="120">
          <template #default="{ row }">
            <el-tag :type="resolveSyncStatus(row.syncStatus).tagType">
              {{ resolveSyncStatus(row.syncStatus).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" min-width="240">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEnvironmentDrawer(row)">环境</el-button>
            <el-button link type="primary" @click="openSyncDialog(row)">同步</el-button>
            <el-button link type="primary" @click="openDiffDrawer(row)">差异</el-button>
            <el-button link type="primary" @click="openProjectDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </ContentWrap>

    <!-- 新建项目 -->
    <el-dialog v-model="projectDialogVisible" :close-on-click-modal="false" title="新建 Swagger 项目" width="560px">
      <el-form ref="projectFormRef" :model="projectForm" :rules="projectRules" label-width="100px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="projectForm.name" maxlength="50" placeholder="请输入项目名称" show-word-limit />
        </el-form-item>
        <el-form-item label="来源类型" prop="swaggerType">
          <el-radio-group v-model="projectForm.swaggerType">
            <el-radio-button :label="1">URL</el-radio-button>
            <el-radio-button :label="2">JSON 文本</el-radio-button>
            <el-radio-button :label="3">文件上传</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="来源内容" prop="swaggerSource">
          <el-input
            v-model="projectForm.swaggerSource"
            :autosize="projectSourceAutosize"
            placeholder="请输入 Swagger 文档地址或内容"
            type="textarea"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="projectDialogVisible = false">取 消</el-button>
        <el-button :loading="projectSubmitLoading" type="primary" @click="submitProject">保 存</el-button>
      </template>
    </el-dialog>

    <!-- 触发同步 -->
    <el-dialog v-model="syncDialogVisible" :close-on-click-modal="false" title="触发 Swagger 同步" width="600px">
      <el-form ref="syncFormRef" :model="syncForm" label-width="120px">
        <el-form-item label="触发类型">
          <el-select v-model="syncForm.triggerType" placeholder="请选择触发类型">
            <el-option :value="1" label="手动" />
            <el-option :value="2" label="Webhook" />
          </el-select>
        </el-form-item>
        <el-form-item label="允许远程抓取">
          <el-switch v-model="syncForm.allowRemoteFetch" />
        </el-form-item>
        <el-form-item label="覆盖内容">
          <el-input
            v-model="syncForm.overrideSource"
            :autosize="syncOverrideAutosize"
            placeholder="可选：直接粘贴 Swagger JSON/YAML"
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="附加 Header">
          <el-input
            v-model="syncForm.headerText"
            :autosize="syncHeaderAutosize"
            placeholder='可选：JSON 格式，如 {"X-Tenant":"qa"}'
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="同步备注">
          <el-input v-model="syncForm.remark" maxlength="100" placeholder="请输入同步备注" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取 消</el-button>
        <el-button :loading="syncSubmitLoading" type="primary" @click="submitSync">确 定</el-button>
      </template>
    </el-dialog>

    <!-- 差异摘要 -->
    <el-drawer
      v-model="diffDrawerVisible"
      :destroy-on-close="true"
      :title="`差异摘要 - ${currentProject?.name ?? ''}`"
      size="480px"
    >
      <el-descriptions v-if="diffResult" :column="1" border>
        <el-descriptions-item label="同步编号">{{ diffResult.syncId }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="resolveSyncStatus(diffResult.status).tagType">
            {{ resolveSyncStatus(diffResult.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="差异摘要">{{ diffResult.diffSummary || '-' }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ diffResult.startTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ diffResult.endTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="错误信息">{{ diffResult.errorMessage || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无差异数据" />
    </el-drawer>

    <!-- 项目详情 -->
    <el-drawer
      v-model="detailDrawerVisible"
      :title="`项目详情 - ${currentProject?.name ?? ''}`"
      size="480px"
    >
      <el-descriptions v-if="projectDetail" :column="1" border>
        <el-descriptions-item label="项目编号">{{ projectDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{ projectDetail.name }}</el-descriptions-item>
        <el-descriptions-item label="来源类型">{{ resolveSwaggerType(projectDetail.swaggerType) }}</el-descriptions-item>
        <el-descriptions-item label="来源内容">{{ projectDetail.swaggerSource }}</el-descriptions-item>
        <el-descriptions-item label="版本号">{{ projectDetail.swaggerVersion || '-' }}</el-descriptions-item>
        <el-descriptions-item label="哈希">{{ projectDetail.swaggerHash || '-' }}</el-descriptions-item>
        <el-descriptions-item label="同步状态">
          <el-tag :type="resolveSyncStatus(projectDetail.syncStatus).tagType">
            {{ resolveSyncStatus(projectDetail.syncStatus).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="同步时间">{{ projectDetail.syncTime || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="正在加载详情" />
    </el-drawer>

    <!-- 环境管理 -->
    <el-drawer
      v-model="environmentDrawerVisible"
      :destroy-on-close="true"
      :title="`环境管理 - ${currentProject?.name ?? ''}`"
      size="640px"
    >
      <div class="mb-12px flex justify-end">
        <el-button type="primary" @click="openEnvironmentForm()">
          <Icon class="mr-5px" icon="ep:plus" />
          新建环境
        </el-button>
      </div>
      <el-table v-loading="environmentTableLoading" :data="environmentList" row-key="id">
        <el-table-column label="环境名称" min-width="140" prop="name" />
        <el-table-column label="Host" min-width="200" prop="host" show-overflow-tooltip />
        <el-table-column label="默认" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" size="small" type="success">默认</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" min-width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEnvironmentForm(row)">编辑</el-button>
            <el-button link type="primary" @click="viewEnvironment(row)">查看</el-button>
            <el-button link type="danger" @click="removeEnvironment(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <!-- 环境表单 -->
    <el-dialog v-model="environmentDialogVisible" :close-on-click-modal="false" title="环境配置" width="640px">
      <el-form ref="environmentFormRef" :model="environmentForm" :rules="environmentRules" label-width="120px">
        <el-form-item label="环境名称" prop="name">
          <el-input v-model="environmentForm.name" maxlength="50" placeholder="请输入环境名称" show-word-limit />
        </el-form-item>
        <el-form-item label="Host" prop="host">
          <el-input v-model="environmentForm.host" placeholder="请输入 Host/BaseURL" />
        </el-form-item>
        <el-form-item label="Header(JSON)" prop="headerText">
          <el-input
            v-model="environmentForm.headerText"
            :autosize="envTextareaAutosize"
            placeholder="可选，JSON 字符串"
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="变量(JSON)" prop="variablesText">
          <el-input
            v-model="environmentForm.variablesText"
            :autosize="envTextareaAutosize"
            placeholder="可选，JSON 字符串"
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="默认环境">
          <el-switch v-model="environmentForm.isDefault" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-radio-group v-model="environmentForm.status">
            <el-radio-button :label="1">启用</el-radio-button>
            <el-radio-button :label="0">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="environmentForm.remark" maxlength="100" placeholder="请输入备注" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="environmentDialogVisible = false">取 消</el-button>
        <el-button :loading="environmentSubmitLoading" type="primary" @click="submitEnvironment">
          保 存
        </el-button>
      </template>
    </el-dialog>

    <!-- 环境详情 -->
    <el-dialog v-model="environmentDetailVisible" title="环境详情" width="600px">
      <el-descriptions v-if="environmentDetail" :column="1" border>
        <el-descriptions-item label="环境名称">{{ environmentDetail.name }}</el-descriptions-item>
        <el-descriptions-item label="Host">{{ environmentDetail.host }}</el-descriptions-item>
        <el-descriptions-item label="默认">
          <el-tag v-if="environmentDetail.isDefault" size="small" type="success">默认</el-tag>
          <span v-else>否</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          {{ environmentDetail.status === 1 ? '启用' : '停用' }}
        </el-descriptions-item>
        <el-descriptions-item label="Headers">
          <pre class="pre-json">{{ formatJson(environmentDetail.headers) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="变量">
          <pre class="pre-json">{{ formatJson(environmentDetail.variables) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ environmentDetail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无数据" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createProjectEnvironment,
  createSwaggerProject,
  deleteProjectEnvironment,
  getProjectEnvironment,
  getSwaggerProject,
  getSwaggerProjectDiff,
  listProjectEnvironments,
  listSwaggerProjects,
  syncSwaggerProject,
  updateProjectEnvironment
} from '@/api/autotest/swaggerProject'
import type {
  ProjectEnvironmentCreateRequest,
  ProjectEnvironmentUpdateRequest,
  ProjectEnvironmentVO,
  ProjectSyncRequest,
  SwaggerDiffVO,
  SwaggerProjectVO
} from '@/api/autotest/types'

defineOptions({ name: 'AutoTestSwaggerProject' })

// Swagger 来源类型映射，保持与后端枚举一致
const SwaggerTypeMap: Record<number, string> = {
  1: 'URL',
  2: 'JSON 文本',
  3: '文件上传'
}

// 同步状态的展示元信息，用于表格标签
const SyncStatusMeta: Record<number, { label: string; tagType: 'info' | 'success' | 'danger' | 'warning' }> = {
  0: { label: '未开始', tagType: 'info' },
  1: { label: '成功', tagType: 'success' },
  2: { label: '失败', tagType: 'danger' }
}

const tableLoading = ref(false)
const projectList = ref<SwaggerProjectVO[]>([])
const currentProject = ref<SwaggerProjectVO | null>(null)
const projectDetail = ref<SwaggerProjectVO | null>(null)
const diffResult = ref<SwaggerDiffVO | null>(null)

const projectDialogVisible = ref(false)
const projectFormRef = ref<FormInstance>()
const projectForm = reactive({
  name: '',
  swaggerSource: '',
  swaggerType: 1
})
const projectSubmitLoading = ref(false)
const projectSourceAutosize = computed(() => ({ minRows: projectForm.swaggerType === 1 ? 2 : 4, maxRows: 8 }))
const syncOverrideAutosize = { minRows: 3, maxRows: 10 }
const syncHeaderAutosize = { minRows: 2, maxRows: 6 }
const envTextareaAutosize = { minRows: 2, maxRows: 8 }

const syncDialogVisible = ref(false)
const syncFormRef = ref<FormInstance>()
const syncForm = reactive({
  triggerType: 1,
  allowRemoteFetch: false,
  overrideSource: '',
  headerText: '',
  remark: ''
})
const syncSubmitLoading = ref(false)
let syncProjectId: number | null = null

const diffDrawerVisible = ref(false)
const detailDrawerVisible = ref(false)

const environmentDrawerVisible = ref(false)
const environmentTableLoading = ref(false)
const environmentList = ref<ProjectEnvironmentVO[]>([])
const environmentDialogVisible = ref(false)
const environmentFormRef = ref<FormInstance>()
const environmentForm = reactive({
  id: undefined as number | undefined,
  projectId: 0,
  name: '',
  host: '',
  headerText: '',
  variablesText: '',
  isDefault: false,
  status: 1,
  remark: ''
})
const environmentSubmitLoading = ref(false)
const environmentRules: FormRules = {
  name: [{ required: true, message: '请输入环境名称', trigger: 'blur' }],
  host: [{ required: true, message: '请输入 Host', trigger: 'blur' }],
  headerText: [
    {
      validator: (_, value, callback) => {
        if (!value) {
          callback()
          return
        }
        if (validateJson(value)) {
          callback()
        } else {
          callback(new Error('Header 必须是合法 JSON'))
        }
      },
      trigger: 'blur'
    }
  ],
  variablesText: [
    {
      validator: (_, value, callback) => {
        if (!value) {
          callback()
          return
        }
        if (validateJson(value)) {
          callback()
        } else {
          callback(new Error('变量必须是合法 JSON'))
        }
      },
      trigger: 'blur'
    }
  ]
}
const environmentDetailVisible = ref(false)
const environmentDetail = ref<ProjectEnvironmentVO | null>(null)

const resolveSwaggerType = (type: number) => SwaggerTypeMap[type] ?? `类型 ${type}`
const resolveSyncStatus = (status: number) => SyncStatusMeta[status] ?? { label: `状态 ${status}`, tagType: 'warning' }

// 拉取项目列表，供表格展示
const loadProjects = async () => {
  tableLoading.value = true
  try {
    projectList.value = await listSwaggerProjects()
  } finally {
    tableLoading.value = false
  }
}

const openProjectDialog = () => {
  projectDialogVisible.value = true
  projectForm.name = ''
  projectForm.swaggerSource = ''
  projectForm.swaggerType = 1
}

const submitProject = async () => {
  if (!projectFormRef.value) return
  await projectFormRef.value.validate()
  projectSubmitLoading.value = true
  try {
    await createSwaggerProject({ ...projectForm })
    ElMessage.success('项目创建成功')
    projectDialogVisible.value = false
    await loadProjects()
  } finally {
    projectSubmitLoading.value = false
  }
}

const openSyncDialog = (project: SwaggerProjectVO) => {
  currentProject.value = project
  syncProjectId = project.id
  syncForm.triggerType = 1
  syncForm.allowRemoteFetch = false
  syncForm.overrideSource = ''
  syncForm.headerText = ''
  syncForm.remark = ''
  syncDialogVisible.value = true
}

const submitSync = async () => {
  if (!syncProjectId) return
  if (syncFormRef.value) {
    await syncFormRef.value.validate?.()
  }
  const payload: ProjectSyncRequest = {
    triggerType: syncForm.triggerType,
    allowRemoteFetch: syncForm.allowRemoteFetch,
    overrideSource: syncForm.overrideSource || undefined,
    remark: syncForm.remark || undefined,
    requestHeaders: syncForm.headerText ? parseJsonRecord(syncForm.headerText) : undefined
  }
  syncSubmitLoading.value = true
  try {
    diffResult.value = await syncSwaggerProject(syncProjectId, payload)
    ElMessage.success('同步任务已触发')
    syncDialogVisible.value = false
    diffDrawerVisible.value = true
    await loadProjects()
  } finally {
    syncSubmitLoading.value = false
  }
}

const openDiffDrawer = async (project: SwaggerProjectVO) => {
  currentProject.value = project
  diffDrawerVisible.value = true
  diffResult.value = null
  try {
    diffResult.value = await getSwaggerProjectDiff(project.id)
  } catch (error) {
    diffDrawerVisible.value = false
    console.error(error)
    ElMessage.error('获取差异失败')
  }
}

const openProjectDetail = async (project: SwaggerProjectVO) => {
  currentProject.value = project
  projectDetail.value = null
  detailDrawerVisible.value = true
  projectDetail.value = await getSwaggerProject(project.id)
}

const openEnvironmentDrawer = async (project: SwaggerProjectVO) => {
  currentProject.value = project
  environmentDrawerVisible.value = true
  await loadEnvironments(project.id)
}

const loadEnvironments = async (projectId: number) => {
  environmentTableLoading.value = true
  try {
    environmentList.value = await listProjectEnvironments(projectId)
  } finally {
    environmentTableLoading.value = false
  }
}

// 打开环境弹窗，复用同一份表单用于新增和编辑
const openEnvironmentForm = (env?: ProjectEnvironmentVO) => {
  if (!currentProject.value) return
  environmentForm.projectId = currentProject.value.id
  environmentForm.id = env?.id
  environmentForm.name = env?.name ?? ''
  environmentForm.host = env?.host ?? ''
  environmentForm.headerText = env?.headers ? JSON.stringify(env.headers, null, 2) : ''
  environmentForm.variablesText = env?.variables ? JSON.stringify(env.variables, null, 2) : ''
  environmentForm.isDefault = env?.isDefault ?? false
  environmentForm.status = env?.status ?? 1
  environmentForm.remark = env?.remark ?? ''
  environmentDialogVisible.value = true
}

// 提交环境配置，自动区分新增或更新
const submitEnvironment = async () => {
  if (!environmentFormRef.value || !currentProject.value) return
  await environmentFormRef.value.validate()
  const payload: ProjectEnvironmentCreateRequest & ProjectEnvironmentUpdateRequest = {
    projectId: currentProject.value.id,
    name: environmentForm.name,
    host: environmentForm.host,
    headers: environmentForm.headerText ? parseJsonRecord(environmentForm.headerText) : undefined,
    variables: environmentForm.variablesText ? parseJsonRecord(environmentForm.variablesText) : undefined,
    isDefault: environmentForm.isDefault,
    status: environmentForm.status,
    remark: environmentForm.remark || undefined
  }
  environmentSubmitLoading.value = true
  try {
    if (environmentForm.id) {
      await updateProjectEnvironment(currentProject.value.id, environmentForm.id, payload)
      ElMessage.success('环境更新成功')
    } else {
      await createProjectEnvironment(currentProject.value.id, payload)
      ElMessage.success('环境创建成功')
    }
    environmentDialogVisible.value = false
    await loadEnvironments(currentProject.value.id)
  } finally {
    environmentSubmitLoading.value = false
  }
}

const viewEnvironment = async (env: ProjectEnvironmentVO) => {
  if (!currentProject.value) return
  environmentDetail.value = null
  environmentDetailVisible.value = true
  environmentDetail.value = await getProjectEnvironment(currentProject.value.id, env.id)
}

const removeEnvironment = async (env: ProjectEnvironmentVO) => {
  if (!currentProject.value) return
  try {
    await ElMessageBox.confirm(`确认删除环境「${env.name}」吗？`, '提示', { type: 'warning' })
  } catch (error) {
    return
  }
  await deleteProjectEnvironment(currentProject.value.id, env.id)
  ElMessage.success('环境已删除')
  await loadEnvironments(currentProject.value.id)
}

const validateJson = (value: string) => {
  try {
    JSON.parse(value)
    return true
  } catch (error) {
    return false
  }
}

// 将字符串解析为 JSON，并在解析失败时提示用户
const parseJsonRecord = (value: string): Record<string, any> | undefined => {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value)
    return parsed
  } catch (error) {
    ElMessage.error('JSON 解析失败，请检查输入')
    throw error
  }
}

// 美化展示 JSON，便于在详情中阅读
const formatJson = (value?: Record<string, any>) => {
  if (!value) return '-'
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return String(value)
  }
}

loadProjects()
</script>

<style scoped>
.auto-test-project {
  padding-bottom: 16px;
}

.pre-json {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-family-mono, 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace);
  font-size: 12px;
  line-height: 20px;
}
</style>
