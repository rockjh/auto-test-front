<template>
  <div class="flex flex-col" v-bind="$attrs">
    <!-- tab -->
    <div class="w-full pt-2 bg-[#f5f7f9] flex justify-center">
      <div class="w-[303px] rounded-full bg-[#DDDFE3] p-1 z-10">
        <div
          :class="
            selectedTab === AiWriteTypeEnum.REPLY && 'after:transform after:translate-x-[100%]'
          "
          class="flex items-center relative after:content-[''] after:block after:bg-white after:h-[30px] after:w-1/2 after:absolute after:top-0 after:left-0 after:transition-transform after:rounded-full"
        >
          <span
            v-for="tab in tabs"
            :key="tab.value"
            :class="[
              'inline-block w-1/2 rounded-full cursor-pointer text-center leading-[30px] relative z-1 text-[5C6370] hover:text-black',
              tab.value === selectedTab ? 'text-black shadow-md' : 'hover:bg-[#DDDFE3]'
            ]"
            @click="() => switchTab(tab.value)"
          >
            {{ tab.text }}
          </span>
        </div>
      </div>
    </div>
    <div
      class="px-7 pb-2 flex-grow overflow-y-auto lg:block w-[380px] box-border bg-[#f5f7f9] h-full"
    >
      <div>
        <template v-if="selectedTab === 1">
          <h3 class="mt-5 mb-3 flex items-center justify-between text-[14px]">
            <span>写作内容</span>
            <span
              class="flex items-center text-[12px] text-[#846af7] cursor-pointer select-none"
              @click="() => example('write')"
            >
              <Icon icon="ep:question-filled" />
              示例
            </span>
          </h3>
          <el-input
            v-model="formData.prompt"
            :maxlength="500"
            :rows="5"
            placeholder="请输入写作内容"
            showWordLimit
            type="textarea"
          />
        </template>

        <template v-else>
          <h3 class="mt-5 mb-3 flex items-center justify-between text-[14px]">
            <span>原文</span>
            <span
              class="flex items-center text-[12px] text-[#846af7] cursor-pointer select-none"
              @click="() => example('reply')"
            >
              <Icon icon="ep:question-filled" />
              示例
            </span>
          </h3>
          <el-input
            v-model="formData.originalContent"
            :maxlength="500"
            :rows="5"
            placeholder="请输入原文"
            showWordLimit
            type="textarea"
          />

          <h3 class="mt-5 mb-3 flex items-center justify-between text-[14px]">
            <span>回复内容</span>
          </h3>
          <el-input
            v-model="formData.prompt"
            :maxlength="500"
            :rows="5"
            placeholder="请输入回复内容"
            showWordLimit
            type="textarea"
          />
        </template>

        <h3 class="mt-5 mb-3 flex items-center justify-between text-[14px]">
          <span>长度</span>
        </h3>
        <Tag v-model="formData.length" :tags="getIntDictOptions(DICT_TYPE.AI_WRITE_LENGTH)" />
        <h3 class="mt-5 mb-3 flex items-center justify-between text-[14px]">
          <span>格式</span>
        </h3>
        <Tag v-model="formData.format" :tags="getIntDictOptions(DICT_TYPE.AI_WRITE_FORMAT)" />
        <h3 class="mt-5 mb-3 flex items-center justify-between text-[14px]">
          <span>语气</span>
        </h3>
        <Tag v-model="formData.tone" :tags="getIntDictOptions(DICT_TYPE.AI_WRITE_TONE)" />
        <h3 class="mt-5 mb-3 flex items-center justify-between text-[14px]">
          <span>语言</span>
        </h3>
        <Tag v-model="formData.language" :tags="getIntDictOptions(DICT_TYPE.AI_WRITE_LANGUAGE)" />

        <div class="flex items-center justify-center mt-3">
          <el-button :disabled="isWriting" @click="reset">重置</el-button>
          <el-button :loading="isWriting" color="#846af7" @click="submit">生成</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import Tag from './Tag.vue'
import { WriteVO } from '@/api/ai/write'
import { omit } from 'lodash-es'
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import { AiWriteTypeEnum, WriteExample } from '@/views/ai/utils/constants'

type TabType = WriteVO['type']

const message = useMessage() // 消息弹窗

defineProps<{
  isWriting: boolean
}>()

const emits = defineEmits<{
  (e: 'submit', params: Partial<WriteVO>)
  (e: 'example', param: 'write' | 'reply')
  (e: 'reset')
}>()

/** 点击示例的时候，将定义好的文章作为示例展示出来 **/
const example = (type: 'write' | 'reply') => {
  formData.value = {
    ...initData,
    ...omit(WriteExample[type], ['data'])
  }
  emits('example', type)
}

/** 重置，将表单值作为初选值 **/
const reset = () => {
  formData.value = { ...initData }
  emits('reset')
}

const selectedTab = ref<TabType>(AiWriteTypeEnum.WRITING)
const tabs: {
  text: string
  value: TabType
}[] = [
  { text: '撰写', value: AiWriteTypeEnum.WRITING },
  { text: '回复', value: AiWriteTypeEnum.REPLY }
]
const initData: WriteVO = {
  type: 1,
  prompt: '',
  originalContent: '',
  tone: 1,
  language: 1,
  length: 1,
  format: 1
}
const formData = ref<WriteVO>({ ...initData })

/** 用来记录切换之前所填写的数据，切换的时候给赋值回来 **/
const recordFormData = {} as Record<AiWriteTypeEnum, WriteVO>

/** 切换tab **/
const switchTab = (value: TabType) => {
  if (value !== selectedTab.value) {
    // 保存之前的久数据
    recordFormData[selectedTab.value] = formData.value
    selectedTab.value = value
    // 将之前的旧数据赋值回来
    formData.value = { ...initData, ...recordFormData[value] }
  }
}

/** 提交写作 */
const submit = () => {
  if (selectedTab.value === 2 && !formData.value.originalContent) {
    message.warning('请输入原文')
    return
  }
  if (!formData.value.prompt) {
    message.warning(`请输入${selectedTab.value === 1 ? '写作' : '回复'}内容`)
    return
  }
  emits('submit', {
    /** 撰写的时候没有 originalContent 字段**/
    ...(selectedTab.value === 1 ? omit(formData.value, ['originalContent']) : formData.value),
    /** 使用选中 tab 值覆盖当前的 type 类型 **/
    type: selectedTab.value
  })
}
</script>
