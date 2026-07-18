import { Excel基线动作 } from '../rules/constants'
import { 解析问水Excel动作Token } from '../rules/excel-token'
import { 获取问水技能定义 } from '../rules/skill-definitions'
import { 问水动作上下文, 问水模拟状态 } from '../types'
import { 执行动作 } from './engine'
import { 推进到帧 } from './time'

const 空上下文: 问水动作上下文 = {}

interface Excel基线执行结果 {
  成功: boolean
  状态: 问水模拟状态
  执行数量: number
  失败原因?: string
}

const 执行动作并等待CD = (state: 问水模拟状态, action: string, context: 问水动作上下文) => {
  const result = 执行动作(state, action, context)
  if (result.成功 || result.失败原因 !== '技能CD未结束') return result
  const skill = 获取问水技能定义(action)
  const cdFrame = state.技能CD[skill?.CD记录名称 || action]
  if (!cdFrame || cdFrame > state.结束帧) return result
  return 执行动作(推进到帧(state, cdFrame), action, context)
}

const 执行Excel动作Token = (state: 问水模拟状态, token: string, context: 问水动作上下文) => {
  const parsed = 解析问水Excel动作Token(token)
  if (!parsed.成功) {
    return {
      成功: false as const,
      状态: state,
      失败原因: '未知 Excel 基线 token',
      是否超过战斗时长: false,
    }
  }
  let current = state
  for (const action of parsed.前置动作.concat(parsed.主要动作, parsed.后置动作)) {
    const result = 执行动作并等待CD(current, action, context)
    if (!result.成功) {
      return {
        成功: false as const,
        状态: current,
        失败原因: `${action}: ${result.失败原因}`,
        是否超过战斗时长: result.失败原因 === '超过战斗时长',
      }
    }
    current = result.状态
  }
  return { 成功: true as const, 状态: current }
}

export const 执行Excel基线 = (
  state: 问水模拟状态,
  baseline: Excel基线动作[],
  context: 问水动作上下文 = 空上下文,
): Excel基线执行结果 => {
  let current = state
  for (let index = 0; index < baseline.length; index += 1) {
    const source = baseline[index]
    const result = 执行Excel动作Token(current, source.技能, context)
    if (!result.成功) {
      if (result.是否超过战斗时长) {
        return { 成功: true, 状态: current, 执行数量: index }
      }
      return {
        成功: false,
        状态: current,
        执行数量: index,
        失败原因: `${source.来源列}${source.来源行} ${source.技能}: ${result.失败原因}`,
      }
    }
    current = result.状态
  }
  return { 成功: true, 状态: current, 执行数量: baseline.length }
}
