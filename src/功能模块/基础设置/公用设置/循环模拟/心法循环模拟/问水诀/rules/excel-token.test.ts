import { describe, expect, it } from '@jest/globals'
import { 解析问水Excel动作Token } from './excel-token'

describe('问水诀 Excel 动作 token', () => {
  it.each([
    ['叠1-鹤归孤山', { 前置动作: ['莺鸣柳'], 主要动作: '鹤归孤山', 后置动作: [] }],
    ['鹤归孤山-叠', { 前置动作: ['莺鸣柳'], 主要动作: '鹤归孤山', 后置动作: [] }],
    ['云飞玉皇-峰插', { 前置动作: [], 主要动作: '云飞玉皇', 后置动作: ['峰插云景'] }],
    ['夕照雷峰-峰插', { 前置动作: [], 主要动作: '夕照雷峰', 后置动作: ['峰插云景'] }],
    ['云景·云飞玉皇', { 前置动作: [], 主要动作: '云景·云飞玉皇', 后置动作: [] }],
    ['听雷-轻', { 前置动作: ['啸日'], 主要动作: '听雷-轻', 后置动作: ['啸日'] }],
  ])('解析 %s', (token, expected) => {
    expect(解析问水Excel动作Token(token)).toEqual({ 成功: true, token, ...expected })
  })

  it('未知修饰符返回结构化失败', () => {
    expect(解析问水Excel动作Token('云飞玉皇-未知修饰')).toEqual({
      成功: false,
      失败原因: '云飞玉皇-未知修饰: 未知 Excel 动作 token',
    })
  })
})
