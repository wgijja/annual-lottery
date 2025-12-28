<script setup lang='ts'>
import type { IPrizeConfig } from '@/types/storeType'
import EditSeparateDialog from '@/components/NumberSeparate/EditSeparateDialog.vue'
import i18n from '@/locales/i18n'
import useStore from '@/store'
import localforage from 'localforage'
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const imageDbStore = localforage.createInstance({
  name: 'imgStore',
})
const prizeConfig = useStore().prizeConfig
const globalConfig = useStore().globalConfig
const groupConfig = useStore().groupConfig
const { getPrizeConfig: localPrizeList, getCurrentPrize: currentPrize } = storeToRefs(prizeConfig)

const { getImageList: localImageList } = storeToRefs(globalConfig)
const { getAllGroups: allGroups } = storeToRefs(groupConfig)
const prizeList = ref(localPrizeList)
const imgList = ref<any[]>([])

const selectedPrize = ref<IPrizeConfig | null>()

function addPrize() {
  const defaultPrizeCOnfig: IPrizeConfig = {
    id: new Date().getTime().toString(),
    name: i18n.global.t('data.prizeName'),
    sort: 0,
    isAll: false,
    count: 1,
    isUsedCount: 0,
    picture: {
      id: '',
      name: '',
      url: '',
    },
    separateCount: {
      enable: false,
      countList: [],
    },
    desc: '',
    isUsed: false,
    isShow: true,
    frequency: 1,
    groupIds: [], // 初始化可抽奖组列表
  }
  prizeConfig.addPrizeConfig(defaultPrizeCOnfig)
}

function selectPrize(item: IPrizeConfig) {
  selectedPrize.value = item
  selectedPrize.value.isUsedCount = 0
  selectedPrize.value.isUsed = false

  if (selectedPrize.value.separateCount.countList.length > 1) {
    return
  }
  selectedPrize.value.separateCount = {
    enable: true,
    countList: [
      {
        id: '0',
        count: item.count,
        isUsedCount: 0,
      },
    ],
  }
}

function changePrizeStatus(item: IPrizeConfig) {
  // if (item.isUsed == true) {
  //     item.isUsedCount = 0;
  //     if (item.separateCount && item.separateCount.countList.length) {
  //         item.separateCount.countList.forEach((countItem: any) => {
  //             countItem.isUsedCount = 0;
  //         })
  //     }
  // }
  // else {
  //     item.isUsedCount = item.count;
  //     if (item.separateCount && item.separateCount.countList.length) {
  //         item.separateCount.countList.forEach((countItem: any) => {
  //             countItem.isUsedCount = countItem.count;
  //         })
  //     }
  // }
  item.isUsed ? item.isUsedCount = 0 : item.isUsedCount = item.count
  item.separateCount.countList = []
  item.isUsed = !item.isUsed
}

function changePrizePerson(item: IPrizeConfig) {
  let indexPrize = -1
  for (let i = 0; i < prizeList.value.length; i++) {
    if (prizeList.value[i].id === item.id) {
      indexPrize = i
      break
    }
  }
  if (indexPrize > -1) {
    prizeList.value[indexPrize].separateCount.countList = []
    prizeList.value[indexPrize].isUsed ? prizeList.value[indexPrize].isUsedCount = prizeList.value[indexPrize].count : prizeList.value[indexPrize].isUsedCount = 0
  }
}

// 切换组的选中状态
function toggleGroup(item: IPrizeConfig, groupId: string) {
  if (!item.groupIds) {
    item.groupIds = []
  }
  const index = item.groupIds.indexOf(groupId)
  if (index > -1) {
    item.groupIds.splice(index, 1)
  }
  else {
    item.groupIds.push(groupId)
  }
}

// 检查组是否被选中
function isGroupSelected(item: IPrizeConfig, groupId: string): boolean {
  return item.groupIds ? item.groupIds.includes(groupId) : false
}

// 获取已选组的名称列表
function getSelectedGroupNames(item: IPrizeConfig): string {
  if (!item.groupIds || item.groupIds.length === 0) {
    return t('data.allGroups')
  }
  return item.groupIds.map((id: string) => {
    const group = allGroups.value.find((g: any) => g.id === id)
    return group ? group.name : id
  }).join(', ')
}
function submitData(value: any) {
  selectedPrize.value!.separateCount.countList = value
  selectedPrize.value = null
}
function resetDefault() {
  prizeConfig.resetDefault()
}

async function getImageDbStore() {
  const keys = await imageDbStore.keys()
  if (keys.length > 0) {
    imageDbStore.iterate((value, key) => {
      imgList.value.push({
        key,
        value,
      })
    })
  }
}

function sort(item: IPrizeConfig, isUp: number) {
  const itemIndex = prizeList.value.indexOf(item)
  if (isUp === 1) {
    prizeList.value.splice(itemIndex, 1)
    prizeList.value.splice(itemIndex - 1, 0, item)
  }
  else {
    prizeList.value.splice(itemIndex, 1)
    prizeList.value.splice(itemIndex + 1, 0, item)
  }
}
function delItem(item: IPrizeConfig) {
  prizeConfig.deletePrizeConfig(item.id)
}
async function delAll() {
  await prizeConfig.deleteAllPrizeConfig()
}
onMounted(() => {
  getImageDbStore()
})
watch(() => prizeList.value, (val: IPrizeConfig[]) => {
  prizeConfig.setPrizeConfig(val)
}, { deep: true })
</script>

<template>
  <div>
    <h2>{{ t('viewTitle.prizeManagement') }}</h2>
    <div class="flex w-full gap-3">
      <button class="btn btn-info btn-sm" @click="addPrize">
        {{ t('button.add') }}
      </button>
      <button class="btn btn-info btn-sm" @click="resetDefault">
        {{ t('button.resetDefault') }}
      </button>
      <button class="btn btn-error btn-sm" @click="delAll">
        {{ t('button.allDelete') }}
      </button>
    </div>
    <div role="alert" class="w-full my-4 alert alert-info">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-6 h-6 stroke-current shrink-0">
        <path
          stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{{ t('dialog.tipResetPrize') }}</span>
    </div>
    <ul class="p-0 m-0">
      <li
        v-for="item in prizeList" :key="item.id" class="flex gap-10"
        :class="currentPrize.id === item.id ? 'border-1 border-dotted rounded-xl' : null"
      >
        <label class="max-w-xs mb-10 form-control">
          <!-- 向上向下 -->
          <div class="flex flex-col items-center gap-2 pt-5">
            <svg-icon
              class="cursor-pointer hover:text-blue-400"
              :class="prizeList.indexOf(item) === 0 ? 'opacity-0 cursor-default' : ''" name="up"
              @click="sort(item, 1)"
            />
            <svg-icon
              class="cursor-pointer hover:text-blue-400" name="down" :class="prizeList.indexOf(item) === prizeList.length - 1 ? 'opacity-0 cursor-default' : ''"
              @click="sort(item, 0)"
            />
          </div>
        </label>
        <label class="w-1/2 max-w-xs mb-10 form-control">
          <div class="label">
            <span class="label-text">{{ t('table.prizeName') }}</span>
          </div>
          <input
            v-model="item.name" type="text" :placeholder="t('placeHolder.name')"
            class="w-full max-w-xs input-sm input input-bordered"
          >
        </label>
        <label class="w-1/2 max-w-xs mb-10 form-control">
          <div class="label">
            <span class="label-text">{{ t('table.fullParticipation') }}</span>
          </div>
          <input
            type="checkbox" :checked="item.isAll" class="mt-2 border-solid checkbox checkbox-secondary border-1"
            @change="item.isAll = !item.isAll"
          >
        </label>
        <label class="w-1/2 max-w-xs mb-10 form-control">
          <div class="label">
            <span class="label-text">{{ t('table.numberParticipants') }}</span>
          </div>
          <input
            v-model="item.count" type="number" :placeholder="t('placeHolder.winnerCount')" class="w-full max-w-xs p-0 m-0 input-sm input input-bordered"
            @change="changePrizePerson(item)"
          >
          <div class="tooltip tooltip-bottom" :data-tip="`${t('table.isDone') + item.isUsedCount}/${item.count}`">
            <progress class="w-full progress" :value="item.isUsedCount" :max="item.count" />
          </div>
        </label>
        <label class="w-1/2 max-w-xs mb-10 form-control">
          <div class="label">
            <span class="label-text">{{ t('table.isDone') }}</span>
          </div>
          <input
            type="checkbox" :checked="item.isUsed" class="mt-2 border-solid checkbox checkbox-secondary border-1"
            @change="changePrizeStatus(item)"
          >
        </label>
        <label class="w-full max-w-xs mb-10 form-control">
          <div class="label">
            <span class="label-text">{{ t('table.lotteryGroups') }}</span>
          </div>
          <div class="dropdown dropdown-bottom">
            <div tabindex="0" role="button" class="btn btn-sm btn-outline w-full justify-between" @click.stop>
              <span>{{ getSelectedGroupNames(item) }}</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto" @click.stop @mousedown.stop>
              <li v-if="allGroups.length === 0">
                <span class="text-gray-500">{{ t('data.noGroup') }}</span>
              </li>
              <li v-for="group in allGroups" :key="group.id" @click.stop @mousedown.stop>
                <label class="cursor-pointer" @click.stop @mousedown.stop>
                  <input
                    type="checkbox" :checked="isGroupSelected(item, group.id)"
                    class="checkbox checkbox-sm"
                    @change="toggleGroup(item, group.id)"
                    @click.stop
                    @mousedown.stop
                  >
                  <span @click.stop="toggleGroup(item, group.id)" @mousedown.stop>{{ group.name }}</span>
                </label>
              </li>
            </ul>
          </div>
          <div class="text-xs text-gray-500 mt-1">
            {{ t('tooltip.lotteryGroupsTip') }}
          </div>
        </label>
        <label class="w-full max-w-xs mb-10 form-control">
          <div class="label">
            <span class="label-text">{{ t('table.image') }}</span>
          </div>
          <select v-model="item.picture" class="w-full max-w-xs select select-warning select-sm">
            <option v-if="item.picture.id" :value="{ id: '', name: '', url: '' }">❌</option>
            <option disabled selected>{{ t('table.selectPicture') }}</option>
            <option v-for="picItem in localImageList" :key="picItem.id" :value="picItem">{{ picItem.name }}
            </option>
          </select>
        </label>
        <label class="w-full max-w-xs mb-10 form-control">
          <div class="label">
            <span class="label-text">{{ t('table.onceNumber') }}</span>
          </div>
          <input
            v-model.number="item.frequency"
            type="number"
            min="1"
            :max="item.count"
            :placeholder="t('placeHolder.winnerCount')"
            class="w-full max-w-xs input-sm input input-bordered"
            @change="changePrizePerson(item)"
          >
        </label>
        <label class="w-full max-w-xs mb-10 form-control">
          <div class="label">
            <span class="label-text">{{ t('table.operation') }}</span>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-error btn-sm" @click="delItem(item)">{{ t('button.delete') }}</button>
          </div>
        </label>
      </li>
    </ul>
    <EditSeparateDialog
      :total-number="selectedPrize?.count" :separated-number="selectedPrize?.separateCount.countList"
      @submit-data="submitData"
    />
  </div>
</template>

<style lang='scss' scoped></style>
