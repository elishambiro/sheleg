import { useState } from 'react'
import { useStore } from '@/store'
import { compilePdf } from '@/services/compiler'
import { ProgressBar } from '@/components/ui/ProgressBar'

export function TopBar() {
  const {
    toggleSidebar,
    sidebarOpen,
    toggleSettingsPanel,
    settingsPanelOpen,
    mainDocuments,
    annexes,
    documentFiles,
    settings,
    projectName,
    isCompiling,
    compilationProgress,
    setCompiling,
    setCompilationProgress,
  } = useStore()

  const [compileLabel, setCompileLabel] = useState('')

  const handleCompile = async () => {
    if (mainDocuments.length === 0 && annexes.length === 0) {
      alert('אין מסמכים להידור. הוסף מסמכים קודם.')
      return
    }

    setCompiling(true, 0)

    try {
      const volumes = await compilePdf(
        { documentFiles, mainDocuments, annexes, settings, projectName },
        (step, percent) => {
          setCompileLabel(step)
          setCompilationProgress(percent)
        }
      )

      // Download
      for (let i = 0; i < volumes.length; i++) {
        const blob = new Blob([volumes[i] as unknown as BlobPart], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = volumes.length > 1
          ? `${projectName} - כרך ${i + 1}.pdf`
          : `${projectName}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        await new Promise((r) => setTimeout(r, 200))
      }
    } catch (e: any) {
      alert(`שגיאה בהידור: ${e.message}`)
    } finally {
      setCompiling(false, 0)
      setCompileLabel('')
    }
  }

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center gap-3 px-4 flex-shrink-0 z-10">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        title={sidebarOpen ? 'הסתר סרגל צד' : 'הצג סרגל צד'}
      >
        ☰
      </button>

      {/* Project name breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <span className="text-gray-300">❄️</span>
        <span className="font-medium text-gray-700">{projectName}</span>
      </div>

      <div className="flex-1" />

      {/* Compile progress */}
      {isCompiling && (
        <div className="w-48">
          <ProgressBar value={compilationProgress} label={compileLabel} />
        </div>
      )}

      {/* Settings toggle */}
      <button
        onClick={toggleSettingsPanel}
        className={`p-1.5 rounded transition-colors text-lg ${
          settingsPanelOpen ? 'bg-brand-100 text-brand-700' : 'hover:bg-gray-100 text-gray-500'
        }`}
        title="הגדרות"
      >
        🎨
      </button>

      {/* Compile button */}
      <button
        onClick={handleCompile}
        disabled={isCompiling}
        className="bg-brand-700 hover:bg-brand-800 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {isCompiling ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          '⚡'
        )}
        {isCompiling ? 'מהדר...' : 'צור מסמך PDF'}
      </button>
    </header>
  )
}
