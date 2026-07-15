import { 问水动作结果, 问水动作上下文, 问水模拟状态 } from '../types'
import { 获取问水技能定义, 问水技能定义 } from '../rules/skill-definitions'
import { 创建带增益签名的伤害事件 } from './team-buffs'
import { 执行同帧, 获取问水实际帧数 } from './time'
import { 创建命中Buff事件, 获取重剑剑气变化, 消耗碧归层数 } from './buffs'
import { 创建重剑伤害事件, 应用九皋落剑效果 } from './heavy-skills'
import { 比较问水事件 } from './events'

const 最大剑气 = 100
const 空上下文: 问水动作上下文 = {}

const 获取技能起始帧 = (state: 问水模拟状态, 技能名称: string) => {
  const 技能CD结束帧 = state.技能CD[技能名称] || 0
  const 可用帧 = Math.max(state.当前帧, state.GCD.公共, 技能CD结束帧)
  return 可用帧 + (state.技能记录.length ? state.网络延迟 : 0)
}

const 检查动作 = (state: 问水模拟状态, 技能名称: string) => {
  const 技能 = 获取问水技能定义(技能名称)
  if (!技能) return { 技能, 失败原因: '技能未建模' }
  if (技能.姿态 !== '任意' && 技能.姿态 !== state.姿态) {
    return { 技能, 失败原因: '姿态不满足技能要求' }
  }
  if (技能.规则状态 !== '已建模') return { 技能, 失败原因: '技能规则未建模' }
  return { 技能 }
}

const 获取读条帧 = (
  state: 问水模拟状态,
  参数: { 技能名称: string; 技能: 问水技能定义; context: 问水动作上下文 },
) => {
  const { 技能名称, 技能, context } = 参数
  let 基础读条帧 = 技能.基础读条帧 || 0
  if (技能名称 === '夕照雷峰' && (context.秘籍?.夕照雷峰?.length || 0) > 2) {
    基础读条帧 = 22
  }
  return 基础读条帧 ? 获取问水实际帧数(基础读条帧, state.加速值) : 0
}

const 创建动作事件 = (
  state: 问水模拟状态,
  参数: { 技能名称: string; 开始帧: number; 命中帧: number; context: 问水动作上下文 },
) => {
  const { 技能名称, 开始帧, 命中帧, context } = 参数
  if (state.姿态 === '重剑') {
    return 创建重剑伤害事件(state, { 技能名称, 开始帧, 命中帧, context })
  }
  return [
    创建带增益签名的伤害事件(state, {
      技能名称,
      命中帧,
      序号: state.技能记录.length + 1,
    }),
  ]
}

const 应用技能变化 = (
  state: 问水模拟状态,
  参数: { 技能名称: string; 技能: 问水技能定义; 开始帧: number; context: 问水动作上下文 },
): 问水模拟状态 => {
  const { 技能名称, 技能, 开始帧, context } = 参数
  const 剑气变化 =
    state.姿态 === '重剑'
      ? 获取重剑剑气变化(state, { 技能名称, 基础变化: 技能.剑气变化, context })
      : 技能.剑气变化
  const 剑气 = Math.max(0, Math.min(最大剑气, state.剑气 + 剑气变化))
  const GCD帧 = 技能.基础GCD帧 ? Math.max(20, 获取问水实际帧数(技能.基础GCD帧, state.加速值)) : 0
  const 读条帧 = 获取读条帧(state, { 技能名称, 技能, context })
  const 命中帧 = 开始帧 + 读条帧
  const 技能CD = 技能.基础CD帧
    ? 开始帧 + (技能.CD受加速 ? 获取问水实际帧数(技能.基础CD帧, state.加速值) : 技能.基础CD帧)
    : state.技能CD[技能名称]
  const 新状态: 问水模拟状态 = {
    ...state,
    当前帧: 开始帧,
    姿态: 技能.切换姿态 ? (state.姿态 === '轻剑' ? '重剑' : '轻剑') : state.姿态,
    剑气,
    GCD: { ...state.GCD, 公共: 开始帧 + Math.max(GCD帧, 读条帧) },
    技能CD: 技能CD ? { ...state.技能CD, [技能名称]: 技能CD } : state.技能CD,
    技能记录: state.技能记录.concat({
      技能名称,
      开始帧,
      命中帧,
      结束帧: 命中帧,
    }),
  }
  if (!技能.造成伤害) return 新状态
  const 伤害事件 = 创建动作事件(state, { 技能名称, 开始帧, 命中帧, context })
  const Buff事件 = 创建命中Buff事件(技能名称, 命中帧, context)
  const 已消耗碧归 = 消耗碧归层数(新状态, 技能名称, context)
  const 已应用九皋 = 应用九皋落剑效果(已消耗碧归, 技能名称)
  return {
    ...已应用九皋,
    待生效事件: 已应用九皋.待生效事件.concat(伤害事件, Buff事件).sort(比较问水事件),
  }
}

export const 执行动作 = (
  state: 问水模拟状态,
  技能名称: string,
  context: 问水动作上下文 = 空上下文,
): 问水动作结果 => {
  const { 技能, 失败原因 } = 检查动作(state, 技能名称)
  if (!技能 || 失败原因) return { 成功: false, 状态: state, 失败原因 }
  const 剑气变化 =
    state.姿态 === '重剑'
      ? 获取重剑剑气变化(state, { 技能名称, 基础变化: 技能.剑气变化, context })
      : 技能.剑气变化
  if (state.剑气 + 剑气变化 < 0) {
    return { 成功: false, 状态: state, 失败原因: '剑气不足' }
  }
  const 开始帧 = 获取技能起始帧(state, 技能名称)
  if (开始帧 > state.结束帧) {
    return { 成功: false, 状态: state, 失败原因: '超过战斗时长' }
  }
  const 新状态 = 执行同帧(state, 开始帧, (当前状态) =>
    应用技能变化(当前状态, { 技能名称, 技能, 开始帧, context }),
  )
  return { 成功: true, 状态: 新状态 }
}
