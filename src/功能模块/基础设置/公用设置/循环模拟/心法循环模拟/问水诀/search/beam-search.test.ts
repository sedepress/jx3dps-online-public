import { describe, expect, it } from '@jest/globals'
import { 获取问水聚合项键, 问水聚合项 } from '../damage/aggregate-policy'
import { 问水伤害表项 } from '../damage/build-damage-table'
import { 创建问水起手状态 } from '../simulator/create-state'
import { 构建问水合法基线 } from './baseline'
import { 搜索问水Beam策略 } from './beam-search'
import {
  穷举问水最优策略,
  评估问水动作序列,
  评估问水策略步骤,
  问水搜索配置,
} from './exhaustive-oracle'

const 技能伤害: Record<string, number> = { '听雷-轻': 100, 黄龙吐翠: 125 }

describe('问水诀 Beam Search', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('%s 秒结果与穷举 Oracle 一致', (seconds) => {
    const config = 创建搜索配置(seconds)
    const oracle = 穷举问水最优策略({ ...config, 最大扩展数: 200_000 })
    const beam = 搜索问水Beam策略({ ...config, Beam宽度: 64, 扩展预算: 200_000 })

    expect(oracle.成功).toBe(true)
    expect(beam.成功).toBe(true)
    if (!oracle.成功 || !beam.成功) return
    expect(beam.最佳候选.期望总伤).toBeCloseTo(oracle.最佳候选.期望总伤)
    expect(beam.最佳候选.主序列).toEqual(oracle.最佳候选.主序列)
    expect(beam.最佳候选.条件规则).toEqual(oracle.最佳候选.条件规则)
  })

  it('相同输入和扩展预算返回完全一致结果', () => {
    const input = { ...创建搜索配置(10), Beam宽度: 8, 扩展预算: 500 }

    expect(搜索问水Beam策略(input)).toEqual(搜索问水Beam策略(input))
  })

  it('搜索结果不低于合法贪心基线', () => {
    const config = 创建搜索配置(10)
    const baseline = 构建问水合法基线({
      初始状态: config.初始状态,
      Excel基线: [],
      贪心动作顺序: ['听雷-轻'],
    })

    expect(baseline.成功).toBe(true)
    if (!baseline.成功) return
    const baselineScore = 评估问水动作序列(config, baseline.动作序列)
    const beam = 搜索问水Beam策略({
      ...config,
      Beam宽度: 4,
      扩展预算: 100,
      基线动作序列: baseline.动作序列,
    })

    expect(baselineScore.成功).toBe(true)
    expect(beam.成功).toBe(true)
    if (!baselineScore.成功 || !beam.成功) return
    expect(beam.最佳候选.期望总伤).toBeGreaterThanOrEqual(baselineScore.候选.期望总伤)
  })

  it('条件回退动作再次触发断潮概率分支并保持概率守恒', () => {
    const config = 创建概率搜索配置()
    const result = 评估问水策略步骤(config, [
      { 类型: '主技能', 技能名称: '听雷-轻' },
      { 类型: '条件规则', 规则: { 技能名称: '断潮', 回退动作: '听雷-轻' } },
    ])

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.候选.分支.reduce((sum, branch) => sum + branch.概率, 0)).toBeCloseTo(1)
    expect(
      result.候选.分支.some(
        (branch) => branch.状态.断潮可用 && Math.abs(branch.概率 - 0.2331) < 1e-9,
      ),
    ).toBe(true)
  })

  it('0.37 断潮条件策略与穷举 Oracle 一致', () => {
    const config = 创建概率搜索配置()
    const oracle = 穷举问水最优策略({ ...config, 最大扩展数: 5_000 })
    const beam = 搜索问水Beam策略({ ...config, Beam宽度: 64, 扩展预算: 5_000 })

    expect(oracle.成功).toBe(true)
    expect(beam.成功).toBe(true)
    if (!oracle.成功 || !beam.成功) return
    expect(beam.最佳候选.期望总伤).toBeCloseTo(oracle.最佳候选.期望总伤)
    expect(beam.最佳候选.主序列).toEqual(oracle.最佳候选.主序列)
    expect(beam.最佳候选.条件规则).toEqual(oracle.最佳候选.条件规则)
    expect(beam.最佳候选.条件规则.length).toBeGreaterThan(0)
  })

  it('缺失伤害表签名时 Oracle 和 Beam 都结构化失败', () => {
    const config = { ...创建搜索配置(2), 伤害表: [] }

    expect(穷举问水最优策略({ ...config, 最大扩展数: 10 })).toEqual({
      成功: false,
      失败原因: '听雷-轻: 伤害表缺少对应签名',
    })
    expect(搜索问水Beam策略({ ...config, Beam宽度: 2, 扩展预算: 10 })).toEqual({
      成功: false,
      失败原因: '听雷-轻: 伤害表缺少对应签名',
    })
  })

  it('扩展预算在动作计算前截断', () => {
    const config = 创建搜索配置(2)
    const firstOnly = { ...config, 伤害表: [config.伤害表[0]] }

    expect(搜索问水Beam策略({ ...firstOnly, Beam宽度: 2, 扩展预算: 1 })).toMatchObject({
      成功: true,
      扩展节点数: 1,
      结束原因: '扩展预算',
    })
    expect(搜索问水Beam策略({ ...firstOnly, Beam宽度: 2, 扩展预算: 2 })).toEqual({
      成功: false,
      失败原因: '黄龙吐翠: 伤害表缺少对应签名',
    })
  })

  it('跨层重复的零帧姿态状态不会耗尽预算', () => {
    const config: 问水搜索配置 = {
      初始状态: 创建问水起手状态({ 战斗秒数: 10, 加速值: 0, 网络延迟: 0 }),
      主技能: ['啸日'],
      条件动作: [],
      伤害表: [],
      最大理论每帧伤害: 0,
    }
    const result = 搜索问水Beam策略({ ...config, Beam宽度: 4, 扩展预算: 100 })

    expect(result).toMatchObject({ 成功: true, 结束原因: '空间收敛' })
    if (!result.成功) return
    expect(result.扩展节点数).toBeLessThan(10)
  })
})

const 创建搜索配置 = (seconds: number): 问水搜索配置 => ({
  初始状态: 创建问水起手状态({ 战斗秒数: seconds, 加速值: 0, 网络延迟: 0 }),
  主技能: Object.keys(技能伤害),
  条件动作: [],
  伤害表: Object.entries(技能伤害).map(([name, damage]) => 创建伤害表项(name, damage)),
  最大理论每帧伤害: Math.max(...Object.values(技能伤害)),
})

const 创建概率搜索配置 = (): 问水搜索配置 => ({
  初始状态: 创建问水起手状态({ 战斗秒数: 3, 加速值: 0, 网络延迟: 0 }),
  主技能: ['听雷-轻'],
  条件动作: [{ 技能名称: '断潮', 回退动作: '听雷-轻' }],
  触发断潮技能: ['听雷-轻'],
  会心率: 0.37,
  伤害表: [创建伤害表项('听雷-轻', 100), 创建伤害表项('断潮-轻', 1000)],
  最大理论每帧伤害: 1000,
})

const 创建伤害表项 = (name: string, damage: number): 问水伤害表项 => {
  const item: 问水聚合项 = {
    技能名称: name,
    技能等级: null,
    增益签名: [],
    快照签名: [],
    施放数量: 1,
    伤害次数: 1,
  }
  return {
    key: 获取问水聚合项键(item),
    技能名称: name,
    技能等级: null,
    增益签名: [],
    快照签名: [],
    单次施放伤害: damage,
  }
}
