import { 循环数据 } from '@/@types/循环'
import { 触发秒伤计算 } from '@/计算模块/计算函数'
import { 应用优化循环数据 } from '@/store/data'

export const 应用问水优化循环 = (循环: 循环数据) => (dispatch) => {
  dispatch(应用优化循环数据(循环))
  dispatch(触发秒伤计算({ 是否更新显示计算结果: true }))
}
