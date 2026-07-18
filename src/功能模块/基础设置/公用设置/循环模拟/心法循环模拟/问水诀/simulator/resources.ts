import { 问水待生效事件, 问水模拟状态, 问水技能充能状态 } from '../types'

const 莺鸣柳恢复剑气 = 135
const 最大叠锋意层数 = 3
const 基础剑气上限 = 100
const 每层叠锋意剑气上限 = 100
const 叠锋意持续帧 = 8 * 16
const 三层叠锋意延长帧 = 110
const 近身武器每次命中回剑 = 5
const 技能充能规则 = {
  莺鸣柳: { 充能帧: 25 * 16, 默认层数: 4 },
  啸日: { 充能帧: 12 * 16, 默认层数: 2 },
}
const 近身武器伤害 = new Set([
  '听雷-轻',
  '三柴剑法',
  '黄龙吐翠',
  '平湖断月',
  '九溪弥烟-轻',
  '夕照雷峰',
  '云飞玉皇',
  '云景·云飞玉皇',
  '云飞玉皇·二段',
  '鹤归孤山',
  '风来吴山',
  '四季剑法',
  '断潮',
  '断潮-轻',
])

type 充能技能名称 = keyof typeof 技能充能规则

const 获取技能充能 = (state: 问水模拟状态, 技能名称: 充能技能名称): 问水技能充能状态 => {
  const 默认层数 = 技能充能规则[技能名称].默认层数
  return (
    state.技能充能[技能名称] || {
      当前层数: 默认层数,
      最大层数: 默认层数,
      充能结束帧: [],
    }
  )
}

const 消耗技能充能 = (state: 问水模拟状态, 技能名称: 充能技能名称) => {
  const 充能 = 获取技能充能(state, 技能名称)
  if (充能.当前层数 < 1) return undefined
  const 最后充能帧 = 充能.充能结束帧.at(-1) || state.当前帧
  return {
    ...充能,
    当前层数: 充能.当前层数 - 1,
    充能结束帧: 充能.充能结束帧.concat(最后充能帧 + 技能充能规则[技能名称].充能帧),
  }
}

export const 检查资源动作 = (state: 问水模拟状态, 技能名称: string) => {
  if (!(技能名称 in 技能充能规则)) return undefined
  const 名称 = 技能名称 as 充能技能名称
  return 获取技能充能(state, 名称).当前层数 > 0 ? undefined : `${技能名称}充能不足`
}

const 获取叠锋意结束帧 = (state: 问水模拟状态, 当前层数: number) => {
  const 当前Buff = state.自身Buff.叠锋意
  if (当前层数 < 最大叠锋意层数 || !当前Buff) return state.当前帧 + 叠锋意持续帧
  return 当前Buff.结束帧 + 三层叠锋意延长帧
}

const 应用莺鸣柳 = (state: 问水模拟状态, 新充能: 问水技能充能状态): 问水模拟状态 => {
  const 当前层数 = state.自身Buff.叠锋意?.层数 || 0
  const 新层数 = Math.min(最大叠锋意层数, 当前层数 + 1)
  const 剑气上限 = 基础剑气上限 + 新层数 * 每层叠锋意剑气上限
  return {
    ...state,
    剑气: Math.min(剑气上限, state.剑气 + 莺鸣柳恢复剑气),
    自身Buff: {
      ...state.自身Buff,
      叠锋意: { 层数: 新层数, 获得帧: state.当前帧, 结束帧: 获取叠锋意结束帧(state, 新层数) },
    },
    技能充能: { ...state.技能充能, 莺鸣柳: 新充能 },
  }
}

export const 应用资源动作 = (state: 问水模拟状态, 技能名称: string): 问水模拟状态 => {
  if (技能名称 !== '莺鸣柳' && 技能名称 !== '啸日') return state
  const 名称 = 技能名称 as 充能技能名称
  const 新充能 = 消耗技能充能(state, 名称)
  if (!新充能) return state
  if (名称 === '莺鸣柳') return 应用莺鸣柳(state, 新充能)
  return { ...state, 技能充能: { ...state.技能充能, 啸日: 新充能 } }
}

export const 追加近身武器命中回剑 = (事件: 问水待生效事件[]) =>
  事件.flatMap((item) => {
    if (item.事件类型 !== '伤害' || !item.技能名称 || !近身武器伤害.has(item.技能名称))
      return [item]
    const 命中次数 = Number(item.事件数据?.伤害次数 || 1)
    const 施放权重 = Number(item.事件数据?.施放权重 || 1)
    return [
      item,
      {
        事件类型: '资源' as const,
        生效帧: item.生效帧,
        序号: item.序号 + 1000,
        技能名称: item.技能名称,
        事件数据: { 剑气变化: 近身武器每次命中回剑 * 命中次数 * 施放权重 },
      },
    ]
  })

export const 获取当前剑气上限 = (state: 问水模拟状态) =>
  基础剑气上限 + (state.自身Buff.叠锋意?.层数 || 0) * 每层叠锋意剑气上限

export const 缩短莺鸣柳充能 = (state: 问水模拟状态, 是否触发: boolean): 问水模拟状态 => {
  const 充能 = 获取技能充能(state, '莺鸣柳')
  if (!是否触发 || !充能.充能结束帧.length) return state
  return {
    ...state,
    技能充能: {
      ...state.技能充能,
      莺鸣柳: {
        ...充能,
        充能结束帧: 充能.充能结束帧.map((frame) => Math.max(state.当前帧, frame - 24)),
      },
    },
  }
}

export const 获取技能充能结束帧 = (state: 问水模拟状态) =>
  Object.values(state.技能充能).flatMap((item) => item.充能结束帧)

export const 恢复到时技能充能 = (state: 问水模拟状态, frame: number): 问水模拟状态 => {
  const 技能充能 = Object.fromEntries(
    Object.entries(state.技能充能).map(([name, item]) => {
      const 已恢复层数 = item.充能结束帧.filter((结束帧) => 结束帧 <= frame).length
      return [
        name,
        {
          ...item,
          当前层数: Math.min(item.最大层数, item.当前层数 + 已恢复层数),
          充能结束帧: item.充能结束帧.filter((结束帧) => 结束帧 > frame),
        },
      ]
    }),
  )
  return { ...state, 技能充能 }
}
