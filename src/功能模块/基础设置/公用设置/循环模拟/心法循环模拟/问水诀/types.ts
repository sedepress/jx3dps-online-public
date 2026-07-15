export type 问水姿态 = '轻剑' | '重剑'

export interface 问水Buff状态 {
  层数: number
  获得帧: number
  结束帧: number
  快照?: string[]
}

export interface 问水待生效事件 {
  事件类型: '伤害' | 'Buff' | '资源'
  生效帧: number
  序号: number
  技能名称?: string
  增益签名?: string[]
  快照签名?: string[]
  事件数据?: Record<string, number | string | boolean>
}

export interface 问水伤害事件 {
  技能名称: string
  命中帧: number
  伤害次数: number
  技能等级?: number
  增益签名?: string[]
  快照签名?: string[]
}

export interface 问水技能记录 {
  技能名称: string
  开始帧: number
  命中帧: number
  结束帧: number
  是否条件动作?: boolean
}

export interface 问水模拟状态 {
  当前帧: number
  结束帧: number
  姿态: 问水姿态
  剑气: number
  加速值: number
  网络延迟: number
  分支概率: number
  断潮可用: boolean
  自身Buff: Record<string, 问水Buff状态>
  目标Buff: Record<string, 问水Buff状态>
  团队增益: Record<string, 问水Buff状态>
  技能CD: Record<string, number>
  GCD: { 公共: number; 自身: Record<string, number> }
  待生效事件: 问水待生效事件[]
  伤害事件: 问水伤害事件[]
  技能记录: 问水技能记录[]
}

export interface 创建问水状态参数 {
  战斗秒数: number
  加速值: number
  网络延迟: number
}

export interface 问水动作结果 {
  成功: boolean
  状态: 问水模拟状态
  失败原因?: string
}
