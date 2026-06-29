import 心法配置 from './index'

declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: any

describe('问水诀 DPS 数据', () => {
  it('提供可计算的期望 DPS 输入数据', () => {
    expect(心法配置.技能系数.length).toBeGreaterThan(10)
    expect(心法配置.计算循环.length).toBeGreaterThan(0)
    expect(心法配置.默认数据.配装.装备基础属性.基础攻击).toBeGreaterThan(0)
  })

  it('包含 Excel 期望 DPS 使用的核心技能与默认循环', () => {
    const 技能名称集合 = new Set(心法配置.技能系数.map((技能) => 技能.技能名称))
    const 默认循环 = 心法配置.计算循环[0]
    const 技能详情 = 默认循环.循环详情[0].技能详情
    const 循环技能集合 = new Set(技能详情.map((技能) => 技能.技能名称))

    ;['云飞玉皇', '夕照雷峰', '断潮', '风来吴山', '听雷-轻'].forEach((技能名称) => {
      expect(技能名称集合.has(技能名称)).toBe(true)
      expect(循环技能集合.has(技能名称)).toBe(true)
    })

    expect(默认循环.循环详情[0].战斗时间).toBe(210)
    expect(技能详情).toHaveLength(59)
    expect(技能详情.reduce((总数, 技能) => 总数 + 技能.技能数量, 0)).toBeCloseTo(879.392191856003)
  })
})
