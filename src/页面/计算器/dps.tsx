import React from 'react'
import { Provider } from 'react-redux'
import { App as AntdApp, ConfigProvider } from 'antd'
import dayjs from 'dayjs'
import antdZhCN from 'antd/locale/zh_CN'
import { HappyProvider } from '@ant-design/happy-work-theme'

import store from '@/store/index'
import ErrorBoundary from '@/组件/ErrorBoundary'
import Layout from '@/组件/Layout'

import 基础设置 from '@/功能模块/基础设置'
import 系统工具 from '@/功能模块/系统工具'
import 心法切换 from '@/功能模块/心法切换'
import 系统说明 from '@/功能模块/系统说明'
import 计算结果 from '@/功能模块/计算结果'
import 新手引导 from '@/功能模块/新手引导'

import 获取当前数据 from '@/数据/数据工具/获取当前数据'

import '@/工具函数/axios'
import 'dayjs/locale/zh-cn'

import './index.css'

dayjs.locale('zh-cn')

const { 系统配置 } = 获取当前数据()
const 主题色 = 系统配置?.主题色 || '#dca53e'

ConfigProvider.config({ theme: { primaryColor: 主题色 } })

function 主页面() {
  return (
    <Provider store={store}>
      <HappyProvider>
        <ConfigProvider
          locale={antdZhCN}
          theme={{
            token: {
              colorPrimary: 主题色,
            },
          }}
        >
          <ErrorBoundary>
            <AntdApp>
              <Layout>
                <系统说明 />
                <基础设置 />
                <计算结果 />
                <系统工具 />
                <心法切换 />
                <新手引导 />
              </Layout>
            </AntdApp>
          </ErrorBoundary>
        </ConfigProvider>
      </HappyProvider>
    </Provider>
  )
}

export default 主页面
