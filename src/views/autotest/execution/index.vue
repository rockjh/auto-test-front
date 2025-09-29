<template>
  <div class="auto-test-execution">
    <ContentWrap>
      <div class="mb-12px text-14px font-medium">触发执行</div>
      <el-form :inline="true" :model="triggerForm" label-width="100px">
        <el-form-item label="项目" prop="projectId">
          <el-select v-model="triggerForm.projectId" class="!w-220px" placeholder="请选择项目" @change="handleProjectChange">
            <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景" prop="scenarioId">
          <el-select v-model="triggerForm.scenarioId" class="!w-260px" placeholder="请选择场景" @change="handleScenarioChange">
            <el-option v-for="item in scenarioOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行环境">
          <el-select v-model="triggerForm.envId" class="!w-220px" clearable placeholder="可选：执行环境">
            <el-option v-for="env in environmentOptions" :key="env.id" :label="`${env.name} (${env.host})`" :value="env.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="triggerForm.remark" maxlength="120" placeholder="请输入备注" show-word-limit />
        </el-form-item>
        <el-form-item>
          <el-button :loading="triggerLoading" type="primary" @click="submitTrigger">
            <Icon class="mr-5px" icon="ep:video-play" />
            触发执行
          </el-button>
        </el-form-item>
      </el-form>
    </ContentWrap>

    <ContentWrap>
      <div class="mb-12px text-14px font-medium">执行详情</div>
      <el-form :inline="true" :model="detailQuery" label-width="100px">
        <el-form-item label="执行编号" prop="executionId">
          <el-input-number
            v-model="detailQuery.executionId"
            :min="1"
            :step="1"
            class="!w-220px"
            controls-position="right"
            placeholder="请输入执行编号"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadExecutionDetail">
            <Icon class="mr-5px" icon="ep:search" />
            查询
          </el-button>
        </el-form-item>
      </el-form>
      <el-descriptions v-if="executionDetail" :column="3" border class="mb-16px">
        <el-descriptions-item label="执行编号">{{ executionDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="场景编号">{{ executionDetail.scenarioId }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="resolveExecutionStatus(executionDetail.status).tag">
            {{ resolveExecutionStatus(executionDetail.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ executionDetail.startTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ executionDetail.endTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="耗时(ms)">{{ executionDetail.durationMs ?? '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="executionDetail" :data="executionDetail.steps || []" border size="small">
        <el-table-column label="步骤序号" prop="stepOrder" width="100">
          <template #default="{ row, $index }">
            {{ row.stepOrder ?? $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="resolveStepStatus(row.status).tag" size="small">
              {{ resolveStepStatus(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="模板编号" prop="scenarioStepId" width="160" />
        <el-table-column label="请求快照" min-width="200" show-overflow-tooltip prop="requestSnapshot" />
        <el-table-column label="响应快照" min-width="200" show-overflow-tooltip prop="responseSnapshot" />
        <el-table-column label="错误信息" min-width="200" show-overflow-tooltip prop="errorMessage" />
      </el-table>
      <el-empty v-else description="请输入执行编号后查询" />

      <el-divider>执行日志</el-divider>
      <el-table :data="executionLogs.list" border size="small" v-loading="logLoading">
        <el-table-column label="日志时间" prop="logTime" width="200" />
        <el-table-column label="级别" prop="level" width="100" />
        <el-table-column label="消息" min-width="260" prop="message" />
        <el-table-column label="附加信息" min-width="240">
          <template #default="{ row }">
            <pre class="pre-json">{{ formatJson(row.extra) }}</pre>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-12px flex justify-end">
        <el-pagination
          v-if="executionDetail"
          :current-page="logQuery.pageNo"
          :page-size="logQuery.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="executionLogs.total"
          background
          layout="total, sizes, prev, pager, next"
          @current-change="handleLogPageChange"
          @size-change="handleLogSizeChange"
        />
      </div>
    </ContentWrap>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { triggerExecution, getExecutionDetail, getExecutionLogs } from '@/api/autotest/execution'
import { listScenarioByProject } from '@/api/autotest/scenario'
import { listProjectEnvironments, listSwaggerProjects } from '@/api/autotest/swaggerProject'
import type {
  ExecutionLogVO,
  ExecutionVO,
  ProjectEnvironmentVO,
  ScenarioVO,
  SwaggerProjectVO
} from '@/api/autotest/types'

/** 执行状态与标签映射 */
const ExecutionStatusMap: Record<number, { label: string; tag: 'info' | 'success' | 'danger' | 'warning' }> = {
  0: { label: '排队', tag: 'info' },
  1: { label: '执行中', tag: 'warning' },
  2: { label: '成功', tag: 'success' },
  3: { label: '失败', tag: 'danger' },
  4: { label: '取消', tag: 'info' }
}

/** 步骤状态与标签映射 */
const StepStatusMap: Record<number, { label: string; tag: 'info' | 'success' | 'danger' | 'warning' }> = {
  0: { label: '执行中', tag: 'warning' },
  1: { label: '成功', tag: 'success' },
  2: { label: '失败', tag: 'danger' },
  3: { label: '跳过', tag: 'info' }
}

defineOptions({ name: 'AutoTestExecution' })

const projectOptions = ref<SwaggerProjectVO[]>([])
const scenarioOptions = ref<ScenarioVO[]>([])
const environmentOptions = ref<ProjectEnvironmentVO[]>([])

const triggerForm = reactive({
  projectId: undefined as number | undefined,
  scenarioId: undefined as number | undefined,
  envId: undefined as number | undefined,
  remark: ''
})
const triggerLoading = ref(false)

const detailQuery = reactive({ executionId: undefined as number | undefined })
const executionDetail = ref<ExecutionVO | null>(null)
const logLoading = ref(false)
const logQuery = reactive({ pageNo: 1, pageSize: 20 })
const executionLogs = reactive<{ list: ExecutionLogVO[]; total: number }>({ list: [], total: 0 })

const resolveExecutionStatus = (status: number) => ExecutionStatusMap[status] ?? { label: `状态 ${status}`, tag: 'info' }
const resolveStepStatus = (status: number) => StepStatusMap[status] ?? { label: `状态 ${status}`, tag: 'info' }

// 加载项目列表供下拉
const loadProjects = async () => {
  projectOptions.value = await listSwaggerProjects()
}

// 当项目变化时，需要刷新场景与环境选项
const handleProjectChange = async () => {
  triggerForm.scenarioId = undefined
  triggerForm.envId = undefined
  scenarioOptions.value = []
  environmentOptions.value = []
  if (!triggerForm.projectId) return
  scenarioOptions.value = await listScenarioByProject(triggerForm.projectId)
  environmentOptions.value = await listProjectEnvironments(triggerForm.projectId)
}

// 当场景选中时，如果场景已发布并配置默认环境，可以自动回填
const handleScenarioChange = () => {
  if (!triggerForm.scenarioId) return
  const matched = scenarioOptions.value.find((item) => item.id === triggerForm.scenarioId)
  if (matched?.defaultEnvId) {
    triggerForm.envId = matched.defaultEnvId
  }
}

// 触发执行
const submitTrigger = async () => {
  if (!triggerForm.projectId || !triggerForm.scenarioId) {
    ElMessage.warning('请选择项目和场景')
    return
  }
  triggerLoading.value = true
  try {
    const executionId = await triggerExecution({
      scenarioId: triggerForm.scenarioId,
      envId: triggerForm.envId,
      remark: triggerForm.remark || undefined
    })
    ElMessage.success(`执行已触发，编号：${executionId}`)
    detailQuery.executionId = executionId
    await loadExecutionDetail()
  } finally {
    triggerLoading.value = false
  }
}

// 查询执行详情
const loadExecutionDetail = async () => {
  if (!detailQuery.executionId) {
    ElMessage.warning('请输入执行编号')
    return
  }
  executionDetail.value = await getExecutionDetail(detailQuery.executionId)
  await loadExecutionLogs(1)
}

// 加载日志列表
const loadExecutionLogs = async (pageNo = logQuery.pageNo) => {
  if (!detailQuery.executionId) return
  logLoading.value = true
  try {
    logQuery.pageNo = pageNo
    const res = await getExecutionLogs(detailQuery.executionId, logQuery.pageNo, logQuery.pageSize)
    executionLogs.list = res.list
    executionLogs.total = res.total
  } finally {
    logLoading.value = false
  }
}

const handleLogPageChange = async (page: number) => {
  await loadExecutionLogs(page)
}

const handleLogSizeChange = async (size: number) => {
  logQuery.pageSize = size
  await loadExecutionLogs(1)
}

const formatJson = (value?: string) => {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch (error) {
    return value
  }
}

loadProjects()
</script>

<style scoped>
.auto-test-execution {
  padding-bottom: 16px;
}

.pre-json {
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  padding: 6px 10px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  font-family: var(--font-family-mono, 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace);
}
</style>
