<template>
  <div class="auto-test-scenario">
    <ContentWrap>
      <el-form :inline="true" :model="queryForm" label-width="90px">
        <el-form-item label="项目" prop="projectId">
          <el-select v-model="queryForm.projectId" class="!w-240px" placeholder="请选择项目" @change="handleQuery">
            <el-option
              v-for="item in projectOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">
            <Icon class="mr-5px" icon="ep:search" />
            查询
          </el-button>
          <el-button @click="resetQuery">
            <Icon class="mr-5px" icon="ep:refresh" />
            重置
          </el-button>
          <el-button type="primary" @click="openScenarioDialog('create')">
            <Icon class="mr-5px" icon="ep:plus" />
            新建场景
          </el-button>
        </el-form-item>
      </el-form>
    </ContentWrap>

    <ContentWrap>
      <el-table v-loading="tableLoading" :data="scenarioList" row-key="id">
        <el-table-column label="场景名称" min-width="200" prop="name" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="resolveScenarioStatus(row.status).tag" size="small">
              {{ resolveScenarioStatus(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="默认环境" width="140" prop="defaultEnvId" />
        <el-table-column label="需复核" width="100">
          <template #default="{ row }">
            <el-tag :type="row.needReview ? 'warning' : 'success'" size="small">
              {{ row.needReview ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="200" prop="createTime" />
        <el-table-column fixed="right" label="操作" min-width="220">
          <template #default="{ row }">
            <el-button link type="primary" @click="openScenarioDialog('edit', row.id)">编辑</el-button>
            <el-button link type="primary" @click="viewScenario(row.id)">详情</el-button>
            <el-button link type="primary" @click="publish(row)">发布</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!tableLoading && scenarioList.length === 0" description="请选择项目后查询" />
    </ContentWrap>

    <el-dialog v-model="scenarioDialogVisible" :close-on-click-modal="false" :title="scenarioDialogTitle" width="860px">
      <el-form ref="scenarioFormRef" :model="scenarioForm" :rules="scenarioRules" label-width="120px">
        <el-form-item label="所属项目" prop="projectId">
          <el-select v-model="scenarioForm.projectId" class="!w-240px" placeholder="请选择项目" @change="loadEnvironmentOptions">
            <el-option
              v-for="item in projectOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="默认环境">
          <el-select v-model="scenarioForm.defaultEnvId" class="!w-240px" placeholder="可选：选择默认环境">
            <el-option
              v-for="env in environmentOptions"
              :key="env.id"
              :label="`${env.name} (${env.host})`"
              :value="env.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="场景名称" prop="name">
          <el-input v-model="scenarioForm.name" maxlength="60" placeholder="请输入场景名称" show-word-limit />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="scenarioForm.remark" maxlength="120" placeholder="请输入备注" show-word-limit />
        </el-form-item>

        <el-divider>场景步骤</el-divider>
        <div v-if="scenarioForm.steps.length === 0" class="mb-12px text-gray-500">请至少添加一个步骤</div>
        <el-space :fill="true" direction="vertical" size="large">
          <el-card v-for="(step, index) in scenarioForm.steps" :key="step.uid" class="step-card" shadow="never">
            <template #header>
              <div class="flex items-center justify-between">
                <span>步骤 {{ index + 1 }}</span>
                <el-button link type="danger" @click="removeStep(index)">删除</el-button>
              </div>
            </template>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item :prop="`steps.${index}.curlVariantId`" :rules="[{ required: true, message: '请输入模板编号', trigger: 'blur' }]" label="模板编号">
                  <el-input-number v-model="step.curlVariantId" :min="1" :step="1" class="!w-200px" controls-position="right" placeholder="请输入模板编号" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="步骤别名">
                  <el-input v-model="step.stepAlias" maxlength="50" placeholder="可选：填写别名" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="执行顺序">
                  <el-input-number v-model="step.orderNo" :min="1" :step="1" class="!w-200px" controls-position="right" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="调用选项(JSON)">
                  <el-input v-model="step.invokeOptions" :autosize="stepTextareaAutosize" placeholder="可选" type="textarea" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="变量映射(JSON)">
              <el-input v-model="step.variableMapping" :autosize="stepTextareaAutosize" placeholder="可选" type="textarea" />
            </el-form-item>
          </el-card>
        </el-space>
        <div class="mt-12px">
          <el-button plain type="primary" @click="addStep">
            <Icon class="mr-5px" icon="ep:plus" />
            新增步骤
          </el-button>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="scenarioDialogVisible = false">取 消</el-button>
        <el-button :loading="scenarioSubmitLoading" type="primary" @click="submitScenario">保 存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailDrawerVisible" size="640px" title="场景详情">
      <el-descriptions v-if="scenarioDetail" :column="1" border>
        <el-descriptions-item label="场景编号">{{ scenarioDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="项目编号">{{ scenarioDetail.projectId }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{ scenarioDetail.name }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ resolveScenarioStatus(scenarioDetail.status).label }}</el-descriptions-item>
        <el-descriptions-item label="默认环境">{{ scenarioDetail.defaultEnvId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ scenarioDetail.remark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="需复核">{{ scenarioDetail.needReview ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ scenarioDetail.createTime || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider>步骤列表</el-divider>
      <el-empty v-if="!scenarioDetail?.steps?.length" description="暂无步骤" />
      <el-card
        v-for="(step, index) in scenarioDetail?.steps || []"
        :key="step.id || index"
        class="mb-12px"
        shadow="never"
      >
        <div class="font-medium">步骤 {{ index + 1 }}</div>
        <div class="text-13px text-gray-500">模板编号：{{ step.curlVariantId }}</div>
        <div class="text-13px text-gray-500">别名：{{ step.stepAlias || '-' }}</div>
        <div class="text-13px text-gray-500">顺序：{{ step.orderNo || index + 1 }}</div>
        <div class="mt-6px text-13px text-gray-500">变量映射：</div>
        <pre class="pre-json">{{ formatJson(step.variableMapping) }}</pre>
        <div class="mt-6px text-13px text-gray-500">调用选项：</div>
        <pre class="pre-json">{{ formatJson(step.invokeOptions) }}</pre>
      </el-card>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { listScenarioByProject, createScenario, updateScenario, publishScenario, getScenarioDetail } from '@/api/autotest/scenario'
import { listProjectEnvironments, listSwaggerProjects } from '@/api/autotest/swaggerProject'
import type {
  ProjectEnvironmentVO,
  ScenarioSaveRequest,
  ScenarioVO,
  SwaggerProjectVO
} from '@/api/autotest/types'

interface EditableScenarioStep {
  uid: string
  curlVariantId?: number
  stepAlias?: string
  orderNo?: number
  variableMapping?: string
  invokeOptions?: string
}

defineOptions({ name: 'AutoTestScenario' })

// 场景状态映射，保持与后端枚举一致
const ScenarioStatusMap: Record<number, { label: string; tag: 'info' | 'success' | 'danger' | 'warning' }> = {
  0: { label: '草稿', tag: 'info' },
  1: { label: '已发布', tag: 'success' },
  2: { label: '已废弃', tag: 'warning' }
}

const queryForm = reactive({
  projectId: undefined as number | undefined
})

const projectOptions = ref<SwaggerProjectVO[]>([])
const scenarioList = ref<ScenarioVO[]>([])
const tableLoading = ref(false)
const scenarioDialogVisible = ref(false)
const scenarioDialogTitle = ref('新建场景')
const scenarioFormRef = ref<FormInstance>()
const scenarioSubmitLoading = ref(false)
const environmentOptions = ref<ProjectEnvironmentVO[]>([])
const scenarioDetail = ref<ScenarioVO | null>(null)
const detailDrawerVisible = ref(false)

const scenarioForm = reactive({
  id: undefined as number | undefined,
  projectId: undefined as number | undefined,
  name: '',
  defaultEnvId: undefined as number | undefined,
  remark: '',
  steps: [] as EditableScenarioStep[]
})

const stepTextareaAutosize = { minRows: 2, maxRows: 6 }

const scenarioRules: FormRules = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  name: [{ required: true, message: '请输入场景名称', trigger: 'blur' }]
}

const resolveScenarioStatus = (status: number) => ScenarioStatusMap[status] ?? { label: `状态 ${status}`, tag: 'info' }

// 根据选中的项目拉取场景列表
const handleQuery = async () => {
  if (!queryForm.projectId) {
    scenarioList.value = []
    return
  }
  tableLoading.value = true
  try {
    scenarioList.value = await listScenarioByProject(queryForm.projectId)
  } finally {
    tableLoading.value = false
  }
}

const resetQuery = () => {
  queryForm.projectId = undefined
  scenarioList.value = []
}

// 新增一个空白步骤
const addStep = () => {
  scenarioForm.steps.push({ uid: `${Date.now()}-${Math.random()}` })
}

const removeStep = (index: number) => {
  scenarioForm.steps.splice(index, 1)
}

// 加载项目环境下拉选项，方便选择默认环境
const loadEnvironmentOptions = async (projectId?: number) => {
  if (!projectId) {
    environmentOptions.value = []
    return
  }
  environmentOptions.value = await listProjectEnvironments(projectId)
}

// 打开场景弹窗，支持新增与编辑
const openScenarioDialog = async (mode: 'create' | 'edit', id?: number) => {
  if (mode === 'create' && !queryForm.projectId) {
    ElMessage.warning('请先选择项目，再新建场景')
    return
  }
  scenarioDialogTitle.value = mode === 'create' ? '新建场景' : '编辑场景'
  scenarioForm.id = undefined
  scenarioForm.projectId = queryForm.projectId
  scenarioForm.name = ''
  scenarioForm.defaultEnvId = undefined
  scenarioForm.remark = ''
  scenarioForm.steps = []
  scenarioDialogVisible.value = true
  await loadEnvironmentOptions(queryForm.projectId)
  if (mode === 'edit' && id) {
    const detail = await getScenarioDetail(id)
    scenarioForm.id = detail.id
    scenarioForm.projectId = detail.projectId
    scenarioForm.name = detail.name
    scenarioForm.defaultEnvId = detail.defaultEnvId ?? undefined
    scenarioForm.remark = detail.remark ?? ''
    scenarioForm.steps = (detail.steps || []).map((step) => ({
      uid: `${step.id || Math.random()}`,
      curlVariantId: step.curlVariantId,
      stepAlias: step.stepAlias || undefined,
      orderNo: step.orderNo || undefined,
      variableMapping: step.variableMapping || undefined,
      invokeOptions: step.invokeOptions || undefined
    }))
    await loadEnvironmentOptions(detail.projectId)
  }
  if (scenarioForm.steps.length === 0) {
    addStep()
  }
}

// 提交场景数据，自动区分新增或更新
const submitScenario = async () => {
  if (!scenarioFormRef.value) return
  await scenarioFormRef.value.validate()
  if (!scenarioForm.projectId) {
    ElMessage.error('请先选择项目')
    return
  }
  if (scenarioForm.steps.length === 0) {
    ElMessage.error('请至少添加一个步骤')
    return
  }
  const stepsPayload: ScenarioSaveRequest['steps'] = []
  for (let index = 0; index < scenarioForm.steps.length; index += 1) {
    const step = scenarioForm.steps[index]
    if (!step.curlVariantId) {
      ElMessage.error(`第 ${index + 1} 个步骤缺少模板编号`)
      return
    }
    stepsPayload.push({
      curlVariantId: step.curlVariantId,
      stepAlias: step.stepAlias || undefined,
      orderNo: step.orderNo || index + 1,
      variableMapping: step.variableMapping || undefined,
      invokeOptions: step.invokeOptions || undefined
    })
  }
  const payload: ScenarioSaveRequest = {
    projectId: scenarioForm.projectId,
    name: scenarioForm.name,
    defaultEnvId: scenarioForm.defaultEnvId,
    remark: scenarioForm.remark || undefined,
    steps: stepsPayload
  }
  scenarioSubmitLoading.value = true
  try {
    if (scenarioForm.id) {
      await updateScenario(scenarioForm.id, payload)
      ElMessage.success('场景更新成功')
    } else {
      await createScenario(payload)
      ElMessage.success('场景创建成功')
    }
    scenarioDialogVisible.value = false
    await handleQuery()
  } finally {
    scenarioSubmitLoading.value = false
  }
}

// 发布场景，确认后调用后端接口
const publish = async (scenario: ScenarioVO) => {
  if (scenario.status === 1) {
    ElMessage.info('场景已发布，无需重复发布')
    return
  }
  try {
    await ElMessageBox.confirm(`确认发布场景「${scenario.name}」吗？`, '提示', { type: 'warning' })
  } catch (error) {
    return
  }
  await publishScenario(scenario.id, {})
  ElMessage.success('发布成功')
  await handleQuery()
}

const viewScenario = async (id: number) => {
  scenarioDetail.value = await getScenarioDetail(id)
  detailDrawerVisible.value = true
}

// 用于格式化 JSON 字符串，提升详情可读性
const formatJson = (value?: string) => {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch (error) {
    return value
  }
}

// 预加载全部 Swagger 项目供选择
const loadProjects = async () => {
  projectOptions.value = await listSwaggerProjects()
}

loadProjects()
</script>

<style scoped>
.auto-test-scenario {
  padding-bottom: 16px;
}

.step-card {
  border: 1px solid var(--el-border-color-light);
}

.pre-json {
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  padding: 8px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  font-family: var(--font-family-mono, 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace);
}
</style>
