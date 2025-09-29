<template>
  <div class="auto-test-diff">
    <ContentWrap>
      <el-form :inline="true" :model="queryForm" label-width="90px">
        <el-form-item label="项目" prop="projectId">
          <el-select v-model="queryForm.projectId" class="!w-220px" clearable placeholder="全部项目" @change="handleQuery">
            <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
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
        </el-form-item>
      </el-form>
    </ContentWrap>

    <ContentWrap>
      <el-table v-loading="tableLoading" :data="diffList" row-key="id">
        <el-table-column label="差异编号" prop="id" width="120" />
        <el-table-column label="项目" min-width="160">
          <template #default="{ row }">
            {{ resolveProjectName(row.projectId) }}
          </template>
        </el-table-column>
        <el-table-column label="来源类型" prop="sourceType" width="140" />
        <el-table-column label="差异类型" prop="diffType" width="160" />
        <el-table-column label="需复核" width="100">
          <template #default="{ row }">
            <el-tag :type="row.needReview ? 'warning' : 'success'" size="small">
              {{ row.needReview ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="复核状态" width="140">
          <template #default="{ row }">
            <el-tag :type="resolveReviewStatus(row.reviewStatus).tag" size="small">
              {{ resolveReviewStatus(row.reviewStatus).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createTime" width="200" />
        <el-table-column fixed="right" label="操作" min-width="200">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
            <el-button link type="primary" @click="openReviewDialog(row, 1)">复核通过</el-button>
            <el-button link type="danger" @click="openReviewDialog(row, 2)">复核驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!tableLoading && diffList.length === 0" description="暂无差异数据" />
    </ContentWrap>

    <el-drawer v-model="detailDrawerVisible" size="600px" title="差异详情">
      <el-descriptions v-if="detailData" :column="1" border>
        <el-descriptions-item label="差异编号">{{ detailData.id }}</el-descriptions-item>
        <el-descriptions-item label="项目">{{ resolveProjectName(detailData.projectId) }}</el-descriptions-item>
        <el-descriptions-item label="来源类型">{{ detailData.sourceType }}</el-descriptions-item>
        <el-descriptions-item label="关联 ID">{{ detailData.sourceRefId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="实体 ID">{{ detailData.relatedId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="复核状态">{{ resolveReviewStatus(detailData.reviewStatus).label }}</el-descriptions-item>
        <el-descriptions-item label="复核备注">{{ detailData.reviewComment || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detailData.createTime || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider>差异内容</el-divider>
      <pre class="pre-json">{{ formatJson(detailData?.diffPayload) }}</pre>
    </el-drawer>

    <el-dialog v-model="reviewDialogVisible" :close-on-click-modal="false" title="提交复核" width="520px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="复核结果">
          <el-radio-group v-model="reviewForm.reviewStatus">
            <el-radio :label="1">通过</el-radio>
            <el-radio :label="2">驳回</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="复核备注">
          <el-input v-model="reviewForm.reviewComment" :autosize="reviewCommentAutosize" maxlength="120" placeholder="请输入复核意见" show-word-limit type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取 消</el-button>
        <el-button :loading="reviewSubmitLoading" type="primary" @click="submitReview">提 交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listDiffSnapshots, reviewDiffSnapshot } from '@/api/autotest/diff'
import { listSwaggerProjects } from '@/api/autotest/swaggerProject'
import type { DiffSnapshotVO, SwaggerProjectVO } from '@/api/autotest/types'

defineOptions({ name: 'AutoTestDiffReview' })

// 复核状态映射
const ReviewStatusMap: Record<number, { label: string; tag: 'info' | 'success' | 'danger' }> = {
  0: { label: '待处理', tag: 'warning' },
  1: { label: '已通过', tag: 'success' },
  2: { label: '已驳回', tag: 'danger' }
}

const queryForm = reactive({ projectId: undefined as number | undefined })
const projectOptions = ref<SwaggerProjectVO[]>([])
const diffList = ref<DiffSnapshotVO[]>([])
const tableLoading = ref(false)
const detailData = ref<DiffSnapshotVO | null>(null)
const detailDrawerVisible = ref(false)
const reviewDialogVisible = ref(false)
const reviewSubmitLoading = ref(false)
const reviewForm = reactive({ reviewStatus: 1, reviewComment: '' })
let reviewingId: number | null = null

const reviewCommentAutosize = { minRows: 2, maxRows: 4 }
const projectNameMap = ref<Record<number, string>>({})

const resolveProjectName = (projectId?: number) => {
  if (!projectId) return '-'
  return projectNameMap.value[projectId] || `项目 ${projectId}`
}

const resolveReviewStatus = (status?: number) => ReviewStatusMap[status ?? 0] ?? { label: `状态 ${status}`, tag: 'info' }

// 查询差异列表
const handleQuery = async () => {
  tableLoading.value = true
  try {
    diffList.value = await listDiffSnapshots(queryForm.projectId)
  } finally {
    tableLoading.value = false
  }
}

const resetQuery = () => {
  queryForm.projectId = undefined
  diffList.value = []
}

// 打开抽屉查看差异详情
const openDetail = (row: DiffSnapshotVO) => {
  detailData.value = row
  detailDrawerVisible.value = true
}

// 打开复核弹窗，预设复核结果
const openReviewDialog = (row: DiffSnapshotVO, reviewStatus: 1 | 2) => {
  reviewingId = row.id
  reviewForm.reviewStatus = reviewStatus
  reviewForm.reviewComment = ''
  reviewDialogVisible.value = true
}

// 提交复核结果并更新列表
const submitReview = async () => {
  if (!reviewingId) return
  reviewSubmitLoading.value = true
  try {
    const updated = await reviewDiffSnapshot(reviewingId, {
      reviewStatus: reviewForm.reviewStatus,
      reviewComment: reviewForm.reviewComment || undefined
    })
    ElMessage.success('复核结果已提交')
    reviewDialogVisible.value = false
    // 更新当前列表中的记录，避免全量刷新
    const index = diffList.value.findIndex((item) => item.id === updated.id)
    if (index !== -1) {
      diffList.value[index] = updated
    }
    if (detailData.value?.id === updated.id) {
      detailData.value = updated
    }
    reviewingId = null
  } finally {
    reviewSubmitLoading.value = false
  }
}

// 差异内容通常为 JSON，这里做格式化展示
const formatJson = (value?: string) => {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch (error) {
    return value
  }
}

// 预加载项目名称映射，便于表格展示
const loadProjects = async () => {
  projectOptions.value = await listSwaggerProjects()
  projectNameMap.value = projectOptions.value.reduce((acc, cur) => {
    acc[cur.id] = cur.name
    return acc
  }, {} as Record<number, string>)
}

loadProjects()
handleQuery()
</script>

<style scoped>
.auto-test-diff {
  padding-bottom: 16px;
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
