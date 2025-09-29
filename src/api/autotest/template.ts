import request from '@/config/axios'
import type { CurlVariantVO, TemplatePreviewRequest } from './types'

/**
 * 查询指定接口分组下的模板列表。
 */
export const listCurlVariantsByGroup = (groupId: number) => {
  return request.get<CurlVariantVO[]>({ url: `/api/template/variants/group/${groupId}` })
}

/**
 * 重新生成最小模板。
 */
export const regenerateMinimalVariant = (groupId: number) => {
  return request.post<CurlVariantVO>({ url: `/api/template/variants/group/${groupId}/minimal` })
}

/**
 * 按类型重新生成模板。
 */
export const regenerateVariantByType = (groupId: number, variantType: string) => {
  return request.post<CurlVariantVO>({
    url: `/api/template/variants/group/${groupId}/regenerate/${variantType}`
  })
}

/**
 * 渲染模板并返回可执行的 curl 文本。
 */
export const previewCurlVariant = (variantId: number, data?: TemplatePreviewRequest) => {
  return request.post<string>({ url: `/api/template/variants/${variantId}/preview`, data })
}
