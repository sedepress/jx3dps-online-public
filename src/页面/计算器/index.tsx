const isLocalBuild = process.env.REACT_APP_BUILD_TYPE === 'local'

import React, { lazy, Suspense, useEffect, useState } from 'react'
import useQuery from '@/hooks/use-query'
import FullLoading from '@/组件/FullLoading'

const Dps = lazy(() => import('./dps'))

const 本地打包心法入口 = lazy(() => import('./本地打包心法入口'))
const 默认心法简写 = 'wsj'

function 主页面() {
  const urlXf = useQuery('xf')
  const [资源获取完成, 设置资源获取完成] = useState(false)

  useEffect(() => {
    if (urlXf !== 默认心法简写) {
      const search = new URLSearchParams(window.location.search)
      search.set('xf', 默认心法简写)
      window.location.href = `${window.location.pathname}?${search.toString()}`
      return
    }

    localStorage.setItem('最后访问心法', 默认心法简写)
    初始化数据()
  }, [urlXf])

  // 初始化数据
  const 初始化数据 = async () => {
    try {
      const 模块 = require('@/数据/数据工具/获取当前数据')
      await 模块?.初始化心法数据()
      设置资源获取完成(true)
    } catch {
      window.location.href = '/'
    }
  }

  return 资源获取完成 ? (
    <Suspense fallback={<FullLoading />}>
      <Dps />
    </Suspense>
  ) : isLocalBuild ? (
    <Suspense fallback={<FullLoading />}>
      <本地打包心法入口 />
    </Suspense>
  ) : (
    <FullLoading />
  )
}

export default 主页面
