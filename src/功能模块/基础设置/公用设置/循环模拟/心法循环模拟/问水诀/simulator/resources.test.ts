import { describe, expect, it } from '@jest/globals'
import { 创建问水起手状态 } from './create-state'
import { 执行动作 } from './engine'
import { 推进到帧 } from './time'

describe('问水诀资源技能', () => {
  it('叠锋意莺鸣柳使用四层充能恢复剑气并最多叠加三层', () => {
    let state: ReturnType<typeof 创建问水起手状态> = {
      ...创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }),
      姿态: '重剑' as const,
    }

    for (let index = 0; index < 4; index += 1) {
      const result = 执行动作(state, '莺鸣柳', { 奇穴: ['叠锋意'] })
      expect(result.成功).toBe(true)
      state = result.状态
    }

    expect(state.剑气).toBe(400)
    expect(state.自身Buff.叠锋意).toMatchObject({ 层数: 3 })
    expect(state.技能充能.莺鸣柳).toEqual({
      当前层数: 0,
      最大层数: 4,
      充能结束帧: [400, 800, 1200, 1600],
    })

    expect(执行动作(state, '莺鸣柳', { 奇穴: ['叠锋意'] })).toMatchObject({
      成功: false,
      失败原因: '莺鸣柳充能不足',
    })
  })

  it('消耗剑气伤害缩短莺鸣柳充能并在到时后恢复一层', () => {
    let state: ReturnType<typeof 创建问水起手状态> = {
      ...创建问水起手状态({ 战斗秒数: 100, 加速值: 0, 网络延迟: 0 }),
      姿态: '重剑' as const,
    }
    for (let index = 0; index < 4; index += 1) {
      const result = 执行动作(state, '莺鸣柳', { 奇穴: ['叠锋意'] })
      if (!result.成功) throw new Error(result.失败原因)
      state = result.状态
    }

    const 夕照 = 执行动作(state, '夕照雷峰', { 奇穴: ['叠锋意'] })
    expect(夕照.成功).toBe(true)
    expect(夕照.状态.技能充能.莺鸣柳.充能结束帧).toEqual([376, 776, 1176, 1576])

    const 恢复后 = 推进到帧(夕照.状态, 376)
    expect(恢复后.技能充能.莺鸣柳).toEqual({
      当前层数: 1,
      最大层数: 4,
      充能结束帧: [776, 1176, 1576],
    })
  })

  it('啸日使用两层充能并每 12 秒恢复一层', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const 第一次 = 执行动作(state, '啸日')
    const 第二次 = 执行动作(第一次.状态, '啸日')
    const 第三次 = 执行动作(第二次.状态, '啸日')

    expect(第二次.状态.技能充能.啸日).toEqual({
      当前层数: 0,
      最大层数: 2,
      充能结束帧: [192, 384],
    })
    expect(第三次).toMatchObject({ 成功: false, 失败原因: '啸日充能不足' })
    expect(推进到帧(第二次.状态, 192).技能充能.啸日).toMatchObject({ 当前层数: 1 })
  })
})
