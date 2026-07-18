import { 属性类型 } from '@/@types/属性'
import { 装备信息数据类型 } from '@/@types/装备'
import { 初始化心法数据 } from '@/数据/数据工具/获取当前数据'
import { 根据增益选项获取增益集合, 获取装备增益 } from './增益计算函数'

declare const describe: (name: string, fn: () => void) => void
declare const beforeAll: (fn: () => Promise<void>) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: any

const 获取腰带增伤 = (大附魔档位: number) => {
  const 装备信息 = {
    装备增益: {
      大附魔_伤腰: 大附魔档位,
    },
  } as 装备信息数据类型

  const 增益集合 = 获取装备增益(装备信息, [])
  return 增益集合.find((增益) => 增益.属性 === 属性类型.通用增伤)?.值
}

describe('获取装备增益', () => {
  beforeAll(async () => {
    await 初始化心法数据('问水诀')
  })

  it('大附魔伤腰按普通和英雄档位取不同增伤', () => {
    const 普通腰带增伤 = 获取腰带增伤(1)
    const 英雄腰带增伤 = 获取腰带增伤(2)

    expect(普通腰带增伤).toBeCloseTo((0.038 * 8) / 32, 6)
    expect(英雄腰带增伤).toBeCloseTo((0.045 * 8) / 32, 6)
  })
})

describe('根据增益选项获取增益集合', () => {
  beforeAll(async () => {
    await 初始化心法数据('问水诀')
  })

  it('寒啸千军忽略旧缓存错误层数并按覆盖率计算单层郭氏无双', () => {
    const 增益集合 = 根据增益选项获取增益集合({
      阵眼: '',
      小吃: [],
      团队增益: [
        { 增益名称: '寒啸千军', 启用: true, 层数: 90, 覆盖率: 50 },
        { 增益名称: '号令三军', 启用: true, 层数: 90, 覆盖率: 20 },
      ],
    })

    expect(增益集合).toContainEqual({ 属性: 属性类型.郭氏无双, 值: 25.5 })
    expect(增益集合).toContainEqual({ 属性: 属性类型.无双等级, 值: 14868 })
  })
})
