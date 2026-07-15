import { describe, expect, it } from '@jest/globals'
import { 创建问水起手状态 } from './create-state'

describe('创建问水起手状态', () => {
  it('从轻剑、0 剑气和空职业 Buff 开始', () => {
    const state = 创建问水起手状态({ 战斗秒数: 220, 加速值: 9232, 网络延迟: 1 })

    expect(state).toMatchObject({
      当前帧: 0,
      结束帧: 3520,
      姿态: '轻剑',
      剑气: 0,
      加速值: 9232,
      网络延迟: 1,
      断潮可用: false,
      分支概率: 1,
      自身Buff: {},
      目标Buff: {},
      技能CD: {},
      GCD: { 公共: 0, 自身: {} },
      待生效事件: [],
      伤害事件: [],
      技能记录: [],
    })
  })

  it.each([0, 601, 1.5, Number.NaN])('拒绝无效战斗时长 %s', (战斗秒数) => {
    expect(() => 创建问水起手状态({ 战斗秒数, 加速值: 0, 网络延迟: 0 })).toThrow(
      '战斗时长必须是 1-600 的整数秒',
    )
  })
})
