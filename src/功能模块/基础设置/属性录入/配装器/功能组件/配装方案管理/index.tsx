import React, { useState } from 'react'
import { Alert, App, Button, Input, List, Modal, Radio, Space } from 'antd'
import 获取当前数据 from '@/数据/数据工具/获取当前数据'
import { 持久化配装方案, 保存配装方案, 读取配装方案, 配装方案上限, 配装方案数据类型 } from './utils'

interface 配装方案管理属性 {
  获取表单信息: () => Promise<Record<string, any>>
  保存数据并计算: (配装数据: Record<string, any>) => void
}

function 配装方案管理(props: 配装方案管理属性) {
  const { 获取表单信息, 保存数据并计算 } = props
  const { message, modal } = App.useApp()
  const [保存弹窗, 设置保存弹窗] = useState(false)
  const [读取弹窗, 设置读取弹窗] = useState(false)
  const [方案名称, 设置方案名称] = useState('')
  const [选中方案, 设置选中方案] = useState<string>()
  const [方案列表, 设置方案列表] = useState<配装方案数据类型[]>([])

  const 获取缓存键 = () => 获取当前数据()?.缓存映射?.配装方案

  const 刷新方案列表 = () => {
    const 新方案列表 = 读取配装方案(获取缓存键())
    设置方案列表(新方案列表)
    return 新方案列表
  }

  const 打开保存弹窗 = () => {
    刷新方案列表()
    设置方案名称('')
    设置保存弹窗(true)
  }

  const 打开读取弹窗 = () => {
    const 新方案列表 = 刷新方案列表()
    设置选中方案(新方案列表[0]?.名称)
    设置读取弹窗(true)
  }

  const 保存当前配装 = async () => {
    const 名称 = 方案名称.trim()
    if (!名称) return

    try {
      const 配装数据 = await 获取表单信息()
      const 新方案列表 = 保存配装方案(方案列表, 名称, 配装数据)
      持久化配装方案(获取缓存键(), 新方案列表)
      设置方案列表(新方案列表)
      设置保存弹窗(false)
      message.success(`配装方案【${名称}】已保存`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存配装方案失败')
    }
  }

  const 读取选中配装 = () => {
    const 方案 = 方案列表.find((item) => item.名称 === 选中方案)
    if (!方案) return

    保存数据并计算(JSON.parse(JSON.stringify(方案.配装数据)))
    设置读取弹窗(false)
    message.success(`已读取配装方案【${方案.名称}】`)
  }

  const 删除方案 = (方案: 配装方案数据类型) => {
    modal.confirm({
      title: `确定删除配装方案【${方案.名称}】吗？`,
      content: '删除后无法恢复',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: () => {
        const 新方案列表 = 方案列表.filter((item) => item.名称 !== 方案.名称)
        持久化配装方案(获取缓存键(), 新方案列表)
        设置方案列表(新方案列表)
        设置选中方案((当前名称) => (当前名称 === 方案.名称 ? 新方案列表[0]?.名称 : 当前名称))
      },
    })
  }

  return (
    <>
      <Space style={{ marginRight: 8 }}>
        <Button onClick={打开保存弹窗}>保存配装方案</Button>
        <Button onClick={打开读取弹窗}>读取配装方案</Button>
      </Space>
      <Modal
        title='保存配装方案'
        open={保存弹窗}
        okText='保存'
        onOk={保存当前配装}
        okButtonProps={{ disabled: !方案名称.trim() }}
        onCancel={() => 设置保存弹窗(false)}
        destroyOnClose
      >
        <Alert
          type='info'
          showIcon
          message={`最多保存${配装方案上限}套；输入已有名称将覆盖原方案。`}
          style={{ marginBottom: 16 }}
        />
        <Input
          autoFocus
          maxLength={20}
          showCount
          value={方案名称}
          placeholder='请输入配装方案名称'
          onChange={(event) => 设置方案名称(event.target.value)}
          onPressEnter={保存当前配装}
        />
      </Modal>
      <Modal
        title={`读取配装方案（${方案列表.length}/${配装方案上限}）`}
        open={读取弹窗}
        okText='读取'
        onOk={读取选中配装}
        okButtonProps={{ disabled: !选中方案 }}
        onCancel={() => 设置读取弹窗(false)}
        destroyOnClose
      >
        {方案列表.length ? (
          <Radio.Group
            value={选中方案}
            onChange={(event) => 设置选中方案(event.target.value)}
            style={{ width: '100%' }}
          >
            <List
              bordered
              dataSource={方案列表}
              renderItem={(方案) => (
                <List.Item
                  actions={[
                    <Button type='link' danger key='delete' onClick={() => 删除方案(方案)}>
                      删除
                    </Button>,
                  ]}
                >
                  <Radio value={方案.名称}>{方案.名称}</Radio>
                </List.Item>
              )}
            />
          </Radio.Group>
        ) : (
          <Alert type='warning' showIcon message='暂无已保存的配装方案' />
        )}
      </Modal>
    </>
  )
}

export default 配装方案管理
