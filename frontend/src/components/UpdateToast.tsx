import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdateToast() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 safe-bottom">
      <div className="mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl border border-graphite-700 bg-graphite-800 px-4 py-3 shadow-xl">
        <p className="text-sm text-graphite-100">A new version is available.</p>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white active:bg-accent-600"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
