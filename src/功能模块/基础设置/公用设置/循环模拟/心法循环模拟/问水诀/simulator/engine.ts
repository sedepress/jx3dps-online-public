import { 问水动作结果, 问水模拟状态 } from '../types'
import { 获取问水技能定义 } from '../rules/skill-definitions'
import { 创建带增益签名的伤害事件 } from './team-buffs'
import { 执行同帧, 获取问水实际帧数 } from './time'

const 最大剑气 = 100

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

const 应用技能变化 = (
  state: 问水模拟状态,
  技能名称: string,
  技能,
  开始帧: number,
): 问水模拟状态 => {
  const 剑气 = Math.max(0, Math.min(最大剑气, state.剑气 + 技能.剑气变化))
  const GCD帧 = 技能.基础GCD帧 ? Math.max(20, 获取问水实际帧数(技能.基础GCD帧, state.加速值)) : 0
  const 技能CD = 技能.基础CD帧
    ? 开始帧 + 获取问水实际帧数(技能.基础CD帧, state.加速值)
    : state.技能CD[技能名称]
  const 新状态: 问水模拟状态 = {
    ...state,
    当前帧: 开始帧,
    姿态: 技能.切换姿态 ? (state.姿态 === '轻剑' ? '重剑' : '轻剑') : state.姿态,
    剑气,
    GCD: { ...state.GCD, 公共: 开始帧 + GCD帧 },
    技能CD: 技能CD ? { ...state.技能CD, [技能名称]: 技能CD } : state.技能CD,
    技能记录: state.技能记录.concat({
      技能名称,
      开始帧,
      命中帧: 开始帧,
      结束帧: 开始帧,
    }),
  }
  if (!技能.造成伤害) return 新状态
  const 伤害事件 = 创建带增益签名的伤害事件(新状态, {
    技能名称,
    命中帧: 开始帧,
    序号: 新状态.技能记录.length,
  })
  return { ...新状态, 待生效事件: 新状态.待生效事件.concat(伤害事件) }
}

export const 执行动作 = (state: 问水模拟状态, 技能名称: string): 问水动作结果 => {
  const { 技能, 失败原因 } = 检查动作(state, 技能名称)
  if (!技能 || 失败原因) return { 成功: false, 状态: state, 失败原因 }
  const 开始帧 = 获取技能起始帧(state, 技能名称)
  if (开始帧 > state.结束帧) {
    return { 成功: false, 状态: state, 失败原因: '超过战斗时长' }
  }
  const 新状态 = 执行同帧(state, 开始帧, (当前状态) =>
    应用技能变化(当前状态, 技能名称, 技能, 开始帧),
  )
  return { 成功: true, 状态: 新状态 }
}
