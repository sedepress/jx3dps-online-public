declare const describe: (name: string, fn: () => void) => void
declare const afterEach: (fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: any
declare const require: any

export {}

describe('获取心法数据', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('只允许加载问水诀，其他心法参数回退到问水诀', async () => {
    const { 获取心法数据 } = require('./获取心法数据')

    const 显式指定其他心法 = await 获取心法数据('孤锋诀')

    expect(显式指定其他心法?.名称).toBe('问水诀')
  })

  it('URL 中其他心法简写回退到问水诀', async () => {
    window.history.pushState({}, '', '/dps?xf=gfj')
    const { 获取心法数据 } = require('./获取心法数据')

    const URL指定其他心法 = await 获取心法数据()

    expect(URL指定其他心法?.名称).toBe('问水诀')
  })
})
