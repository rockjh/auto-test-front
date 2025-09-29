<template>
  <div class="auto-test-template">
    <ContentWrap>
      <el-form :inline="true" :model="queryForm" class="-mb-12px" label-width="90px">
        <el-form-item label="接口分组 ID" prop="groupId">
          <el-input-number
            v-model="queryForm.groupId"
            :min="1"
            :step="1"
            class="!w-220px"
            controls-position="right"
            placeholder="请输入接口分组编号"
          />
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
          <el-button v-if="queryForm.groupId" @click="regenerateGroup('minimal')">
            <Icon class="mr-5px" icon="ep:refresh-right" />
            重新生成最小模板
          </el-button>
        </el-form-item>
      </el-form>
    </ContentWrap>

    <ContentWrap>
      <el-table v-loading="tableLoading" :data="variantList" row-key="id">
        <el-table-column label="模板类型" width="140" prop="variantType" />
        <el-table-column label="需复核" width="100">
          <template #default="{ row }">
            <el-tag :type="row.needReview ? 'warning' : 'success'" size="small">
              {{ row.needReview ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="模板内容" min-width="280">
          <template #default="{ row }">
            <pre class="pre-template">{{ row.curlTemplate }}</pre>
          </template>
        </el-table-column>
        <el-table-column label="参数规则" min-width="240">
          <template #default="{ row }">
            <pre class="pre-template">{{ formatJson(row.paramRules) }}</pre>
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" min-width="220">
          <template #default="{ row }">
            <el-button link type="primary" @click="openPreview(row)">预览</el-button>
            <el-button link type="primary" @click="regenerateGroup(row.variantType)">重新生成</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!tableLoading && variantList.length === 0" description="请先查询接口分组" />
    </ContentWrap>

    <el-dialog v-model="previewDialogVisible" :close-on-click-modal="false" title="模板预览" width="720px">
      <div class="mb-16px">
        <div class="mb-8px text-14px text-gray-500">覆盖变量（JSON 可选）</div>
        <el-input
          v-model="previewForm.variablesText"
          :autosize="previewVariableAutosize"
          placeholder='如 { "path.orderId": 123456 }'
          type="textarea"
        />
      </div>
      <el-divider>渲染结果</el-divider>
      <el-skeleton :loading="previewLoading" animated>
        <pre class="pre-template preview-result">{{ previewContent || '尚未生成预览' }}</pre>
      </el-skeleton>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关 闭</el-button>
        <el-button :loading="previewLoading" type="primary" @click="renderPreview">重新渲染</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listCurlVariantsByGroup, previewCurlVariant, regenerateVariantByType } from '@/api/autotest/template'
import type { CurlVariantVO } from '@/api/autotest/types'

defineOptions({ name: 'AutoTestTemplateLibrary' })

const queryForm = reactive({
  groupId: undefined as number | undefined
})

const tableLoading = ref(false)
const variantList = ref<CurlVariantVO[]>([])
const currentGroupId = ref<number | undefined>()
const previewDialogVisible = ref(false)
const previewTarget = ref<CurlVariantVO | null>(null)
const previewForm = reactive({ variablesText: '' })
const previewContent = ref('')
const previewLoading = ref(false)

const previewVariableAutosize = { minRows: 3, maxRows: 8 }

// 根据分组编号刷新模板列表
const loadVariants = async (groupId: number) => {
  tableLoading.value = true
  try {
    variantList.value = await listCurlVariantsByGroup(groupId)
    currentGroupId.value = groupId
  } finally {
    tableLoading.value = false
  }
}

// 查询模板列表
const handleQuery = async () => {
  if (!queryForm.groupId) {
    ElMessage.warning('请先输入接口分组 ID')
    return
  }
  await loadVariants(queryForm.groupId)
}

const resetQuery = () => {
  queryForm.groupId = undefined
  variantList.value = []
  currentGroupId.value = undefined
}

// 重新生成模板，类型由参数决定
const regenerateGroup = async (variantType: string) => {
  if (!currentGroupId.value && !queryForm.groupId) {
    ElMessage.warning('请先查询接口分组')
    return
  }
  const targetGroup = currentGroupId.value ?? queryForm.groupId!
  await regenerateVariantByType(targetGroup, variantType)
  ElMessage.success('模板重新生成成功')
  queryForm.groupId = targetGroup
  await loadVariants(targetGroup)
}

const openPreview = (variant: CurlVariantVO) => {
  previewTarget.value = variant
  previewDialogVisible.value = true
  previewForm.variablesText = ''
  previewContent.value = variant.curlTemplate
}

// 渲染模板预览
const renderPreview = async () => {
  if (!previewTarget.value) return
  let variables: Record<string, any> | undefined
  if (previewForm.variablesText) {
    try {
      variables = JSON.parse(previewForm.variablesText)
    } catch (error) {
      ElMessage.error('变量 JSON 解析失败')
      return
    }
  }
  previewLoading.value = true
  try {
    previewContent.value = await previewCurlVariant(previewTarget.value.id, { variables })
  } finally {
    previewLoading.value = false
  }
}

const formatJson = (value?: string) => {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch (error) {
    return value
  }
}
</script>

<style scoped>
.auto-test-template {
  padding-bottom: 16px;
}

.pre-template {
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  padding: 8px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  font-family: var(--font-family-mono, 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace);
}

.preview-result {
  min-height: 120px;
}
</style>
