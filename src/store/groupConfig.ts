import type { IGroup } from '@/types/storeType'
import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { watch } from 'vue'
import { useThemeStore, isServerStorageEnabled } from './theme'
import * as api from '@/api/lottery'

// 获取存储key
function getStorageKey() {
  const themeStore = useThemeStore()
  const themeId = themeStore.getCurrentThemeId || 'default'
  return `groupConfig_${themeId}`
}

// 获取当前主题ID
function getCurrentThemeId(): string | null {
  const themeStore = useThemeStore()
  const id = themeStore.getCurrentThemeId
  if (!id || id === 'default' || id === 'undefined') {
    return null
  }
  return id
}

// 从localStorage加载数据
function loadFromLocalStorage() {
  const key = getStorageKey()
  const data = localStorage.getItem(key)
  if (data) {
    try {
      return JSON.parse(data).groupConfig
    }
    catch {
      return null
    }
  }
  return null
}

// 保存到localStorage
function saveToLocalStorage(data: any) {
  const key = getStorageKey()
  localStorage.setItem(key, JSON.stringify({ groupConfig: data }))
}

// 保存到服务器
async function saveToServer(data: any) {
  if (!isServerStorageEnabled()) return
  const themeId = getCurrentThemeId()
  if (!themeId || themeId === 'undefined' || themeId === '') {
    console.warn('[GroupConfig] Cannot save to server: invalid themeId', themeId)
    return
  }
  try {
    await api.saveGroupConfig(themeId, data)
  }
  catch (error) {
    console.error('[GroupConfig] Failed to save to server:', error)
  }
}

// 从服务器加载
async function loadFromServer(): Promise<any> {
  if (!isServerStorageEnabled()) return null
  const themeId = getCurrentThemeId()
  if (!themeId) return null
  try {
    return await api.fetchGroupConfig(themeId)
  }
  catch (error) {
    console.error('[GroupConfig] Failed to load from server:', error)
    return null
  }
}

export const useGroupConfig = defineStore('group', {
  state() {
    return {
      groupList: [] as IGroup[],
    }
  },
  getters: {
    // 获取所有分组
    getAllGroups(state) {
      return state.groupList
    },
    // 根据ID获取分组
    getGroupById(state) {
      return (id: string) => {
        return state.groupList.find(item => item.id === id)
      }
    },
    // 根据ID获取分组名称
    getGroupNameById(state) {
      return (id: string | undefined) => {
        if (!id) return '-'
        const group = state.groupList.find(item => item.id === id)
        return group ? group.name : '-'
      }
    },
  },
  actions: {
    // 添加分组
    addGroup(group: IGroup) {
      this.groupList.push(group)
    },
    // 更新分组
    updateGroup(group: IGroup) {
      const index = this.groupList.findIndex(item => item.id === group.id)
      if (index > -1) {
        this.groupList[index] = { ...group, updateTime: dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss') }
      }
    },
    // 删除分组
    deleteGroup(groupId: string) {
      this.groupList = this.groupList.filter(item => item.id !== groupId)
    },
    // 删除所有分组
    deleteAllGroups() {
      this.groupList = []
    },
    // 重置所有配置
    reset() {
      this.groupList = []
      saveToLocalStorage(this.groupList)
      saveToServer(this.groupList)
    },
    // 从存储加载数据（切换主题时调用）
    async loadFromTheme(enableAutoSaveAfter = true) {
      // 暂停自动保存
      const prevAutoSave = allowAutoSave
      allowAutoSave = false
      
      // 优先从服务器加载
      let data = await loadFromServer()
      
      // 服务器没有数据则从本地加载
      if (!data) {
        data = loadFromLocalStorage()
      }
      
      if (data) {
        // 只有数据真正变化时才更新
        const newDataStr = JSON.stringify(data)
        const oldDataStr = JSON.stringify(this.groupList)
        if (newDataStr !== oldDataStr) {
          this.groupList = data
        }
      }
      else {
        this.groupList = []
      }
      
      // 数据加载完成，恢复自动保存状态
      allowAutoSave = enableAutoSaveAfter ? true : prevAutoSave
    },
    // 保存当前数据
    async saveToTheme() {
      saveToLocalStorage(this.groupList)
      await saveToServer(this.groupList)
    },
  },
})

// 是否允许自动保存（只有数据加载完成后才允许）
let allowAutoSave = false

export function setGroupConfigAutoSave(allow: boolean) {
  allowAutoSave = allow
}

// 防抖保存
let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave(data: any) {
  if (!allowAutoSave) return // 数据未加载完成，不自动保存
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveToLocalStorage(data)
    saveToServer(data)
  }, 500)
}

// 监听数据变化自动保存
export function setupGroupConfigWatcher() {
  const store = useGroupConfig()
  watch(
    () => store.groupList,
    (newData) => {
      debouncedSave(newData)
    },
    { deep: true },
  )
}

