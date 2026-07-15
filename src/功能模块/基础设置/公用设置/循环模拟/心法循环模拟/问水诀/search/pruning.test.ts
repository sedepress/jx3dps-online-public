import { describe, expect, it } from '@jest/globals'
import { 获取Excel基线 } from '../rules/constants'
import { 创建问水起手状态 } from '../simulator/create-state'
import { 执行动作 } from '../simulator/engine'
import { 构建问水合法基线 } from './baseline'
import { 获取问水状态键 } from './state-key'
import { 计算问水乐观上界 } from './upper-bound'

const 创建基础状态 = () => 创建问水起手状态({ 战斗秒数: 2, 加速值: 0, 网络延迟: 0 })

describe('问水诀搜索剪枝基础', () => {
  it('未来决策等价状态生成相同键且关键状态差异不会碰撞', () => {
    const base = 创建基础状态()
    const historical = {
      ...base,
      分支概率: 0.37,
      技能记录: [{ 技能名称: '旧记录', 开始帧: 0, 命中帧: 0, 结束帧: 0 }],
      伤害事件: [{ 技能名称: '旧伤害', 命中帧: 0, 伤害次数: 1 }],
    }
    const equivalent = {
      ...historical,
      分支概率: 0.63,
      技能记录: [{ 技能名称: '另一条旧记录', 开始帧: 0, 命中帧: 0, 结束帧: 0 }],
      伤害事件: [],
    }

    expect(获取问水状态键(historical)).toBe(获取问水状态键(equivalent))
    const variants = [
      { ...historical, 剑气: 1 },
      { ...historical, 姿态: '重剑' as const },
      { ...historical, 断潮可用: true },
      { ...historical, 自身Buff: { 层云: { 层数: 1, 获得帧: 0, 结束帧: 16 } } },
      { ...historical, 技能CD: { 云飞玉皇: 32 } },
    ]
    variants.forEach((state) => expect(获取问水状态键(state)).not.toBe(获取问水状态键(historical)))
  })

  it('无待生效事件时忽略完整历史数量和 Buff 获得帧', () => {
    const base = {
      ...创建基础状态(),
      自身Buff: { 碧归: { 层数: 2, 获得帧: 1, 结束帧: 24 } },
      技能记录: [{ 技能名称: '听雷-轻', 开始帧: 0, 命中帧: 0, 结束帧: 0 }],
    }
    const equivalent = {
      ...base,
      自身Buff: { 碧归: { 层数: 2, 获得帧: 8, 结束帧: 24 } },
      技能记录: base.技能记录.concat({ 技能名称: '黄龙吐翠', 开始帧: 0, 命中帧: 0, 结束帧: 0 }),
    }

    expect(获取问水状态键(base)).toBe(获取问水状态键(equivalent))
  })

  it('同帧同序号事件的原始稳定顺序不同时状态键不同', () => {
    const first = { 事件类型: '伤害' as const, 生效帧: 8, 序号: 1, 技能名称: '听雷-轻' }
    const second = {
      事件类型: 'Buff' as const,
      生效帧: 8,
      序号: 1,
      技能名称: '测试Buff',
      事件数据: { 操作: '开始', 作用对象: '自身', 层数: 1, 结束帧: 16 },
    }

    expect(获取问水状态键({ ...创建基础状态(), 待生效事件: [first, second] })).not.toBe(
      获取问水状态键({ ...创建基础状态(), 待生效事件: [second, first] }),
    )
  })

  it('乐观上界不低于短时长穷举的真实最优剩余伤害', () => {
    const state = 创建基础状态()
    const damages: Record<string, number> = { '听雷-轻': 100, 黄龙吐翠: 125 }
    const optimal = 穷举剩余伤害(state, Object.keys(damages), damages)
    const upperBound = 计算问水乐观上界({ 状态: state, 已累积伤害: 0, 最大理论每帧伤害: 125 })

    expect(optimal).toBe(250)
    expect(upperBound).toBeGreaterThanOrEqual(optimal)
  })

  it('Excel 基线非法时从初始状态回退到合法贪心基线并记录原因', () => {
    const initial = 创建问水起手状态({ 战斗秒数: 3, 加速值: 0, 网络延迟: 0 })
    const result = 构建问水合法基线({
      初始状态: initial,
      Excel基线: 获取Excel基线('紫武', '斩岳'),
      贪心动作顺序: ['听雷-轻'],
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.来源).toBe('贪心回退')
    expect(result.回退原因).toBe('AY3 鹤归孤山: 姿态不满足技能要求')
    expect(result.动作序列.length).toBeGreaterThan(0)
    expect(new Set(result.动作序列)).toEqual(new Set(['听雷-轻']))
    expect(重放动作(initial, result.动作序列)).toEqual({
      成功: true,
      执行数量: result.动作序列.length,
    })
  })

  it('Excel 基线可执行时保留 Excel 结果而不进入贪心回退', () => {
    const initial = { ...创建基础状态(), 姿态: '重剑' as const, 剑气: 100 }
    const result = 构建问水合法基线({
      初始状态: initial,
      Excel基线: [{ 技能: '夕照雷峰', 权重: 1, 序号: 0, 来源列: 'AY', 来源行: 5 }],
      贪心动作顺序: ['听雷-轻'],
    })

    expect(result).toMatchObject({ 成功: true, 来源: 'Excel', 动作序列: ['夕照雷峰'] })
  })

  it('Excel 基线按当前动作上下文生成技能事件', () => {
    const initial = { ...创建基础状态(), 姿态: '重剑' as const, 剑气: 100 }
    const result = 构建问水合法基线({
      初始状态: initial,
      Excel基线: [{ 技能: '夕照雷峰', 权重: 1, 序号: 0, 来源列: 'AY', 来源行: 5 }],
      贪心动作顺序: ['听雷-轻'],
      动作上下文: { 奇穴: ['怜光'] },
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    const damageEvent = result.状态.待生效事件.find((event) => event.事件类型 === '伤害')
    expect(damageEvent?.增益签名).toContain('怜光')
  })

  it('贪心积满剑气后切换重剑输出且不会连续零帧切换', () => {
    const result = 构建问水合法基线({
      初始状态: 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 }),
      Excel基线: 获取Excel基线('紫武', '斩岳'),
      贪心动作顺序: ['啸日', '听雷-轻', '夕照雷峰'],
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    const switchIndex = result.动作序列.indexOf('啸日')
    expect(switchIndex).toBeGreaterThan(0)
    expect(result.动作序列.slice(0, switchIndex)).toEqual(Array(switchIndex).fill('听雷-轻'))
    expect(result.动作序列[switchIndex + 1]).toBe('夕照雷峰')
    expect(result.动作序列.join(',')).not.toContain('啸日,啸日')
  })

  it('Excel 和贪心动作都不可执行时不会返回空成功候选', () => {
    const result = 构建问水合法基线({
      初始状态: 创建基础状态(),
      Excel基线: 获取Excel基线('紫武', '斩岳'),
      贪心动作顺序: ['未知技能'],
    })

    expect(result).toEqual({
      成功: false,
      失败原因: 'Excel 基线失败且贪心基线没有可执行动作: AY3 鹤归孤山: 姿态不满足技能要求',
    })
  })
})

const 穷举剩余伤害 = (
  state: ReturnType<typeof 创建基础状态>,
  actions: string[],
  damages: Record<string, number>,
) => {
  let best = 0
  actions.forEach((action) => {
    const result = 执行动作(state, action)
    if (!result.成功) return
    best = Math.max(best, damages[action] + 穷举剩余伤害(result.状态, actions, damages))
  })
  return best
}

const 重放动作 = (state: ReturnType<typeof 创建基础状态>, actions: string[]) => {
  let current = state
  for (let index = 0; index < actions.length; index += 1) {
    const result = 执行动作(current, actions[index])
    if (!result.成功) return { 成功: false, 执行数量: index }
    current = result.状态
  }
  return { 成功: true, 执行数量: actions.length }
}
