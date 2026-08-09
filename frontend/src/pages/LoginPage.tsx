import { useSearchParams } from 'react-router-dom'

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: 'This app is invite-only right now. Sign-ups are closed.',
  state: 'Sign-in expired. Please try again.',
  oauth: 'GitHub could not complete the sign-in. Please try again.',
}

export function LoginPage() {
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/'
  const error = params.get('error')
  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.oauth : null

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 safe-top safe-bottom">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500">
          <DumbbellIcon className="h-9 w-9 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-graphite-50">Workouts</h1>
          <p className="mt-1 text-sm text-graphite-400">
            A fast, simple way to log your training.
          </p>
        </div>
      </div>

      {errorMessage && (
        <p className="max-w-xs rounded-xl border border-graphite-700 bg-graphite-800 px-4 py-3 text-center text-sm text-graphite-200">
          {errorMessage}
        </p>
      )}

      <a
        href={`/api/auth/login?provider=github&next=${encodeURIComponent(next)}`}
        className="flex items-center gap-3 rounded-xl bg-graphite-800 px-6 py-3 font-semibold text-graphite-50 ring-1 ring-graphite-700 transition active:bg-graphite-700"
      >
        <GithubIcon className="h-5 w-5" />
        Continue with GitHub
      </a>
    </div>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-1.93c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.36.78 1.06.78 2.13v3.16c0 .31.2.67.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43Z" />
    </svg>
  )
}
