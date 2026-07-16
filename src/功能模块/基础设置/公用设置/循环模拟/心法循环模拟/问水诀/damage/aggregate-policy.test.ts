import { describe, expect, it } from '@jest/globals'
import { 创建问水起手状态 } from '../simulator/create-state'
import { 问水概率分支 } from '../simulator/stochastic'
import { 问水伤害事件 } from '../types'
import { 聚合问水策略, 转换问水聚合项为循环 } from './aggregate-policy'

const 创建分支 = (概率: number, 伤害事件: 问水伤害事件[]): 问水概率分支 => ({
  状态: 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 }),
  概率,
  期望伤害: 0,
  历史分支: [{ 概率, 技能记录: [], 伤害事件 }],
})

describe('问水诀策略概率聚合', () => {
  it('断潮成功率 0.37 聚合为技能数量 0.37', () => {
    const result = 聚合问水策略({
      分支: [创建分支(0.37, [{ 技能名称: '断潮', 命中帧: 1, 伤害次数: 1 }]), 创建分支(0.63, [])],
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.总概率).toBeCloseTo(1)
    expect(result.项目).toHaveLength(1)
    expect(result.项目[0]).toMatchObject({ 技能名称: '断潮', 施放数量: 0.37, 伤害次数: 0.37 })
  })

  it('签名顺序不影响聚合但不同快照仍分组', () => {
    const result = 聚合问水策略({
      分支: [
        创建分支(0.2, [
          { 技能名称: '夕照雷峰', 命中帧: 1, 伤害次数: 1, 增益签名: ['造化1', '怜光'] },
        ]),
        创建分支(0.3, [
          { 技能名称: '夕照雷峰', 命中帧: 1, 伤害次数: 1, 增益签名: ['怜光', '造化1'] },
        ]),
        创建分支(0.5, [
          {
            技能名称: '夕照雷峰',
            命中帧: 1,
            伤害次数: 1,
            增益签名: ['怜光', '造化1'],
            快照签名: ['朝圣_快照'],
          },
        ]),
      ],
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.项目).toHaveLength(2)
    expect(result.项目.map((item) => item.施放数量)).toEqual([0.5, 0.5])
    expect(result.项目[0].增益签名).toEqual(['怜光', '造化1'])
  })

  it('多个事件分别累计施放数量和伤害次数', () => {
    const event = { 技能名称: '断潮', 命中帧: 1, 伤害次数: 2 }
    const result = 聚合问水策略({
      分支: [创建分支(0.5, [event, { ...event, 命中帧: 2 }]), 创建分支(0.5, [])],
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.项目[0].施放数量).toBeCloseTo(1)
    expect(result.项目[0].伤害次数).toBeCloseTo(2)
  })

  it('历史绝对概率不再乘父分支概率', () => {
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const result = 聚合问水策略({
      分支: [
        {
          状态: state,
          概率: 0.8,
          期望伤害: 0,
          历史分支: [
            { 概率: 0.3, 技能记录: [], 伤害事件: [{ 技能名称: '断潮', 命中帧: 1, 伤害次数: 1 }] },
            { 概率: 0.5, 技能记录: [], 伤害事件: [{ 技能名称: '断潮', 命中帧: 1, 伤害次数: 1 }] },
          ],
        },
        创建分支(0.2, []),
      ],
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.项目[0].施放数量).toBeCloseTo(0.8)
  })

  it('概率加权压缩伤害与完整历史聚合等价', () => {
    const legacy = 聚合问水策略({
      分支: [
        创建分支(0.25, [{ 技能名称: '断潮', 命中帧: 1, 伤害次数: 2 }]),
        创建分支(0.75, [{ 技能名称: '听雷', 命中帧: 1, 伤害次数: 1 }]),
      ],
    })
    const state = 创建问水起手状态({ 战斗秒数: 30, 加速值: 0, 网络延迟: 0 })
    const compact = 聚合问水策略({
      分支: [
        {
          状态: state,
          概率: 1,
          期望伤害: 0,
          压缩伤害: {
            断潮: { ...创建聚合项('断潮'), 施放数量: 0.25, 伤害次数: 0.5 },
            听雷: { ...创建聚合项('听雷'), 施放数量: 0.75, 伤害次数: 0.75 },
          },
        } as unknown as 问水概率分支,
      ],
    })

    expect(compact).toEqual(legacy)
  })

  it('聚合前结算战斗结束帧内的待生效伤害', () => {
    const state = 创建问水起手状态({ 战斗秒数: 1, 加速值: 0, 网络延迟: 0 })
    const result = 聚合问水策略({
      分支: [
        {
          状态: {
            ...state,
            待生效事件: [
              {
                事件类型: '伤害',
                生效帧: 16,
                序号: 0,
                技能名称: '听雷',
                事件数据: { 伤害次数: 1 },
              },
            ],
          },
          概率: 1,
          期望伤害: 0,
        },
      ],
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.项目[0]).toMatchObject({ 技能名称: '听雷', 施放数量: 1 })
  })

  it('压缩分支在聚合前仍结算剩余待生效伤害', () => {
    const state = 创建问水起手状态({ 战斗秒数: 1, 加速值: 0, 网络延迟: 0 })
    const result = 聚合问水策略({
      分支: [
        {
          状态: {
            ...state,
            待生效事件: [
              {
                事件类型: '伤害',
                生效帧: 16,
                序号: 0,
                技能名称: '听雷',
                事件数据: { 伤害次数: 1 },
              },
            ],
          },
          概率: 1,
          期望伤害: 0,
          压缩伤害: {
            断潮: { ...创建聚合项('断潮'), 施放数量: 0.5, 伤害次数: 0.5 },
          },
        } as unknown as 问水概率分支,
      ],
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.项目).toEqual([
      expect.objectContaining({ 技能名称: '听雷', 施放数量: 1, 伤害次数: 1 }),
      expect.objectContaining({ 技能名称: '断潮', 施放数量: 0.5, 伤害次数: 0.5 }),
    ])
  })

  it('默认拒绝总概率不为 1 的终止路径', () => {
    const result = 聚合问水策略({ 分支: [创建分支(0.8, [])] })

    expect(result).toEqual({ 成功: false, 失败原因: '终止路径总概率必须为 1，当前为 0.8' })
  })

  it('允许未终止概率时仍拒绝总概率超过 1', () => {
    const result = 聚合问水策略({
      分支: [创建分支(0.6, []), 创建分支(0.6, [])],
      允许未终止概率: true,
    })

    expect(result).toEqual({ 成功: false, 失败原因: '终止路径总概率不能超过 1，当前为 1.2' })
  })

  it('显式解析签名并保留小数技能数量和平均伤害层数', () => {
    const result = 转换问水聚合项为循环({
      项目: [
        {
          技能名称: '断潮',
          技能等级: null,
          增益签名: ['怜光', '朝圣_快照'],
          快照签名: ['朝圣_快照'],
          施放数量: 0.37,
          伤害次数: 0.74,
        },
      ],
      解析增益签名: (item) =>
        item.增益签名.map((name) => (name === '朝圣_快照' ? '朝圣快照增益' : name)),
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.技能详情[0]).toMatchObject({
      技能名称: '断潮',
      技能数量: 0.37,
      伤害层数: 2,
      技能增益列表: [{ 增益名称: '怜光,朝圣快照增益', 增益技能数: 0.37 }],
    })
  })

  it('有签名时未提供解析器会结构化失败', () => {
    const result = 转换问水聚合项为循环({
      项目: [
        {
          技能名称: '断潮',
          技能等级: null,
          增益签名: ['朝圣_快照'],
          快照签名: ['朝圣_快照'],
          施放数量: 1,
          伤害次数: 1,
        },
      ],
    })

    expect(result).toEqual({ 成功: false, 失败原因: '断潮: 缺少增益签名解析器' })
  })

  it('解析器无法映射签名时不会静默按无增益计算', () => {
    const result = 转换问水聚合项为循环({
      项目: [
        {
          技能名称: '断潮',
          技能等级: null,
          增益签名: ['未知快照'],
          快照签名: ['未知快照'],
          施放数量: 1,
          伤害次数: 1,
        },
      ],
      解析增益签名: () => undefined,
    })

    expect(result).toEqual({ 成功: false, 失败原因: '断潮: 无法解析增益签名 未知快照' })
  })

  it('转换循环前拒绝非有限伤害次数', () => {
    const result = 转换问水聚合项为循环({
      项目: [{ ...创建聚合项('断潮'), 伤害次数: Number.NaN }],
    })

    expect(result).toEqual({ 成功: false, 失败原因: '断潮: 伤害次数必须为正有限数' })
  })

  it('转换循环前拒绝零伤害次数', () => {
    const result = 转换问水聚合项为循环({
      项目: [{ ...创建聚合项('断潮'), 伤害次数: 0 }],
    })

    expect(result).toEqual({ 成功: false, 失败原因: '断潮: 伤害次数必须为正有限数' })
  })
})

const 创建聚合项 = (技能名称: string) => ({
  技能名称,
  技能等级: null,
  增益签名: [],
  快照签名: [],
  施放数量: 1,
  伤害次数: 1,
})
