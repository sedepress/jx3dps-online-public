import { 搜索问水Beam策略参数 } from '../search/beam-search'
import { 问水Runner结果 } from '../search/runner'

export interface Worker启动参数 {
  搜索参数: 搜索问水Beam策略参数
  每块扩展数: number
  紧急上限毫秒: number
}

export type Worker入站消息 =
  | { 类型: '开始'; 任务ID: string; 参数: Worker启动参数 }
  | { 类型: '取消'; 任务ID: string }

export type Worker出站消息 =
  | { 类型: '进度'; 任务ID: string; 扩展节点数: number; 扩展预算: number; 当前最佳伤害: number }
  | { 类型: '完成'; 任务ID: string; 结果: 问水Runner结果 }
  | { 类型: '错误'; 任务ID: string; 错误信息: string }
