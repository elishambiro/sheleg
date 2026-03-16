import { useStore } from '@/store'
import type { CompilationSettings } from '@/types/settings.types'

export function SettingsPanel() {
  const { settingsPanelOpen, toggleSettingsPanel, settings, updateSettings } = useStore()

  const update = <K extends keyof CompilationSettings>(key: K, val: CompilationSettings[K]) =>
    updateSettings({ [key]: val } as Partial<CompilationSettings>)

  if (!settingsPanelOpen) return null

  return (
    <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="font-semibold text-sm text-gray-800">⚙️ הגדרות</span>
        <button onClick={toggleSettingsPanel} className="text-gray-400 hover:text-gray-600 text-lg">
          ✕
        </button>
      </div>

      <div className="flex-1 p-4 space-y-5 text-sm">
        {/* Language */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">שפה ותיוג</h3>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span>שפת הממשק</span>
              <select
                className="text-xs border rounded px-2 py-1"
                value={settings.language}
                onChange={(e) => update('language', e.target.value as 'he' | 'en')}
              >
                <option value="he">עברית</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className="flex items-center justify-between">
              <span>מספור נספחים</span>
              <select
                className="text-xs border rounded px-2 py-1"
                value={settings.numberingStyle}
                onChange={(e) => update('numberingStyle', e.target.value as CompilationSettings['numberingStyle'])}
              >
                <option value="alpha-he">אלפביתי עברי (א, ב...)</option>
                <option value="alpha-en">אלפביתי אנגלי (A, B...)</option>
                <option value="alpha-ar">אלפביתי ערבי</option>
                <option value="numeric">מספרי (1, 2...) (ברירת מחדל)</option>
                <option value="manual">ידני</option>
              </select>
            </label>

            <label className="flex items-center justify-between">
              <span>מיקום הסימון</span>
              <select
                className="text-xs border rounded px-2 py-1"
                value={settings.annexLabelPosition}
                onChange={(e) => update('annexLabelPosition', e.target.value as CompilationSettings['annexLabelPosition'])}
              >
                <option value="top-right">ימין עליון</option>
                <option value="top-left">שמאל עליון (ברירת מחדל)</option>
                <option value="bottom-right">ימין תחתון</option>
                <option value="bottom-left">שמאל תחתון</option>
              </select>
            </label>
          </div>
        </section>

        {/* Document structure */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">מבנה המסמך</h3>
          <div className="space-y-2">
            <Toggle
              label="עמוד שער"
              checked={settings.includeCoverPage}
              onChange={(v) => update('includeCoverPage', v)}
            />
            <Toggle
              label="תוכן עניינים"
              checked={settings.includeToc}
              onChange={(v) => update('includeToc', v)}
            />
            <Toggle
              label="סימון אוטומטי בנספחים"
              checked={settings.autoMarkFirstPage}
              onChange={(v) => update('autoMarkFirstPage', v)}
            />
            <Toggle
              label="מספרי עמודים"
              checked={settings.design.showPageNumbers}
              onChange={(v) => updateSettings({ design: { ...settings.design, showPageNumbers: v } })}
            />
          </div>
        </section>

        {/* Volume splitting */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">חלוקה לכרכים</h3>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span>אסטרטגיה</span>
              <select
                className="text-xs border rounded px-2 py-1"
                value={settings.volumeStrategy}
                onChange={(e) => update('volumeStrategy', e.target.value as CompilationSettings['volumeStrategy'])}
              >
                <option value="none">ללא פיצול</option>
                <option value="by-size-mb">לפי גודל (MB)</option>
                <option value="by-page-count">לפי עמודים</option>
              </select>
            </label>

            {settings.volumeStrategy === 'by-size-mb' && (
              <label className="flex items-center justify-between">
                <span>מקסימום MB</span>
                <input
                  type="number"
                  className="w-20 text-xs border rounded px-2 py-1"
                  value={settings.volumeMaxSizeMb}
                  min={1}
                  onChange={(e) => update('volumeMaxSizeMb', Number(e.target.value))}
                />
              </label>
            )}

            {settings.volumeStrategy === 'by-page-count' && (
              <label className="flex items-center justify-between">
                <span>מקסימום עמודים</span>
                <input
                  type="number"
                  className="w-20 text-xs border rounded px-2 py-1"
                  value={settings.volumeMaxPages}
                  min={1}
                  onChange={(e) => update('volumeMaxPages', Number(e.target.value))}
                />
              </label>
            )}
          </div>
        </section>

        {/* Design */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">עיצוב</h3>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span>צבע ראשי</span>
              <input
                type="color"
                value={settings.design.primaryColor}
                onChange={(e) =>
                  updateSettings({ design: { ...settings.design, primaryColor: e.target.value } })
                }
                className="w-8 h-8 border rounded cursor-pointer"
              />
            </label>

            {settings.includeCoverPage && (
              <>
                <label className="block">
                  <span className="block mb-1 text-xs text-gray-500">כותרת עמוד שער</span>
                  <input
                    type="text"
                    value={settings.design.coverTitle}
                    onChange={(e) =>
                      updateSettings({ design: { ...settings.design, coverTitle: e.target.value } })
                    }
                    placeholder="ברירת מחדל: שם הפרויקט"
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                </label>

                <label className="block">
                  <span className="block mb-1 text-xs text-gray-500">תת-כותרת עמוד שער</span>
                  <input
                    type="text"
                    value={settings.design.coverSubtitle}
                    onChange={(e) =>
                      updateSettings({ design: { ...settings.design, coverSubtitle: e.target.value } })
                    }
                    placeholder="טקסט משני אופציונלי"
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                </label>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-brand-700' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}
