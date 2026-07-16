import { 问水伤害事件, 问水动作结果, 问水动作上下文, 问水技能记录, 问水模拟状态 } from '../types'
import {
  从问水伤害事件创建聚合项,
  获取问水伤害键,
  获取问水聚合项键,
  问水压缩伤害,
} from '../damage/damage-key'
import { 执行动作 } from './engine'
import { 比较问水事件 } from './events'
import { 创建带增益签名的伤害事件 } from './team-buffs'

export interface 问水分支历史 {
  概率: number
  技能记录: 问水技能记录[]
  伤害事件: 问水伤害事件[]
}

export interface 问水概率分支 {
  状态: 问水模拟状态
  概率: number
  期望伤害: number
  历史分支?: 问水分支历史[]
  压缩伤害?: 问水压缩伤害
}

interface 断潮条件规则 {
  技能名称: string
  回退动作?: string
}

const 限制概率 = (概率: number) => Math.min(1, Math.max(0, 概率))

const 排序记录 = <T>(record: Record<string, T>) =>
  Object.fromEntries(Object.entries(record).sort(([左], [右]) => 左.localeCompare(右)))

const 获取可观察状态键 = (state: 问水模拟状态) =>
  JSON.stringify({
    当前帧: state.当前帧,
    姿态: state.姿态,
    剑气: state.剑气,
    断潮可用: state.断潮可用,
    自身Buff: 排序记录(state.自身Buff),
    目标Buff: 排序记录(state.目标Buff),
    团队增益: 排序记录(state.团队增益),
    技能CD: 排序记录(state.技能CD),
    GCD: { 公共: state.GCD.公共, 自身: 排序记录(state.GCD.自身) },
    待生效事件: state.待生效事件,
    技能记录数量: state.技能记录.length,
  })

const 是压缩分支 = (branch: 问水概率分支) => branch.压缩伤害 !== undefined

const 缩放压缩伤害 = (伤害: 问水压缩伤害, target: number, source: number) => {
  if (source <= 0) return 伤害
  const ratio = target / source
  return Object.fromEntries(
    Object.entries(伤害).map(([key, item]) => [
      key,
      { ...item, 施放数量: item.施放数量 * ratio, 伤害次数: item.伤害次数 * ratio },
    ]),
  )
}

const 累加压缩项 = (伤害: 问水压缩伤害, event: 问水伤害事件, probability: number) => {
  const key = 获取问水伤害键(event)
  const current = 伤害[key] || 从问水伤害事件创建聚合项(event)
  return {
    ...伤害,
    [key]: {
      ...current,
      施放数量: current.施放数量 + probability,
      伤害次数: current.伤害次数 + probability * event.伤害次数,
    },
  }
}

export const 压缩已结算伤害 = (branch: 问水概率分支): 问水概率分支 => {
  if (!是压缩分支(branch) || !branch.状态.伤害事件.length) return branch
  const 压缩伤害 = branch.状态.伤害事件.reduce(
    (result, event) => 累加压缩项(result, event, branch.概率),
    branch.压缩伤害 || {},
  )
  return { ...branch, 状态: { ...branch.状态, 伤害事件: [] }, 压缩伤害 }
}

const 合并压缩伤害 = (左: 问水压缩伤害, 右: 问水压缩伤害) => {
  const result = { ...左 }
  Object.values(右).forEach((item) => {
    const key = 获取问水聚合项键(item)
    const current = result[key]
    result[key] = current
      ? {
          ...current,
          施放数量: current.施放数量 + item.施放数量,
          伤害次数: current.伤害次数 + item.伤害次数,
        }
      : item
  })
  return result
}

const 缩放历史概率 = (histories: 问水分支历史[], target: number) => {
  const total = histories.reduce((sum, history) => sum + history.概率, 0)
  if (total <= 0) return histories
  const ratio = target / total
  return histories.map((history) => ({ ...history, 概率: history.概率 * ratio }))
}

const 补齐共同后缀 = (branch: 问水概率分支, histories: 问水分支历史[]) => {
  const representative = histories[0]
  if (!representative) return histories
  const skillSuffix = branch.状态.技能记录.slice(representative.技能记录.length)
  const damageSuffix = branch.状态.伤害事件.slice(representative.伤害事件.length)
  if (!skillSuffix.length && !damageSuffix.length) return histories
  return histories.map((history) => ({
    ...history,
    技能记录: history.技能记录.concat(skillSuffix),
    伤害事件: history.伤害事件.concat(damageSuffix),
  }))
}

const 获取分支历史 = (branch: 问水概率分支): 问水分支历史[] => {
  const histories = branch.历史分支?.length
    ? branch.历史分支
    : [{ 概率: branch.概率, 技能记录: branch.状态.技能记录, 伤害事件: branch.状态.伤害事件 }]
  return 缩放历史概率(补齐共同后缀(branch, histories), branch.概率)
}

const 是问水概率分支 = (source: 问水模拟状态 | 问水概率分支): source is 问水概率分支 =>
  '状态' in source

const 创建断潮分支 = (
  source: 问水模拟状态 | 问水概率分支,
  probability: number,
  available: boolean,
): 问水概率分支 => {
  const state = 是问水概率分支(source) ? source.状态 : source
  const branch = {
    状态: { ...state, 分支概率: probability, 断潮可用: available },
    概率: probability,
    期望伤害: 是问水概率分支(source) ? source.期望伤害 : 0,
  }
  if (!是问水概率分支(source)) return branch
  if (是压缩分支(source)) {
    return { ...branch, 压缩伤害: 缩放压缩伤害(source.压缩伤害 || {}, probability, source.概率) }
  }
  return { ...branch, 历史分支: 缩放历史概率(获取分支历史(source), probability) }
}

export const 处理断潮触发 = (
  source: 问水模拟状态 | 问水概率分支,
  会心率: number,
): 问水概率分支[] => {
  const state = 是问水概率分支(source) ? source.状态 : source
  const parentProbability = 是问水概率分支(source) ? source.概率 : state.分支概率
  if (state.断潮可用) {
    return [创建断潮分支(source, parentProbability, true)]
  }
  const 触发概率 = 限制概率(会心率)
  const 未触发概率 = 1 - 触发概率
  const 触发分支概率 = parentProbability * 触发概率
  const 未触发分支概率 = parentProbability * 未触发概率
  return [
    创建断潮分支(source, 触发分支概率, true),
    创建断潮分支(source, 未触发分支概率, false),
  ].filter((item) => item.概率 > 0)
}

export const 选择断潮条件动作 = (state: 问水模拟状态, rule: 断潮条件规则) =>
  state.断潮可用 ? rule.技能名称 : rule.回退动作

const 插入断潮事件 = (state: 问水模拟状态, context: 问水动作上下文): 问水动作结果 => {
  const 技能名称 = state.姿态 === '轻剑' ? '断潮-轻' : '断潮'
  const event = 创建带增益签名的伤害事件(state, {
    技能名称,
    命中帧: state.当前帧,
    序号: state.技能记录.length,
    额外增益签名: state.姿态 === '重剑' && context.奇穴?.includes('怜光') ? ['怜光'] : [],
  })
  return {
    成功: true,
    状态: {
      ...state,
      断潮可用: false,
      待生效事件: state.待生效事件.concat(event).sort(比较问水事件),
      技能记录: state.技能记录.concat({
        技能名称,
        开始帧: state.当前帧,
        命中帧: state.当前帧,
        结束帧: state.当前帧,
        是否条件动作: true,
      }),
    },
  }
}

export const 执行断潮条件规则 = (
  state: 问水模拟状态,
  rule: 断潮条件规则,
  context: 问水动作上下文 = {},
): 问水动作结果 => {
  const action = 选择断潮条件动作(state, rule)
  if (!action) return { 成功: true, 状态: state }
  if (action === '断潮') return 插入断潮事件(state, context)
  return 执行动作(state, action, context)
}

export const 合并可观察分支 = (
  branches: 问水概率分支[],
  getStateKey: (state: 问水模拟状态) => string = 获取可观察状态键,
): 问水概率分支[] => {
  const grouped = new Map<string, 问水概率分支>()
  branches.forEach((branch) => {
    const key = `${是压缩分支(branch) ? 'compact' : 'legacy'}:${getStateKey(branch.状态)}`
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, {
        ...branch,
        状态: { ...branch.状态, 分支概率: branch.概率 },
        ...(是压缩分支(branch)
          ? { 压缩伤害: 合并压缩伤害({}, branch.压缩伤害 || {}) }
          : { 历史分支: 获取分支历史(branch) }),
      })
      return
    }
    const 概率 = current.概率 + branch.概率
    const 期望伤害 =
      概率 === 0 ? 0 : (current.期望伤害 * current.概率 + branch.期望伤害 * branch.概率) / 概率
    grouped.set(key, {
      ...current,
      状态: { ...current.状态, 分支概率: 概率 },
      概率,
      期望伤害,
      ...(是压缩分支(current)
        ? { 压缩伤害: 合并压缩伤害(current.压缩伤害 || {}, branch.压缩伤害 || {}) }
        : { 历史分支: (current.历史分支 || []).concat(获取分支历史(branch)) }),
    })
  })
  return Array.from(grouped.values())
}
