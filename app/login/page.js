'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  useEffect(() => setMounted(true), [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError('Wrong email or password.')
      setLoading(false)
      return
    }
    router.replace('/')
  }

  async function handleDemo() {
    setError('')
    setDemoLoading(true)
    try {
      const res = await fetch('/api/demo', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error()
      const { error } = await supabase.auth.setSession({
        access_token: body.access_token, refresh_token: body.refresh_token,
      })
      if (error) throw error
      router.replace('/')
    } catch {
      setError('The demo is not available right now.')
      setDemoLoading(false)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <Tabs value={mounted ? resolvedTheme : undefined} onValueChange={setTheme}>
          <TabsList>
            <TabsTrigger value="light">Light</TabsTrigger>
            <TabsTrigger value="dark">Dark</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            F
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Flat Portal</h1>
        </div>

        <Card className="gap-0 p-6 sm:p-8">
          <form onSubmit={handleLogin} noValidate className="space-y-5">
            <div>
              <h2 className="text-base font-semibold">Sign in</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter your email and password</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  className="h-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="h-10 w-full" disabled={loading || !email.trim() || !password}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <Button type="button" variant="outline" className="mt-3 h-10 w-full" onClick={handleDemo} disabled={demoLoading || loading}>
            {demoLoading && <Loader2 className="size-4 animate-spin" />}
            {demoLoading ? 'Opening demo…' : 'Try demo'}
          </Button>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Forgot your password? Please contact the office.
        </p>
      </div>
    </main>
  )
}