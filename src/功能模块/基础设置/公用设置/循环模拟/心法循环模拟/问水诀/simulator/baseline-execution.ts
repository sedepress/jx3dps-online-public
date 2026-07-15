import { Excel基线动作 } from '../rules/constants'
import { 问水模拟状态 } from '../types'
import { 执行动作 } from './engine'

interface Excel基线执行结果 {
  成功: boolean
  状态: 问水模拟状态
  执行数量: number
  失败原因?: string
}

const 获取玩家动作 = (token: string) => {
  if (token.includes('云飞玉皇')) return '云飞玉皇'
  if (token.includes('夕照雷峰')) return '夕照雷峰'
  if (token.includes('鹤归孤山')) return '鹤归孤山'
  if (token === '风来吴山') return token
  return undefined
}

export const 执行Excel基线 = (
  state: 问水模拟状态,
  baseline: Excel基线动作[],
): Excel基线执行结果 => {
  let current = state
  for (let index = 0; index < baseline.length; index += 1) {
    const source = baseline[index]
    const action = 获取玩家动作(source.技能)
    if (!action) {
      return {
        成功: false,
        状态: current,
        执行数量: index,
        失败原因: `${source.来源列}${source.来源行} ${source.技能}: 未知 Excel 基线 token`,
      }
    }
    const result = 执行动作(current, action)
    if (!result.成功) {
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
