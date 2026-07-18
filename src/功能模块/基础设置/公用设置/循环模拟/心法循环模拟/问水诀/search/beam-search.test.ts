import { describe, expect, it } from '@jest/globals'
import { 聚合问水策略, 获取问水聚合项键, 问水聚合项 } from '../damage/aggregate-policy'
import { 问水伤害表项 } from '../damage/build-damage-table'
import { 创建问水起手状态 } from '../simulator/create-state'
import { 构建问水合法基线 } from './baseline'
import { 搜索问水Beam策略 } from './beam-search'
import {
  创建问水搜索起点,
  扩展问水搜索候选,
  穷举问水最优策略,
  评估问水动作序列,
  评估问水策略步骤,
  问水搜索配置,
} from './exhaustive-oracle'

const 主技能伤害: Record<string, number> = { '听雷-轻': 100, 黄龙吐翠: 125 }
const 派生技能伤害: Record<string, number> = {
  三柴剑法: 30,
  '新破招(夕)': 200,
  '新破招(云)': 300,
  四季剑法: 40,
}
const 技能伤害 = { ...主技能伤害, ...派生技能伤害 }

describe('问水诀 Beam Search', () => {
  it('保留多个完整终点候选并按近似伤害降序返回', () => {
    const result = 搜索问水Beam策略({
      ...创建搜索配置(5),
      Beam宽度: 8,
      扩展预算: 2_000,
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.候选列表.length).toBeGreaterThan(1)
    expect(result.候选列表.length).toBeLessThanOrEqual(16)
    expect(new Set(result.候选列表.map((candidate) => candidate.主序列.join('|'))).size).toBe(
      result.候选列表.length,
    )
    expect(result.候选列表[0]).toEqual(result.最佳候选)
    result.候选列表.slice(1).forEach((candidate, index) => {
      expect(result.候选列表[index].期望总伤).toBeGreaterThanOrEqual(candidate.期望总伤)
    })
  })

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

  it('主技能按各自会心率触发断潮', () => {
    const config = {
      ...创建概率搜索配置(),
      主技能: ['黄龙吐翠'],
      触发断潮技能: ['黄龙吐翠'],
      会心率映射: { 黄龙吐翠: 0.8 },
      伤害表: [创建伤害表项('黄龙吐翠', 100)],
    }
    const result = 评估问水动作序列(config, ['黄龙吐翠'])

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(
      result.候选.分支
        .filter((branch) => branch.状态.断潮可用)
        .reduce((sum, branch) => sum + branch.概率, 0),
    ).toBeCloseTo(0.8)
  })

  it('自动断潮按会心加固定触发率结算且不占用主动动作', () => {
    const config = {
      ...创建概率搜索配置(),
      条件动作: [],
      自动施放断潮: true,
      断潮固定触发率: 0.3,
    }
    const result = 评估问水动作序列(config, ['听雷-轻'])

    expect(result.成功).toBe(true)
    if (!result.成功) return
    const aggregated = 聚合问水策略({ 分支: result.候选.分支 })
    expect(aggregated.成功).toBe(true)
    if (!aggregated.成功) return
    expect(aggregated.项目.find((item) => item.技能名称 === '断潮-轻')?.施放数量).toBeCloseTo(0.67)
    expect(result.候选.分支).toHaveLength(1)
    expect(result.候选.条件规则).toEqual([])
    expect(result.候选.分支.every((branch) => !branch.状态.断潮可用)).toBe(true)
    expect(
      result.候选.分支[0].状态.待生效事件.some(
        (event) => event.事件类型 === '资源' && event.技能名称 === '断潮-轻',
      ),
    ).toBe(false)
  })

  it('叠锋意每层为断潮追加 10% 固定触发率', () => {
    const base = 创建概率搜索配置()
    const config = {
      ...base,
      初始状态: {
        ...base.初始状态,
        自身Buff: { 叠锋意: { 层数: 2, 获得帧: 0, 结束帧: 100 } },
      },
      条件动作: [],
      自动施放断潮: true,
      断潮固定触发率: 0.3,
    }
    const result = 评估问水动作序列(config, ['听雷-轻'])

    if (!result.成功) throw new Error(result.失败原因)
    const aggregated = 聚合问水策略({ 分支: result.候选.分支 })
    if (!aggregated.成功) throw new Error(aggregated.失败原因)
    expect(aggregated.项目.find((item) => item.技能名称 === '断潮-轻')?.施放数量).toBeCloseTo(0.87)
  })

  it('自动断潮触发率按一次主动技能封顶为 1', () => {
    const base = 创建概率搜索配置()
    const result = 评估问水动作序列(
      {
        ...base,
        初始状态: {
          ...base.初始状态,
          自身Buff: { 叠锋意: { 层数: 3, 获得帧: 0, 结束帧: 100 } },
        },
        自动施放断潮: true,
        断潮固定触发率: 0.3,
        会心率: 0.8,
      },
      ['听雷-轻'],
    )

    if (!result.成功) throw new Error(result.失败原因)
    const aggregated = 聚合问水策略({ 分支: result.候选.分支 })
    if (!aggregated.成功) throw new Error(aggregated.失败原因)
    expect(aggregated.项目.find((item) => item.技能名称 === '断潮-轻')?.施放数量).toBeCloseTo(1)
    expect(
      result.候选.分支[0].状态.待生效事件.some(
        (event) => event.事件类型 === '资源' && event.技能名称 === '断潮-轻',
      ),
    ).toBe(true)
  })

  it('条件回退动作按实际施放技能会心率触发断潮', () => {
    const config = {
      ...创建概率搜索配置(),
      条件动作: [{ 技能名称: '断潮', 回退动作: '黄龙吐翠' }],
      触发断潮技能: ['黄龙吐翠'],
      会心率映射: { 黄龙吐翠: 0.8 },
      伤害表: [创建伤害表项('黄龙吐翠', 100)],
    }
    const result = 评估问水策略步骤(config, [
      { 类型: '条件规则', 规则: { 技能名称: '断潮', 回退动作: '黄龙吐翠' } },
    ])

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(
      result.候选.分支
        .filter((branch) => branch.状态.断潮可用)
        .reduce((sum, branch) => sum + branch.概率, 0),
    ).toBeCloseTo(0.8)
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
      失败原因: '三柴剑法: 伤害表缺少对应签名',
    })
    expect(搜索问水Beam策略({ ...config, Beam宽度: 2, 扩展预算: 10 })).toEqual({
      成功: false,
      失败原因: '三柴剑法: 伤害表缺少对应签名',
    })
  })

  it('扩展预算在动作计算前截断', () => {
    const config = 创建搜索配置(2)
    const firstOnly = {
      ...config,
      伤害表: config.伤害表.filter((item) => ['听雷-轻', '三柴剑法'].includes(item.技能名称)),
    }

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

  it('扩展预算不消耗在姿态不符或 CD 未好的必失败动作上', () => {
    const initial = {
      ...创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }),
      姿态: '重剑' as const,
      剑气: 100,
    }
    const config: 问水搜索配置 = {
      初始状态: initial,
      主技能: ['听雷-轻', '鹤归孤山', '夕照雷峰'],
      条件动作: [],
      伤害表: [
        创建伤害表项('鹤归孤山', 100),
        创建伤害表项('四季剑法', 10),
        创建伤害表项('夕照雷峰', 50),
        创建伤害表项('新破招(夕)', 20),
      ],
      最大理论每帧伤害: 100,
    }
    const start = 创建问水搜索起点(config)
    if (!start.成功) throw new Error(start.失败原因)
    const first = 扩展问水搜索候选(start.候选, config, { 稳定序号: 1, 最多尝试: 1 })

    expect(first).toMatchObject({ 成功: true, 消耗扩展数: 1 })
    if (!first.成功) return
    expect(first.候选[0].主序列).toEqual(['鹤归孤山'])

    const 鹤归后 = first.候选[0]
    const second = 扩展问水搜索候选(鹤归后, config, { 稳定序号: 2, 最多尝试: 1 })
    if (!second.成功) throw new Error(second.失败原因)
    expect(second.候选[0].主序列).toEqual(['鹤归孤山', '夕照雷峰'])
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
    expect(result.扩展节点数).toBeLessThan(20)
  })

  it('技能 CD 中通过内部等待推进到下一次可用帧', () => {
    const initial = {
      ...创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }),
      姿态: '重剑' as const,
      剑气: 100,
    }
    const config: 问水搜索配置 = {
      初始状态: initial,
      主技能: ['鹤归孤山'],
      条件动作: [],
      伤害表: [创建伤害表项('鹤归孤山', 100), 创建伤害表项('四季剑法', 10)],
      最大理论每帧伤害: 100,
    }
    const result = 搜索问水Beam策略({ ...config, Beam宽度: 4, 扩展预算: 100 })

    expect(result).toMatchObject({ 成功: true })
    if (!result.成功) return
    expect(result.最佳候选.主序列).toEqual(['鹤归孤山', '鹤归孤山'])
  })
})

const 创建搜索配置 = (seconds: number): 问水搜索配置 => ({
  初始状态: 创建问水起手状态({ 战斗秒数: seconds, 加速值: 0, 网络延迟: 0 }),
  主技能: Object.keys(主技能伤害),
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
  伤害表: [
    创建伤害表项('听雷-轻', 100),
    创建伤害表项('三柴剑法', 30),
    创建伤害表项('断潮-轻', 1000),
    创建伤害表项('新破招(夕)', 200),
    创建伤害表项('新破招(云)', 300),
    创建伤害表项('四季剑法', 40),
  ],
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
