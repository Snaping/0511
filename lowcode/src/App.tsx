import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAppStore } from './stores/appStore'
import MainLayout from './components/layout/MainLayout'

function App() {
  const { darkMode } = useAppStore()

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <MainLayout />
    </ConfigProvider>
  )
}

export default App
