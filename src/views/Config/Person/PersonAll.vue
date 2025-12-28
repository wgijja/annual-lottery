<!-- eslint-disable vue/no-parsing-error -->
<script setup lang='ts'>
import type { IPersonConfig, IGroup } from '@/types/storeType'
import DaiysuiTable from '@/components/DaiysuiTable/index.vue'
import i18n from '@/locales/i18n'
import useStore from '@/store'
import { addOtherInfo } from '@/utils'
import { readFileBinary } from '@/utils/file'
import { fetchFingerprints, deleteFingerprintByName } from '@/api/lottery'
import { storeToRefs } from 'pinia'
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const { t } = useI18n()
const personConfig = useStore().personConfig
const themeStore = useStore().themeStore
const groupConfig = useStore().groupConfig
const { getAllPersonList: allPersonList, getAlreadyPersonList: alreadyPersonList } = storeToRefs(personConfig)
const { getAllGroups: allGroups } = storeToRefs(groupConfig)
const limitType = '.xlsx,.xls'

// 指纹映射表 (personName -> fingerprint)
const fingerprintMap = ref<Record<string, string>>({})

const resetDataDialog = ref()
const delAllDataDialog = ref()
const groupManageDialog = ref()
const editingGroup = ref<IGroup | null>(null)
const newGroupName = ref('')
const selectedGroupId = ref<string>('')
const batchEligible = ref<boolean>(true)
const batchGroupDialog = ref()
const setGroupDialog = ref()
const editingPerson = ref<IPersonConfig | null>(null)
const selectedPersonGroupId = ref<string>('')
const filterGroupId = ref<string>('')
const selectedPersons = ref<IPersonConfig[]>([])
const batchMoveGroupDialog = ref()
const targetGroupId = ref<string>('')
const filteredPersonList = computed(() => {
  if (!filterGroupId.value) {
    return allPersonList.value
  }
  // 如果filterGroupId是'ungrouped'，显示未分组的人员
  if (filterGroupId.value === 'ungrouped') {
    return allPersonList.value.filter((person: IPersonConfig) => !person.groupId)
  }
  return allPersonList.value.filter((person: IPersonConfig) => person.groupId === filterGroupId.value)
})

// 加载指纹数据
async function loadFingerprints() {
  const themeId = themeStore.currentThemeId
  if (!themeId) return
  
  const fingerprints = await fetchFingerprints(themeId)
  fingerprintMap.value = {}
  fingerprints.forEach((fp: any) => {
    if (fp.person_name) {
      fingerprintMap.value[fp.person_name] = fp.fingerprint
    }
  })
}

async function handleFileChange(e: Event) {
  const dataBinary = await readFileBinary(((e.target as HTMLInputElement).files as FileList)[0]!)
  const workBook = XLSX.read(dataBinary, { type: 'binary', cellDates: true })
  const workSheet = workBook.Sheets[workBook.SheetNames[0]]
  const excelData = XLSX.utils.sheet_to_json(workSheet)
  const allData = addOtherInfo(excelData)
  
  // 获取当前最大ID
  const maxId = allPersonList.value.length > 0 
    ? Math.max(...allPersonList.value.map((p: IPersonConfig) => p.id || 0))
    : -1
  
  // 处理分组：如果Excel中有group列，根据group名称匹配分组ID
  allData.forEach((item: any, index: number) => {
    if (item.group) {
      // 查找匹配的分组
      const matchedGroup = allGroups.value.find((g: IGroup) => g.name === item.group)
      if (matchedGroup) {
        item.groupId = matchedGroup.id
      }
      // 如果没有匹配的分组，可以选择创建新分组或留空
      delete item.group // 删除原始group字段
    }
    // 确保eligible字段存在，默认为true
    if (item.eligible === undefined) {
      item.eligible = true
    }
    // 为新增数据生成新的ID（避免与现有数据冲突）
    item.id = maxId + 1 + index
  })
  
  // 增量添加，不清空之前的数据
  personConfig.addNotPersonList(allData)
}
function exportData() {
  let data = JSON.parse(JSON.stringify(allPersonList.value))
  // 排除一些字段
  for (let i = 0; i < data.length; i++) {
    // 添加组信息（使用组名称）
    if (data[i].groupId) {
      data[i].group = groupConfig.getGroupNameById(data[i].groupId)
    } else {
      data[i].group = ''
    }
    delete data[i].x
    delete data[i].y
    delete data[i].id
    delete data[i].createTime
    delete data[i].updateTime
    delete data[i].prizeId
    delete data[i].groupId
    // 修改字段名称
    if (data[i].isWin) {
      data[i].isWin = i18n.global.t('data.yes')
    }
    else {
      data[i].isWin = i18n.global.t('data.no')
    }
    // 格式化数组为
    data[i].prizeTime = data[i].prizeTime.join(',')
    data[i].prizeName = data[i].prizeName.join(',')
  }
  let dataString = JSON.stringify(data)
  dataString = dataString
    .replaceAll(/uid/g, i18n.global.t('data.number'))
    .replaceAll(/isWin/g, i18n.global.t('data.isWin'))
    .replaceAll(/department/g, i18n.global.t('data.department'))
    .replaceAll(/name/g, i18n.global.t('data.name'))
    .replaceAll(/identity/g, i18n.global.t('data.identity'))
    .replaceAll(/prizeName/g, i18n.global.t('data.prizeName'))
    .replaceAll(/prizeTime/g, i18n.global.t('data.prizeTime'))
    .replaceAll(/"group"/g, `"${i18n.global.t('data.group')}"`)

  data = JSON.parse(dataString)

  if (data.length > 0) {
    const dataBinary = XLSX.utils.json_to_sheet(data)
    const dataBinaryBinary = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(dataBinaryBinary, dataBinary, 'Sheet1')
    XLSX.writeFile(dataBinaryBinary, 'data.xlsx')
  }
}

function resetData() {
  personConfig.resetAlreadyPerson()
}

function deleteAll() {
  // 删除选中的人员
  if (selectedPersons.value.length > 0) {
    // 先复制数组，避免在删除过程中数组长度变化导致只删除一半
    const toDelete = [...selectedPersons.value]
    toDelete.forEach((person: IPersonConfig) => {
      delPersonItem(person)
    })
    selectedPersons.value = []
  } else {
    // 如果没有选中，删除当前筛选组下的所有人员
    if (filterGroupId.value) {
      // 先复制数组，避免在删除过程中数组长度变化
      const toDelete = [...filteredPersonList.value]
      toDelete.forEach((person: IPersonConfig) => {
        delPersonItem(person)
      })
    } else {
      // 如果也没有筛选，删除全部
      personConfig.deleteAllPerson()
    }
  }
}

async function delPersonItem(row: IPersonConfig) {
  const themeId = themeStore.currentThemeId
  
  // 先删除人员数据（同步操作，立即生效）
  personConfig.deletePerson(row)
  
  // 同时删除指纹记录（异步操作，不阻塞UI）
  if (themeId && row.name) {
    try {
      await deleteFingerprintByName(themeId, row.name)
      // 更新本地指纹映射
      delete fingerprintMap.value[row.name]
    } catch (error) {
      console.error('[delPersonItem] Failed to delete fingerprint:', error)
    }
  }
  
  // 从选中列表中移除
  const index = selectedPersons.value.findIndex(p => p.id === row.id)
  if (index > -1) {
    selectedPersons.value.splice(index, 1)
  }
}

// 获取用户的指纹（截取前8位显示）
function getFingerprint(name: string): string {
  const fp = fingerprintMap.value[name]
  return fp ? fp.substring(0, 8) + '...' : '-'
}

// 分组管理相关函数
function openGroupManageDialog() {
  groupManageDialog.value?.showModal()
}

function addGroup() {
  if (!newGroupName.value.trim()) return
  const newGroup: IGroup = {
    id: `group_${Date.now()}`,
    name: newGroupName.value.trim(),
    createTime: dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss'),
    updateTime: dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss'),
  }
  groupConfig.addGroup(newGroup)
  newGroupName.value = ''
}

function editGroup(group: IGroup) {
  editingGroup.value = { ...group }
  newGroupName.value = group.name
}

function saveGroup() {
  if (!editingGroup.value || !newGroupName.value.trim()) return
  editingGroup.value.name = newGroupName.value.trim()
  groupConfig.updateGroup(editingGroup.value)
  editingGroup.value = null
  newGroupName.value = ''
}

function deleteGroup(groupId: string) {
  if (confirm(t('dialog.confirmDeleteGroup'))) {
    groupConfig.deleteGroup(groupId)
    // 同时清除该分组下所有人员的groupId
    allPersonList.value.forEach((person: IPersonConfig) => {
      if (person.groupId === groupId) {
        person.groupId = undefined
      }
    })
  }
}

function cancelEditGroup() {
  editingGroup.value = null
  newGroupName.value = ''
}

// 批量设置eligible
function openBatchEligibleDialog() {
  batchGroupDialog.value?.showModal()
}

function batchSetEligible() {
  allPersonList.value.forEach((person: IPersonConfig) => {
    person.eligible = batchEligible.value
  })
  batchGroupDialog.value?.close()
}

// 切换单个人员的eligible状态
function toggleEligible(person: IPersonConfig) {
  person.eligible = !(person.eligible ?? true)
}

// 更新人员的分组
function updatePersonGroup(person: IPersonConfig, groupId: string) {
  person.groupId = groupId || undefined
}

// 设置人员分组
function setPersonGroup(person: IPersonConfig) {
  editingPerson.value = person
  selectedPersonGroupId.value = person.groupId || ''
  setGroupDialog.value?.showModal()
}

function savePersonGroup() {
  if (editingPerson.value) {
    editingPerson.value.groupId = selectedPersonGroupId.value || undefined
    editingPerson.value = null
    selectedPersonGroupId.value = ''
    setGroupDialog.value?.close()
  }
}

function cancelSetGroup() {
  editingPerson.value = null
  selectedPersonGroupId.value = ''
  setGroupDialog.value?.close()
}

// 批量移动分组
function openBatchMoveGroupDialog() {
  if (selectedPersons.value.length === 0) {
    alert(t('dialog.selectPersonsFirst'))
    return
  }
  targetGroupId.value = ''
  batchMoveGroupDialog.value?.showModal()
}

function batchMoveToGroup() {
  selectedPersons.value.forEach((person: IPersonConfig) => {
    person.groupId = targetGroupId.value || undefined
  })
  selectedPersons.value = []
  batchMoveGroupDialog.value?.close()
}

function togglePersonSelection(person: IPersonConfig) {
  const index = selectedPersons.value.findIndex(p => p.id === person.id)
  if (index > -1) {
    selectedPersons.value.splice(index, 1)
  } else {
    selectedPersons.value.push(person)
  }
}

function isPersonSelected(person: IPersonConfig): boolean {
  return selectedPersons.value.some(p => p.id === person.id)
}

function selectAll() {
  selectedPersons.value = [...filteredPersonList.value]
}

function deselectAll() {
  selectedPersons.value = []
}

const tableColumns = computed(() => [
  {
    label: '',
    props: 'selected',
    formatValue(row: IPersonConfig) {
      return `<input type="checkbox" class="checkbox checkbox-sm" ${isPersonSelected(row) ? 'checked' : ''} onchange="window.togglePersonSelection_${row.id}()" />`
    },
  },
  {
    label: i18n.global.t('data.number'),
    props: 'uid',
  },
  {
    label: i18n.global.t('data.name'),
    props: 'name',
  },
  {
    label: i18n.global.t('data.department'),
    props: 'department',
  },
  {
    label: i18n.global.t('data.avatar'),
    props: 'avatar',
    formatValue(row: any) {
      return row.avatar ? `<img src="${row.avatar}" alt="avatar" style="width: 50px; height: 50px;"/>` : '-'
    },
  },
  {
    label: i18n.global.t('data.identity'),
    props: 'identity',
  },
  {
    label: i18n.global.t('data.fingerprint'),
    props: 'name',
    formatValue(row: IPersonConfig) {
      return `<span class="text-xs font-mono opacity-70" title="${fingerprintMap.value[row.name] || ''}">${getFingerprint(row.name)}</span>`
    },
  },
  {
    label: '抽奖分组',
    props: 'groupId',
    formatValue(row: IPersonConfig) {
      return groupConfig.getGroupNameById(row.groupId)
    },
  },
  {
    label: '隐身模式',
    props: 'eligible',
    formatValue(row: IPersonConfig) {
      const isEligible = row.eligible !== false
      return isEligible ? i18n.global.t('data.no') : i18n.global.t('data.yes')
    },
  },
  {
    label: i18n.global.t('data.isWin'),
    props: 'isWin',
    formatValue(row: IPersonConfig) {
      return row.isWin ? i18n.global.t('data.yes') : i18n.global.t('data.no')
    },
  },
  {
    label: i18n.global.t('data.operation'),
    actions: [
      {
        name: 'setGroup',
        label: t('button.setGroup'),
        type: 'btn-info',
        onClick: (row: IPersonConfig) => {
          setPersonGroup(row)
        },
      },
      {
        name: 'toggleEligible',
        label: (row: IPersonConfig) => (row.eligible !== false ? t('button.enableStealth') : t('button.disableStealth')),
        type: (row: IPersonConfig) => (row.eligible !== false ? 'btn-warning' : 'btn-success'),
        onClick: (row: IPersonConfig) => {
          toggleEligible(row)
        },
      },
      {
        name: 'delete',
        label: i18n.global.t('data.delete'),
        type: 'btn-error',
        onClick: (row: IPersonConfig) => {
          delPersonItem(row)
        },
      },
    ],
  },
])

onMounted(() => {
  loadFingerprints()
  // 初始化所有人员的eligible字段
  allPersonList.value.forEach((person: IPersonConfig) => {
    if (person.eligible === undefined) {
      person.eligible = true
    }
    // 为每个人员绑定选择函数
    ;(window as any)[`togglePersonSelection_${person.id}`] = () => {
      togglePersonSelection(person)
    }
  })
})
</script>

<template>
  <dialog id="my_modal_1" ref="resetDataDialog" class="border-none modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ t('dialog.titleTip') }}
      </h3>
      <p class="py-4">
        {{ t('dialog.dialogResetWinner') }}
      </p>
      <div class="modal-action">
        <form method="dialog" class="flex gap-3">
          <!-- if there is a button in form, it will close the modal -->
          <button class="btn" @click="resetDataDialog.close()">
            {{ t('button.cancel') }}
          </button>
          <button class="btn" @click="resetData">
            {{ t('button.confirm') }}
          </button>
        </form>
      </div>
    </div>
  </dialog>
  <dialog id="my_modal_1" ref="delAllDataDialog" class="border-none modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ t('dialog.titleTip') }}
      </h3>
      <p class="py-4">
        <span v-if="selectedPersons.length > 0">
          确定要删除选中的 {{ selectedPersons.length }} 人吗？
        </span>
        <span v-else-if="filterGroupId">
          确定要删除当前筛选组下的所有人员吗？
        </span>
        <span v-else>
          {{ t('dialog.dialogDelAllPerson') }}
        </span>
      </p>
      <div class="modal-action">
        <form method="dialog" class="flex gap-3">
          <!-- if there is a button in form, it will close the modal -->
          <button class="btn" @click="delAllDataDialog.close()">
            {{ t('button.cancel') }}
          </button>
          <button class="btn" @click="deleteAll">
            {{ t('button.confirm') }}
          </button>
        </form>
      </div>
    </div>
  </dialog>
  <!-- 分组管理对话框 -->
  <dialog id="groupManageDialog" ref="groupManageDialog" class="border-none modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ t('viewTitle.groupManagement') }}
      </h3>
      <div class="py-4">
        <div class="flex gap-2 mb-4">
          <input
            v-model="newGroupName" type="text" :placeholder="t('placeHolder.groupName')"
            class="flex-1 input input-bordered input-sm"
            @keyup.enter="editingGroup ? saveGroup() : addGroup()"
          >
          <button
            v-if="!editingGroup" class="btn btn-primary btn-sm" @click="addGroup"
          >
            {{ t('button.add') }}
          </button>
          <template v-else>
            <button class="btn btn-success btn-sm" @click="saveGroup">
              {{ t('button.save') }}
            </button>
            <button class="btn btn-sm" @click="cancelEditGroup">
              {{ t('button.cancel') }}
            </button>
          </template>
        </div>
        <div class="overflow-y-auto max-h-96">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th>{{ t('table.groupName') }}</th>
                <th>{{ t('table.operation') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in allGroups" :key="group.id">
                <td>{{ group.name }}</td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-xs btn-info" @click="editGroup(group)">
                      {{ t('button.edit') }}
                    </button>
                    <button class="btn btn-xs btn-error" @click="deleteGroup(group.id)">
                      {{ t('button.delete') }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="allGroups.length === 0">
                <td colspan="2" class="text-center text-gray-500">
                  {{ t('data.noGroup') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-action">
        <form method="dialog">
          <button class="btn">{{ t('button.close') }}</button>
        </form>
      </div>
    </div>
  </dialog>

  <!-- 批量设置eligible对话框 -->
  <dialog id="batchGroupDialog" ref="batchGroupDialog" class="border-none modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ t('dialog.batchSetEligible') }}
      </h3>
      <div class="py-4">
        <label class="label cursor-pointer">
          <span class="label-text">{{ t('data.stealthMode') }}</span>
          <input
            v-model="batchEligible" type="checkbox" class="checkbox checkbox-primary"
          >
        </label>
      </div>
      <div class="modal-action">
        <form method="dialog" class="flex gap-3">
          <button class="btn" type="button" @click="batchGroupDialog.close()">
            {{ t('button.cancel') }}
          </button>
          <button class="btn btn-primary" type="button" @click="batchSetEligible">
            {{ t('button.confirm') }}
          </button>
        </form>
      </div>
    </div>
  </dialog>

  <!-- 设置人员分组对话框 -->
  <dialog id="setGroupDialog" ref="setGroupDialog" class="border-none modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ t('dialog.setPersonGroup') }}
      </h3>
      <div class="py-4">
        <div v-if="editingPerson" class="mb-4">
          <p class="text-sm text-gray-600">
            {{ t('dialog.setPersonGroupFor', { name: editingPerson.name }) }}
          </p>
        </div>
        <select v-model="selectedPersonGroupId" class="select select-bordered w-full">
          <option value="">{{ t('data.noGroup') }}</option>
          <option v-for="group in allGroups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </div>
      <div class="modal-action">
        <form method="dialog" class="flex gap-3">
          <button class="btn" type="button" @click="cancelSetGroup">
            {{ t('button.cancel') }}
          </button>
          <button class="btn btn-primary" type="button" @click="savePersonGroup">
            {{ t('button.confirm') }}
          </button>
        </form>
      </div>
    </div>
  </dialog>

  <!-- 批量移动分组对话框 -->
  <dialog id="batchMoveGroupDialog" ref="batchMoveGroupDialog" class="border-none modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{ t('dialog.batchMoveToGroup') }}
      </h3>
      <div class="py-4">
        <p class="mb-4 text-sm text-gray-600">
          {{ t('dialog.batchMoveToGroupHint', { count: selectedPersons.length }) }}
        </p>
        <select v-model="targetGroupId" class="select select-bordered w-full">
          <option value="">{{ t('data.noGroup') }}</option>
          <option v-for="group in allGroups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </div>
      <div class="modal-action">
        <form method="dialog" class="flex gap-3">
          <button class="btn" type="button" @click="batchMoveGroupDialog.close()">
            {{ t('button.cancel') }}
          </button>
          <button class="btn btn-primary" type="button" @click="batchMoveToGroup">
            {{ t('button.confirm') }}
          </button>
        </form>
      </div>
    </div>
  </dialog>

  <div class="min-w-1000px">
    <h2>{{ t('viewTitle.personManagement') }}</h2>
    <div class="flex gap-3 flex-wrap">
      <button class="btn btn-info btn-sm" @click="openGroupManageDialog">
        {{ t('button.groupManagement') }}
      </button>
      <button class="btn btn-warning btn-sm" @click="openBatchEligibleDialog">
        {{ t('button.batchSetEligible') }}
      </button>
      <button 
        class="btn btn-error btn-sm" 
        @click="delAllDataDialog.showModal()"
        :disabled="selectedPersons.length === 0 && !filterGroupId"
      >
        {{ selectedPersons.length > 0 ? `删除选中(${selectedPersons.length})` : filterGroupId ? '删除当前筛选组' : t('button.allDelete') }}
      </button>
      <div class="tooltip tooltip-bottom" :data-tip="t('tooltip.downloadTemplateTip')">
        <a
          class="no-underline btn btn-secondary btn-sm" :download="t('data.xlsxName')" target="_blank"
          :href="`/${t('data.xlsxName')}`"
        >{{ t('button.downloadTemplate') }}</a>
      </div>
      <div class="">
        <label for="explore">

          <div class="tooltip tooltip-bottom" :data-tip="t('tooltip.uploadExcelTip')">
            <input
              id="explore" type="file" class="" style="display: none" :accept="limitType"
              @change="handleFileChange"
            >

            <span class="btn btn-primary btn-sm">{{ t('button.importData') }}</span>
          </div>
        </label>
      </div>
      <button class="btn btn-error btn-sm" @click="resetDataDialog.showModal()">
        {{ t('button.resetData') }}
      </button>
      <button class="btn btn-accent btn-sm" @click="exportData">
        {{ t('button.exportResult') }}
      </button>
      <div>
        <span>{{ t('table.luckyPeopleNumber') }}:</span>
        <span>{{ alreadyPersonList.length }}</span>
        <span>&nbsp;/&nbsp;</span>
        <span>{{ allPersonList.length }}</span>
      </div>
    </div>
    <!-- 筛选和批量操作 -->
    <div class="flex gap-3 mb-4 items-center">
      <label class="form-control w-auto">
        <div class="label">
          <span class="label-text">筛选组</span>
        </div>
        <select v-model="filterGroupId" class="select select-bordered select-sm">
          <option value="">{{ t('data.allGroups') }}</option>
          <option value="ungrouped">未分组</option>
          <option v-for="group in allGroups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </label>
      <div class="flex gap-2 items-end">
        <button 
          class="btn btn-info btn-sm" 
          @click="openBatchMoveGroupDialog"
          :disabled="selectedPersons.length === 0"
        >
          {{ t('button.batchMoveToGroup', { count: selectedPersons.length }) }}
        </button>
        <button class="btn btn-sm" @click="selectAll">
          {{ t('button.selectAll') }}
        </button>
        <button class="btn btn-sm" @click="deselectAll">
          {{ t('button.deselectAll') }}
        </button>
      </div>
    </div>
    
    <!-- 人员列表 -->
    <div class="relative">
      <DaiysuiTable :table-columns="tableColumns" :data="filteredPersonList" />
    </div>
  </div>
</template>

<style lang='scss' scoped></style>
