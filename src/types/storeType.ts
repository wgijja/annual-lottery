export interface IPersonConfig {
    id: number;
    uid: string;
    name: string;
    department: string;
    identity: string;
    avatar: string;
    isWin: boolean;
    x: number;
    y: number
    createTime: string;
    updateTime: string;
    prizeName: string[];
    prizeId: string[];
    prizeTime: string[];
    groupId?: string; // 所属分组ID
    eligible?: boolean; // 是否可中奖，默认true
}
export interface Separate {
  id: string
  count: number
  isUsedCount: number
}
export interface IPrizeConfig {
  id: number | string
  name: string
  sort: number
  isAll: boolean
  count: number
  isUsedCount: number
  picture: {
    id: string | number
    name: string
    url: string
  }
  separateCount: {
    enable: boolean
    countList: Separate[]
  }
  desc: string
  isShow: boolean
  isUsed: boolean
  frequency: number
  groupIds?: string[] // 可抽奖组ID列表（支持多选）
}
export interface IMusic {
  id: string
  name: string
  url: string
}

export interface IImage {
  id: string
  name: string
  url: string
}

export interface IGroup {
  id: string
  name: string
  createTime: string
  updateTime: string
}
