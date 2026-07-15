import { 团队增益轴数据类型, 团队增益轴类型 } from '@/@types/团队增益'
import { 问水待生效事件, 问水模拟状态 } from '../types'
import { 比较问水事件 } from './events'

interface 团队增益窗口 {
  签名: string
  开始帧: number
  结束帧: number
}

interface 创建伤害事件参数 {
  技能名称: string
  命中帧: number
  序号: number
  伤害次数?: number
  技能等级?: number
  是否快照?: boolean
}

const 获取释放帧 = (轴: 团队增益轴数据类型, 结束帧: number) => {
  const 显式时间点 = Array.from(new Set(轴.释放时间点 || []))
    .filter((frame) => frame >= 0 && frame <= 结束帧)
    .sort((a, b) => a - b)
  if (显式时间点.length > 1 || !轴.平均间隔 || 轴.平均间隔 < 1) {
    return 显式时间点.length ? 显式时间点 : [0]
  }
  const 首次释放帧 = 显式时间点[0] || 0
  const 释放帧: number[] = []
  for (let frame = 首次释放帧; frame <= 结束帧; frame += 轴.平均间隔) {
    释放帧.push(frame)
  }
  return 释放帧
}

const 创建普通窗口 = (名称: string, 开始帧: number, 持续时间: number): 团队增益窗口[] => [
  { 签名: `${名称}_快照`, 开始帧, 结束帧: 开始帧 + 持续时间 },
]

const 创建号令窗口 = (开始帧: number, 持续时间: number): 团队增益窗口[] => [
  { 签名: '号令三军_快照_一鼓', 开始帧, 结束帧: 开始帧 + 持续时间 },
  {
    签名: '号令三军_快照_二鼓',
    开始帧: 开始帧 + 持续时间,
    结束帧: 开始帧 + 持续时间 * 2,
  },
]

const 创建增益窗口 = (名称: string, 轴: 团队增益轴数据类型, 结束帧: number) => {
  if (!轴.是否启用快照 || 轴.持续时间 <= 0) {
    return []
  }
  return 获取释放帧(轴, 结束帧).flatMap((开始帧) =>
    名称 === '号令三军'
      ? 创建号令窗口(开始帧, 轴.持续时间)
      : 创建普通窗口(名称, 开始帧, 轴.持续时间),
  )
}

const 创建窗口事件 = (窗口: 团队增益窗口, 序号: number): 问水待生效事件[] => [
  {
    事件类型: 'Buff',
    生效帧: 窗口.开始帧,
    序号,
    技能名称: 窗口.签名,
    事件数据: { 操作: '开始', 层数: 1, 结束帧: 窗口.结束帧 },
  },
  {
    事件类型: 'Buff',
    生效帧: 窗口.结束帧,
    序号: 序号 + 1,
    技能名称: 窗口.签名,
    事件数据: { 操作: '结束' },
  },
]

export const 构建团队增益轴事件 = (团队增益轴: 团队增益轴类型, 结束帧: number) => {
  const 窗口 = Object.entries(团队增益轴).flatMap(([名称, 轴]) => 创建增益窗口(名称, 轴, 结束帧))
  return 窗口.flatMap((item, index) => 创建窗口事件(item, index * 2)).sort(比较问水事件)
}

export const 添加团队增益轴事件 = (state: 问水模拟状态, 团队增益轴: 团队增益轴类型) => ({
  ...state,
  待生效事件: state.待生效事件
    .concat(构建团队增益轴事件(团队增益轴, state.结束帧))
    .sort(比较问水事件),
})

export const 获取当前团队增益签名 = (state: 问水模拟状态) => Object.keys(state.团队增益).sort()

export const 创建带增益签名的伤害事件 = (
  state: 问水模拟状态,
  参数: 创建伤害事件参数,
): 问水待生效事件 => {
  const 增益签名 = 获取当前团队增益签名(state)
  return {
    事件类型: '伤害',
    生效帧: 参数.命中帧,
    序号: 参数.序号,
    技能名称: 参数.技能名称,
    增益签名,
    快照签名: 参数.是否快照 ? 增益签名 : undefined,
    事件数据: { 伤害次数: 参数.伤害次数 ?? 1, 技能等级: 参数.技能等级 ?? 0 },
  }
}
