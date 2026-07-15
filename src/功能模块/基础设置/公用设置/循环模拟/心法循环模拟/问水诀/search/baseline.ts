import { Excel基线动作 } from '../rules/constants'
import { 获取问水技能定义, 问水技能定义 } from '../rules/skill-definitions'
import { 执行Excel基线 } from '../simulator/baseline-execution'
import { 执行动作 } from '../simulator/engine'
import { 问水动作结果, 问水动作上下文, 问水模拟状态 } from '../types'

const 最大剑气 = 100

interface 构建问水合法基线参数 {
  初始状态: 问水模拟状态
  Excel基线: Excel基线动作[]
  贪心动作顺序: string[]
  动作上下文?: 问水动作上下文
}

interface 合法基线成功结果 {
  成功: true
  来源: 'Excel' | '贪心回退'
  状态: 问水模拟状态
  动作序列: string[]
  回退原因?: string
}

type 合法基线结果 = 合法基线成功结果 | { 成功: false; 失败原因: string }

interface 贪心候选 {
  action: string
  skill?: 问水技能定义
  result: 问水动作结果
}

const 获取新增动作 = (initial: 问水模拟状态, result: 问水模拟状态) =>
  result.技能记录.slice(initial.技能记录.length).map((record) => record.技能名称)

const 获取推进签名 = (state: 问水模拟状态) =>
  JSON.stringify({
    剑气: state.剑气,
    断潮可用: state.断潮可用,
    GCD: state.GCD,
    技能CD: state.技能CD,
    自身Buff: state.自身Buff,
    目标Buff: state.目标Buff,
    团队增益: state.团队增益,
    待生效事件: state.待生效事件,
    伤害事件数量: state.伤害事件.length,
  })

const 动作产生推进 = (before: 问水模拟状态, after: 问水模拟状态) =>
  获取推进签名(before) !== 获取推进签名(after)

const 创建贪心候选 = (state: 问水模拟状态, actions: string[], context: 问水动作上下文) =>
  actions.map((action) => ({
    action,
    skill: 获取问水技能定义(action),
    result: 执行动作(state, action, context),
  }))

const 是合法输出 = (state: 问水模拟状态, candidate: 贪心候选) =>
  candidate.result.成功 && candidate.skill?.造成伤害 && 动作产生推进(state, candidate.result.状态)

const 是合法切换 = (candidate: 贪心候选) => candidate.result.成功 && candidate.skill?.切换姿态

const 切换后有合法输出 = (candidate: 贪心候选, actions: string[], context: 问水动作上下文) =>
  创建贪心候选(candidate.result.状态, actions, context).some((item) =>
    是合法输出(candidate.result.状态, item),
  )

const 选择下一贪心动作 = (state: 问水模拟状态, actions: string[], context: 问水动作上下文) => {
  const candidates = 创建贪心候选(state, actions, context)
  const output = candidates.find((item) => 是合法输出(state, item))
  const stance = candidates.find(是合法切换)
  if (!stance) return output
  const canSwitch = 切换后有合法输出(stance, actions, context)
  if (state.姿态 === '轻剑' && state.剑气 >= 最大剑气 && canSwitch) return stance
  if (state.姿态 === '重剑' && !output && canSwitch) return stance
  return output
}

const 执行合法贪心 = (
  initial: 问水模拟状态,
  actions: string[],
  context: 问水动作上下文,
): 合法基线结果 => {
  if (!actions.length) return { 成功: false, 失败原因: '贪心动作顺序不能为空' }
  const 最大动作数 = Math.max(1, initial.结束帧 * 2 + 2)
  const sequence: string[] = []
  let current = initial
  while (sequence.length < 最大动作数) {
    const next = 选择下一贪心动作(current, actions, context)
    if (!next) return { 成功: true, 来源: '贪心回退', 状态: current, 动作序列: sequence }
    current = next.result.状态
    sequence.push(next.action)
  }
  return { 成功: false, 失败原因: '贪心基线超过最大动作数，可能存在零帧循环' }
}

export const 构建问水合法基线 = ({
  初始状态,
  Excel基线,
  贪心动作顺序,
  动作上下文 = {},
}: 构建问水合法基线参数): 合法基线结果 => {
  const excel = Excel基线.length
    ? 执行Excel基线(初始状态, Excel基线, 动作上下文)
    : { 成功: false, 状态: 初始状态, 执行数量: 0, 失败原因: 'Excel 基线为空' }
  if (excel.成功) {
    return {
      成功: true,
      来源: 'Excel',
      状态: excel.状态,
      动作序列: 获取新增动作(初始状态, excel.状态),
    }
  }
  const greedy = 执行合法贪心(初始状态, 贪心动作顺序, 动作上下文)
  if (!greedy.成功) return greedy
  if (!greedy.动作序列.length) {
    return {
      成功: false,
      失败原因: `Excel 基线失败且贪心基线没有可执行动作: ${excel.失败原因}`,
    }
  }
  return { ...greedy, 回退原因: excel.失败原因 }
}
