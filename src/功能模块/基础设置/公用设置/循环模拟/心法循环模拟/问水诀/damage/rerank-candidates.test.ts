import { beforeAll, describe, expect, it } from '@jest/globals'
import { 技能总伤害计算入参类型 } from '@/@types/计算'
import { 循环技能详情 } from '@/@types/循环'
import { 技能基础数据模型 } from '@/@types/技能'
import { 获取计算目标信息 } from '@/计算模块/统一工具函数/工具函数'
import 循环秒伤计算 from '@/计算模块/循环秒伤计算'
import { 初始化心法数据 } from '@/数据/数据工具/获取当前数据'
import 心法配置 from '@/心法模块/心法/问水诀'
import { 问水聚合项, 转换问水聚合项为循环 } from './aggregate-policy'
import { 计算问水聚合期望伤害, 构建问水伤害表, 问水伤害计算上下文 } from './build-damage-table'
import { 创建问水伤害快照, 创建问水增益签名解析器 } from './context'
import { 精确重排问水候选 } from './rerank-candidates'

let 计算上下文: 问水伤害计算上下文

beforeAll(async () => {
  await 初始化心法数据('问水诀')
  const { 获取判断增益后技能系数 } = require('@/计算模块/统一工具函数/技能增益启用计算')
  const 循环 = 心法配置.计算循环.find((item) => item.名称 === '叠锋意斩岳循环')
  if (!循环) throw new Error('缺少问水诀斩岳循环')
  const 装备信息 = 心法配置.默认数据.配装
  const 技能基础数据 = 获取判断增益后技能系数({
    秘籍信息: 心法配置.默认数据.秘籍,
    奇穴数据: 循环.奇穴,
    装备增益: 装备信息.装备增益,
    团队增益: false,
    团队快照计算列表: [],
  })
  计算上下文 = {
    装备信息,
    当前目标: 获取计算目标信息('134级木桩'),
    技能数据映射: new Map<string, 技能基础数据模型>(
      技能基础数据.map((item) => [item.技能名称, item]),
    ),
    增益启用: false,
    增益数据: { 阵眼: '', 小吃: [], 团队增益: [] },
    战斗时间: 30,
    是否郭氏计算: true,
    快照计算: [],
    计算循环详情: { 战斗时间: 30, 技能详情: [] },
    奇穴数据: 循环.奇穴,
    计算技能详情: true,
  }
})

const 复算技能详情 = (技能详情: 循环技能详情[]) =>
  循环秒伤计算({
    ...计算上下文,
    计算循环: 技能详情,
    计算循环详情: { ...计算上下文.计算循环详情, 技能详情 },
  } as 技能总伤害计算入参类型)

describe('问水诀伤害表与精确重排', () => {
  it('未知技能构建伤害表时结构化失败', () => {
    const result = 构建问水伤害表({
      项目: [创建聚合项('未知技能')],
      计算上下文,
      解析增益签名: () => [],
    })

    expect(result).toEqual({ 成功: false, 失败原因: '未知技能: 缺少技能系数' })
  })

  it('单次伤害表与小数技能数量内核复算一致', () => {
    const item = { ...创建聚合项('听雷-轻'), 施放数量: 0.37, 伤害次数: 0.37 }
    const table = 构建问水伤害表({
      项目: [item],
      计算上下文,
      解析增益签名: () => [],
    })
    const loop = 转换问水聚合项为循环({ 项目: [item], 解析增益签名: () => [] })

    expect(table.成功).toBe(true)
    expect(loop.成功).toBe(true)
    if (!table.成功 || !loop.成功) return
    const result = 复算技能详情(loop.技能详情)
    const mainSkill = result.计算结果技能列表.find((skill) => skill.技能名称 === '听雷-轻')
    const expectedDamage = 计算问水聚合期望伤害({ 项目: [item], 伤害表: table.表项 })

    expect(table.表项[0].单次施放伤害).toBeGreaterThan(0)
    expect(expectedDamage.成功).toBe(true)
    if (!expectedDamage.成功) return
    expect(expectedDamage.期望总伤).toBeCloseTo(table.表项[0].单次施放伤害 * 0.37)
    expect(mainSkill?.技能总输出).toBeCloseTo(table.表项[0].单次施放伤害 * 0.37)
  })

  it('期望伤害计算缺少表项时明确失败', () => {
    const result = 计算问水聚合期望伤害({ 项目: [创建聚合项('听雷-轻')], 伤害表: [] })

    expect(result).toEqual({ 成功: false, 失败原因: '听雷-轻: 伤害表缺少对应签名' })
  })

  it('同技能不同增益签名生成独立伤害表项', () => {
    const base = 创建聚合项('夕照雷峰')
    const result = 构建问水伤害表({
      项目: [base, { ...base, 增益签名: ['造化1'] }],
      计算上下文,
      解析增益签名: (item) => item.增益签名,
    })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.表项).toHaveLength(2)
    expect(result.表项[0].key).not.toBe(result.表项[1].key)
    expect(result.表项[1].单次施放伤害).toBeGreaterThan(result.表项[0].单次施放伤害)
  })

  it('伤害快照 DTO 可被结构化克隆且不携带 Map', () => {
    const snapshot = 创建问水伤害快照({
      项目: [创建聚合项('听雷-轻')],
      计算上下文,
      解析增益签名: () => [],
    })

    expect(snapshot.成功).toBe(true)
    if (!snapshot.成功) return
    const { deserialize, serialize } = require('v8')
    const cloned = deserialize(serialize(snapshot.快照))
    expect(cloned).toEqual(snapshot.快照)
    expect(cloned.伤害表).not.toBeInstanceOf(Map)
    expect(cloned).toMatchObject({ 版本: 1, 战斗时间: 30, 秒伤计算时间: 30 })
  })

  it('当前技能数据解析事件增益并保留层云层数', () => {
    const resolver = 创建问水增益签名解析器(计算上下文)
    const item = {
      ...创建聚合项('风来吴山'),
      增益签名: ['层云3', '怜光', '造化1'],
    }

    expect(resolver(item)).toEqual(['层云3', '怜光', '造化1'])
    expect(resolver({ ...item, 增益签名: ['未知增益'] })).toBeUndefined()
  })

  it('增益签名解析器创建后不受原始 Map 变更影响', () => {
    const resolver = 创建问水增益签名解析器(计算上下文)
    const original = 计算上下文.技能数据映射.get('风来吴山')
    计算上下文.技能数据映射.delete('风来吴山')

    try {
      expect(resolver({ ...创建聚合项('风来吴山'), 增益签名: ['层云3'] })).toEqual(['层云3'])
    } finally {
      if (original) 计算上下文.技能数据映射.set('风来吴山', original)
    }
  })

  it('层云逐层单次伤害严格递增', () => {
    const resolver = 创建问水增益签名解析器(计算上下文)
    const base = 创建聚合项('风来吴山')
    const items = [base].concat(
      [1, 2, 3, 4, 5].map((level) => ({ ...base, 增益签名: [`层云${level}`] })),
    )
    const result = 构建问水伤害表({ 项目: items, 计算上下文, 解析增益签名: resolver })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    const damages = result.表项.map((item) => item.单次施放伤害)
    expect(damages).toHaveLength(6)
    damages.slice(1).forEach((damage, index) => expect(damage).toBeGreaterThan(damages[index]))
  })

  it('最终候选按现有 DPS 内核结果而不是近似伤害排序', () => {
    const candidates = [
      { id: '听雷', 近似期望伤害: 200, 技能详情: [{ 技能名称: '听雷-轻', 技能数量: 1 }] },
      { id: '夕照', 近似期望伤害: 100, 技能详情: [{ 技能名称: '夕照雷峰', 技能数量: 1 }] },
    ]
    const result = 精确重排问水候选({ 候选: candidates, 计算上下文, 最大复算数: 2 })

    expect(result.成功).toBe(true)
    if (!result.成功) return
    expect(result.候选[0].id).toBe('夕照')
    expect(result.候选[0].精确DPS).toBeGreaterThan(result.候选[1].精确DPS)
  })

  it('精确复算拒绝未知技能候选', () => {
    const result = 精确重排问水候选({
      候选: [{ id: 'invalid', 近似期望伤害: 1, 技能详情: [{ 技能名称: '未知技能', 技能数量: 1 }] }],
      计算上下文,
      最大复算数: 1,
    })

    expect(result).toEqual({ 成功: false, 失败原因: 'invalid: 缺少技能系数 未知技能' })
  })

  it('精确重排拒绝空候选列表', () => {
    const result = 精确重排问水候选({ 候选: [], 计算上下文, 最大复算数: 1 })

    expect(result).toEqual({ 成功: false, 失败原因: '候选列表不能为空' })
  })
})

const 创建聚合项 = (技能名称: string): 问水聚合项 => ({
  技能名称,
  技能等级: null,
  增益签名: [],
  快照签名: [],
  施放数量: 1,
  伤害次数: 1,
})
