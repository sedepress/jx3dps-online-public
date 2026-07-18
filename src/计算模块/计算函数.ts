import useCycle from '@/hooks/use-cycle'
import type { RootState } from '@/store/index'

import { 选中秘籍信息 } from '@/@types/秘籍'
import { 属性加成 } from '@/@types/属性'
import { 增益选项数据类型 } from '@/@types/团队增益'
import { 装备信息数据类型 } from '@/@types/装备'
import { 循环技能详情, 循环详情, 循环数据 } from '@/@types/循环'
import { 当前计算结果类型 } from '@/@types/输出'
import { 技能基础数据模型 } from '@/@types/技能'
import { 更新当前计算结果 } from '@/store/data'
import { INT } from '@/工具函数/help'
import { 判断团队增益轴快照计算 } from '@/数据/团队增益/tools'
import 获取当前数据 from '@/数据/数据工具/获取当前数据'

import { 获取计算目标信息 } from './统一工具函数/工具函数'
import { 获取判断增益后技能系数 } from './统一工具函数/技能增益启用计算'
import { 根据循环判断快照计算列表 } from './统一工具函数/增益计算函数'
import { 根据战斗时间生成循环详情 } from './统一工具函数/战斗时间循环'
import 循环秒伤计算 from './循环秒伤计算'
import 补齐装备特效等级 from '@/功能模块/基础设置/属性录入/配装器/工具函数/根据装备信息获取基础属性/补齐装备特效等级'

interface CurrentDpsFunctionProps {
  是否更新显示计算结果?: boolean // 是否更新当前dps结果

  更新装备信息?: 装备信息数据类型 // 传入的需要更新的装备信息
  更新增益数据?: 增益选项数据类型 // 传入的需要更新团队增益数据
  更新默认增益集合?: 属性加成[] // 用于增益计算
  是否郭氏计算?: boolean // 是否郭氏计算
  更新计算循环名称?: string // 更新循环名称
  更新奇穴数据?: string[] // 更新奇穴数据
  更新秘籍信息?: 选中秘籍信息
  更新增益启用?: boolean
  更新快照计算?: string[]
  更新网络延迟?: number // 是否传入网络延迟计算

  // 用于模拟器计算
  更新计算循环详情?: 循环详情
  更新循环技能列表?: 循环技能详情[]
  更新计算时间?: number

  // 是否计算技能详细情况
  计算技能详情?: boolean
}

export const 秒伤计算 =
  (props?: CurrentDpsFunctionProps) =>
  (dispatch, getState): 当前计算结果类型 => {
    const {
      是否更新显示计算结果 = false,
      更新装备信息 = {},
      更新增益数据 = {},
      是否郭氏计算 = true,
      更新增益启用 = undefined,
      更新计算循环名称 = '',
      // 是否郭氏计算 = false,
      更新计算时间,
      更新循环技能列表,
      更新计算循环详情,
      更新奇穴数据,
      更新秘籍信息,
      更新快照计算,
      更新网络延迟,
      计算技能详情 = true,
    } = props || {}

    // 是否郭氏计算 && console.time('计算耗时')
    const currentState: RootState = getState?.() || {}

    const 网络延迟 = 更新网络延迟 ? 更新网络延迟 : (currentState?.data?.网络延迟 ?? 1)
    const 当前装备信息 = 补齐当前装备特效等级({
      ...currentState?.data?.装备信息,
      ...更新装备信息,
    } as 装备信息数据类型)

    const 当前目标 = 获取计算目标信息(currentState?.data?.当前输出计算目标名称)
    const 增益启用 = 更新增益启用 === undefined ? currentState?.data?.增益启用 : 更新增益启用
    const 当前计算循环名称 = 更新计算循环名称 || currentState?.data?.当前计算循环名称
    const 基础秘籍信息 = 更新秘籍信息 || currentState?.data?.当前秘籍信息
    const 增益数据 = { ...currentState?.data?.增益数据, ...更新增益数据 }
    const 自定义循环列表 = currentState?.data?.自定义循环列表 || []
    const 团队增益轴 = currentState?.data?.团队增益轴 || []
    const { 当前循环信息, 计算循环详情 } = useCycle({
      覆盖数据: {
        装备信息: 当前装备信息,
        增益数据: 增益数据,
        增益启用: 增益启用,
        网络延迟: 网络延迟,
        自定义循环列表: 自定义循环列表,
        当前计算循环名称: 当前计算循环名称,
      },
      使用内存数据: false,
    })
    const 奇穴数据 = 获取实际奇穴数据({
      更新奇穴数据,
      当前奇穴信息: currentState.data.当前奇穴信息,
      当前计算循环名称,
      当前循环信息,
    })

    const 实际计算循环详情 = 更新计算循环详情 ? 更新计算循环详情 : 计算循环详情
    const 是否使用方案战斗时间 =
      !更新计算时间 &&
      !更新计算循环详情 &&
      !更新循环技能列表?.length &&
      实际计算循环详情?.支持战斗时间覆盖
    const 用户选择战斗时间 = 是否使用方案战斗时间
      ? 解析战斗时间选项(currentState?.data?.当前战斗时间)
      : undefined
    const 本次计算循环详情 = 实际计算循环详情
      ? 根据战斗时间生成循环详情(实际计算循环详情, 用户选择战斗时间)
      : 实际计算循环详情
    const 默认秘籍信息 = 获取当前数据()?.默认数据?.秘籍 || {}
    const 当前秘籍信息 = {
      ...默认秘籍信息,
      ...基础秘籍信息,
      ...本次计算循环详情?.秘籍,
    }

    const 当前循环技能列表 = 更新循环技能列表?.length
      ? 更新循环技能列表
      : 本次计算循环详情?.技能详情

    const 快照计算 = 更新快照计算
      ? 更新快照计算
      : 根据循环判断快照计算列表(当前循环技能列表) || 当前循环信息?.快照计算 || []

    const 团队快照计算列表: any[] = 判断团队增益轴快照计算(快照计算, 团队增益轴)

    const 技能基础数据 = 获取判断增益后技能系数({
      秘籍信息: 当前秘籍信息,
      奇穴数据: 奇穴数据,
      装备增益: 当前装备信息?.装备增益,
      团队增益: 增益启用 ? 增益数据 : false,
      团队快照计算列表,
    })

    const 技能数据映射 = new Map<string, 技能基础数据模型>(
      技能基础数据.map((item) => [item.技能名称, item]),
    )

    if (!当前循环技能列表?.length || !当前装备信息?.装备基础属性?.基础攻击) {
      const 计算结果 = { 总伤: 0, 秒伤: 0, 秒伤计算时间: 0, 计算结果技能列表: [] }
      if (是否更新显示计算结果) {
        dispatch?.(更新当前计算结果(计算结果))
      }
      return 计算结果
    }

    const 战斗时间 = 更新计算时间 || 本次计算循环详情?.战斗时间 || 0

    // dps结果计算
    const { 总伤, 计算结果技能列表 } = 循环秒伤计算({
      计算循环: 当前循环技能列表,
      装备信息: 当前装备信息,
      当前目标: 当前目标,
      技能数据映射,
      增益启用: 增益启用,
      增益数据: 增益数据,
      战斗时间,
      是否郭氏计算,
      快照计算: 团队快照计算列表,
      计算循环详情: 本次计算循环详情,
      奇穴数据,
      计算技能详情,
    })

    const 秒伤计算时间 = 本次计算循环详情?.秒伤计算时间 || 战斗时间

    // 每秒dps
    const 秒伤 =
      是否郭氏计算 && 本次计算循环详情?.伤害计算口径 !== 'Excel小数破防防御'
        ? INT(总伤 / 秒伤计算时间)
        : 总伤 / 秒伤计算时间

    const 计算结果 = { 总伤, 秒伤, 秒伤计算时间, 计算结果技能列表 }

    if (是否更新显示计算结果) {
      dispatch?.(更新当前计算结果(计算结果))
    }

    // 是否郭氏计算 && console.timeEnd('计算耗时')

    return 计算结果
  }

// 增加setTimeout，等dispatch的state都更新完了再执行计算函数
export const 触发秒伤计算 = (props?: CurrentDpsFunctionProps) => (dispatch) => {
  setTimeout(() => {
    dispatch?.(秒伤计算(props))
  }, 0)
}

const 补齐当前装备特效等级 = (装备信息: 装备信息数据类型) => {
  if (!装备信息?.装备列表?.length) {
    return 装备信息
  }
  return {
    ...装备信息,
    装备增益: 补齐装备特效等级(装备信息),
  }
}

const 解析战斗时间选项 = (战斗时间选项?: string) => {
  if (!战斗时间选项) {
    return undefined
  }
  if (战斗时间选项 === '∞') {
    return '∞'
  }

  const 战斗时间 = Number(String(战斗时间选项).replace('s', ''))
  return Number.isFinite(战斗时间) && 战斗时间 > 0 ? 战斗时间 : undefined
}

const 标准化循环名称 = (循环名称?: string) => {
  return (循环名称 || '').replace(/叠峰意/g, '叠锋意')
}

const 获取实际奇穴数据 = ({
  更新奇穴数据,
  当前奇穴信息,
  当前计算循环名称,
  当前循环信息,
}: {
  更新奇穴数据?: string[]
  当前奇穴信息?: string[]
  当前计算循环名称?: string
  当前循环信息?: 循环数据
}) => {
  if (更新奇穴数据?.length) {
    return 更新奇穴数据
  }

  const 缓存循环名称 = 标准化循环名称(当前计算循环名称)
  const 实际循环名称 = 标准化循环名称(当前循环信息?.名称)
  const 循环已回退 = 缓存循环名称 && 实际循环名称 && 缓存循环名称 !== 实际循环名称

  if (循环已回退 && 当前循环信息?.奇穴?.length) {
    return 当前循环信息.奇穴
  }

  return 当前奇穴信息 || []
}
