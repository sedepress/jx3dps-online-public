import { 小吃类型枚举 } from '@/@types/枚举'
import 外功小药小吃数据 from './外功'
import 内功小药小吃数据 from './内功'

const 问水诀过滤力道小药部位 = [小吃类型枚举.药品辅助, 小吃类型枚举.食品辅助]

const 问水诀小药小吃数据 = 外功小药小吃数据.filter((小吃) => {
  if (!问水诀过滤力道小药部位.includes(小吃.小吃部位)) {
    return true
  }

  return !小吃.小吃名称.includes('（力道）')
})

const 小药小吃数据 = {
  外功: 外功小药小吃数据,
  内功: 内功小药小吃数据,
  天罗诡道: 内功小药小吃数据,
  问水诀: 问水诀小药小吃数据,
}

export default 小药小吃数据
