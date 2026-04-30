import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

/**
 * App-wide error boundary. Without this, React renders blank when a child
 * throws — making bugs feel like ghosts. With this, the error and its
 * component stack are surfaced inline so we can fix what's actually wrong.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[Hangr] Render error:', error, info)
    this.setState({ error, info })
  }

  reset = () => {
    this.setState({ error: null, info: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] flex items-start justify-center px-4 pt-12 pb-12">
          <div className="max-w-md w-full">
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-300 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">Hangr hit an error.</div>
                  <div className="mt-1 text-sm text-amber-200/90 break-words">
                    {this.state.error.message || String(this.state.error)}
                  </div>
                </div>
              </div>

              {this.state.info?.componentStack && (
                <pre className="mt-3 max-h-64 overflow-auto text-[10px] leading-snug whitespace-pre-wrap text-amber-200/70 bg-ink-900/40 rounded-lg p-3 border border-ink-800">
                  {this.state.info.componentStack}
                </pre>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={this.reset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-900 border border-ink-700 text-sm text-ink-100"
                >
                  <RotateCw size={14} />
                  Try again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 rounded-full text-sm text-ink-300"
                >
                  Reload app
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
