import { 每秒郭氏帧 as 项目每秒郭氏帧 } from '@/数据/常量'
import 碧归1 from './excel-baseline-bigui-1.generated'
import 碧归2 from './excel-baseline-bigui-2.generated'
import 碧归3 from './excel-baseline-bigui-3.generated'
import 斩岳1 from './excel-baseline-zhanyue-1.generated'
import 斩岳2 from './excel-baseline-zhanyue-2.generated'
import 斩岳3 from './excel-baseline-zhanyue-3.generated'

export const 每秒郭氏帧 = 项目每秒郭氏帧

export interface Excel基线动作 {
  技能: string
  权重: number
  序号: number
  来源列: 'AY' | 'BI'
  来源行: number
}

type Excel基线元组 = readonly [string, number, number]
type 武器类型 = '紫武' | '橙武'
type 奇穴类型 = '斩岳' | '碧归'

const 创建基线 = (
  数据: readonly Excel基线元组[],
  来源列: Excel基线动作['来源列'],
): Excel基线动作[] => {
  return 数据.map(([技能, 权重, 来源行], 序号) => ({
    技能,
    权重,
    序号,
    来源列,
    来源行,
  }))
}

const 斩岳基线 = 创建基线([...斩岳1, ...斩岳2, ...斩岳3], 'AY')
const 碧归基线 = 创建基线([...碧归1, ...碧归2, ...碧归3], 'BI')

export const 获取Excel基线 = (武器: 武器类型, 奇穴: 奇穴类型): Excel基线动作[] => {
  if (武器 === '紫武' && 奇穴 === '斩岳') return 斩岳基线
  if (武器 === '橙武' && 奇穴 === '碧归') return 碧归基线
  return []
}
