import { describe, expect, it } from '@jest/globals'
import { 创建问水起手状态 } from './create-state'
import { 执行动作 } from './engine'
import { 推进到帧 } from './time'

describe('问水诀职业 Buff', () => {
  it('夕照命中后添加 15 秒雾锁，后续技能携带雾锁签名', () => {
    const state = {
      ...创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }),
      姿态: '重剑' as const,
      剑气: 100,
    }
    const 夕照 = 执行动作(state, '夕照雷峰', { 奇穴: ['雾锁'] })
    const 命中后 = 推进到帧(夕照.状态, 夕照.状态.技能记录[0].命中帧)
    const 云飞 = 执行动作({ ...命中后, 当前帧: 命中后.GCD.公共, 剑气: 100 }, '云飞玉皇')

    expect(命中后.自身Buff.雾锁.结束帧).toBe(夕照.状态.技能记录[0].命中帧 + 240)
    expect(云飞.状态.待生效事件.find((item) => item.技能名称 === '云飞玉皇')?.增益签名).toContain(
      '雾锁',
    )
  })

  it('层云只进入风来签名，怜光进入所有重剑伤害签名', () => {
    const state = {
      ...创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }),
      姿态: '重剑' as const,
      剑气: 100,
    }
    const 风来 = 执行动作(state, '风来吴山', { 奇穴: ['层云', '怜光'] })

    expect(风来.状态.待生效事件[0].增益签名).toEqual(['层云', '怜光'])
  })
})
