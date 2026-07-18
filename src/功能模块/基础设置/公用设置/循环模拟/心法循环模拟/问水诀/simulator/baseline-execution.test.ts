import { describe, expect, it } from '@jest/globals'
import { 获取Excel基线 } from '../rules/constants'
import { 创建问水起手状态 } from './create-state'
import { 执行Excel基线 } from './baseline-execution'

describe('问水诀 Excel 基线执行', () => {
  it('保留复合 token 语义并执行斩岳开场二十个动作', () => {
    const initial = {
      ...创建问水起手状态({ 战斗秒数: 220, 加速值: 9232, 网络延迟: 1 }),
      姿态: '重剑' as const,
      剑气: 100,
    }
    const result = 执行Excel基线(initial, 获取Excel基线('紫武', '斩岳').slice(0, 20), {
      奇穴: ['叠锋意', '斩岳', '造化', '山倾', '层云'],
    })

    expect(result).toMatchObject({ 成功: true, 执行数量: 20 })
    expect(result.状态.技能记录.map((item) => item.技能名称)).toEqual(
      expect.arrayContaining(['莺鸣柳', '峰插云景', '云景·云飞玉皇']),
    )
    expect(result.状态.剑气).toBeGreaterThanOrEqual(0)
  })

  it('未知 token 返回结构化失败而不是抛出异常', () => {
    const result = 执行Excel基线(创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }), [
      { 技能: '未知技能', 权重: 1, 序号: 0, 来源列: 'AY', 来源行: 99 },
    ])

    expect(result).toMatchObject({
      成功: false,
      执行数量: 0,
      失败原因: 'AY99 未知技能: 未知 Excel 基线 token',
    })
  })

  it('Excel 模板超过当前战斗时长时保留已执行合法前缀', () => {
    const initial = {
      ...创建问水起手状态({ 战斗秒数: 220, 加速值: 13739, 网络延迟: 1 }),
      姿态: '重剑' as const,
      剑气: 100,
    }
    const result = 执行Excel基线(initial, 获取Excel基线('紫武', '斩岳'), {
      奇穴: ['叠锋意', '斩岳', '造化', '山倾', '层云', '雾锁', '怜光'],
    })

    expect(result).toMatchObject({ 成功: true, 执行数量: 154 })
  })
})
