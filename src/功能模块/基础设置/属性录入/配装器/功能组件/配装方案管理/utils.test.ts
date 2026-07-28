import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { 保存配装方案, 读取配装方案, 配装方案上限, 配装方案数据类型 } from './utils'

describe('配装方案缓存', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.spyOn(Date, 'now').mockReturnValue(100)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('最多保存5套新方案', () => {
    let 方案列表: 配装方案数据类型[] = []
    for (let i = 1; i <= 配装方案上限; i++) {
      方案列表 = 保存配装方案(方案列表, `方案${i}`, { 装备: i })
    }

    expect(方案列表).toHaveLength(5)
    expect(() => 保存配装方案(方案列表, '方案6', {})).toThrow('最多保存5套配装方案')
  })

  it('同名方案会覆盖且不增加数量', () => {
    const 旧方案 = 保存配装方案([], '方案1', { 装备: 1 })
    const 新方案 = 保存配装方案(旧方案, '方案1', { 装备: 2 })

    expect(新方案).toHaveLength(1)
    expect(新方案[0].配装数据).toEqual({ 装备: 2 })
  })

  it('读取损坏缓存时返回空列表', () => {
    localStorage.setItem('测试配装方案', '{bad json')

    expect(读取配装方案('测试配装方案')).toEqual([])
  })
})
