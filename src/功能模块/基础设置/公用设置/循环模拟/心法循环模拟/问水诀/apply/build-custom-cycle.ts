import { 选中秘籍信息 } from '@/@types/秘籍'
import { 循环技能详情, 循环数据 } from '@/@types/循环'
import { 问水搜索条件规则 } from '../search/exhaustive-oracle'

export interface 构建问水优化循环参数 {
  战斗时间: number
  奇穴: string[]
  秘籍: 选中秘籍信息
  技能序列: string[]
  条件规则: 问水搜索条件规则[]
  技能详情: 循环技能详情[]
  加速值: number
  网络延迟: number
  配置指纹: string
  扩展预算: number
  提前结束: boolean
  搜索耗时: number
  预期DPS: number
}

const 构建条件规则 = (rules: 问水搜索条件规则[]) =>
  rules.map((rule, index) => ({
    技能名称: rule.技能名称,
    触发条件: '断潮可用',
    优先级: index,
    ...(rule.回退动作 ? { 回退动作: rule.回退动作 } : {}),
  }))

export const 构建问水优化循环 = (params: 构建问水优化循环参数): 循环数据 => {
  const 名称 = `最优序列-${params.战斗时间}s`
  return {
    名称,
    标题: 名称,
    提供者: '最优序列搜索',
    类型: '自定义',
    标记: '自定义',
    强制加速要求: true,
    奇穴: params.奇穴,
    秘籍: params.秘籍,
    技能序列: params.技能序列,
    条件规则: 构建条件规则(params.条件规则),
    循环详情: [
      {
        战斗时间: params.战斗时间,
        循环加速值范围: [params.加速值, params.加速值 + 1],
        循环延迟要求: params.网络延迟,
        技能详情: params.技能详情,
      },
    ],
    优化信息: {
      配置指纹: params.配置指纹,
      扩展预算: params.扩展预算,
      提前结束: params.提前结束,
      搜索耗时: params.搜索耗时,
      预期DPS: params.预期DPS,
    },
  }
}
