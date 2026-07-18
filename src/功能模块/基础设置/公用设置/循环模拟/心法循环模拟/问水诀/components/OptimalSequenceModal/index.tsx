import React from 'react'
import { Button, InputNumber, Modal, Typography } from 'antd'
import { CheckOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons'
import { Worker启动参数 } from '../../worker/protocol'
import { 问水Runner结果 } from '../../search/runner'
import SearchStatus from '../SearchStatus'
import SearchResult, { 问水优化展示结果 } from '../SearchResult'
import type { 问水当前循环基线 } from '../adapter'
import { 校验问水战斗时间, use问水最优序列 } from './use-optimal-sequence'
import styles from './index.module.less'

export interface 问水搜索客户端 {
  开始: (
    params: Worker启动参数,
    callbacks: {
      进度?: (message: any) => void
      完成?: (result: 问水Runner结果) => void
      错误?: (error: Error) => void
    },
  ) => string
  取消: (taskId?: string) => void
  销毁: () => void
}

export interface 问水搜索任务 extends Worker启动参数 {
  战斗时间: number
  配置指纹: string
  当前循环基线?: 问水当前循环基线
}

export interface OptimalSequenceModalProps {
  open: boolean
  onClose: () => void
  初始战斗时间: number
  当前DPS: number
  创建客户端: () => 问水搜索客户端
  创建任务: (战斗时间: number) => 问水搜索任务
  转换结果: (result: 问水Runner结果, task: 问水搜索任务) => 问水优化展示结果
  获取当前配置指纹: () => string
  应用结果: (result: 问水优化展示结果) => void
}

interface FooterProps {
  运行中: boolean
  结果?: 问水优化展示结果
  配置已过期: boolean
  开始搜索: () => void
  停止搜索: () => void
  应用当前结果: () => void
}

const ModalFooter = (props: FooterProps) => [
  props.运行中 ? (
    <Button key='stop' danger icon={<StopOutlined />} onClick={props.停止搜索}>
      停止搜索
    </Button>
  ) : (
    <Button key='start' type='primary' icon={<PlayCircleOutlined />} onClick={props.开始搜索}>
      开始搜索
    </Button>
  ),
  <Button
    key='apply'
    icon={<CheckOutlined />}
    disabled={
      !props.结果 || props.配置已过期 || props.运行中 || props.结果.是否优于当前循环 === false
    }
    onClick={props.应用当前结果}
  >
    应用为当前循环
  </Button>,
]

const ModalContent = (props: OptimalSequenceModalProps & ReturnType<typeof use问水最优序列>) => (
  <div className={styles.body}>
    <label className={styles.duration}>
      <span>战斗时长</span>
      <InputNumber
        min={1}
        max={600}
        step={1}
        value={props.战斗时间}
        disabled={props.运行中}
        onChange={(value) => props.设置战斗时间(value)}
        addonAfter='秒'
      />
    </label>
    {props.错误 ? <Typography.Text type='danger'>{props.错误}</Typography.Text> : null}
    <SearchStatus
      {...props.进度}
      战斗时间={props.战斗时间 || 0}
      当前DPS={props.比较基线DPS}
      已用毫秒={props.已用毫秒}
    />
    {props.结果 ? <SearchResult 结果={props.结果} 配置已过期={props.配置已过期} /> : null}
  </div>
)

function OptimalSequenceModal(props: OptimalSequenceModalProps) {
  const state = use问水最优序列(props)

  return (
    <Modal
      title='问水诀最优序列'
      open={props.open}
      onCancel={state.关闭弹窗}
      width={760}
      destroyOnHidden
      footer={<ModalFooter {...state} />}
    >
      <ModalContent {...props} {...state} />
    </Modal>
  )
}

export { 校验问水战斗时间 }
export type { 问水优化展示结果 }
export default OptimalSequenceModal
