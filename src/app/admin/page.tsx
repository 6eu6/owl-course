'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BookOpen,
  Play,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  GraduationCap,
  BarChart3,
  MessageSquare,
  Bot,
  CheckCircle,
  Loader2,
  Clock,
  Zap,
  AlertTriangle,
  DollarSign,
  Wifi,
} from 'lucide-react'

// ===== TYPES =====
interface Stats {
  success: boolean
  courses: { total: number; published: number; unpublished: number; newToday: number }
  categories: { count: number }
  sources: Array<{ source: string; count: number; label: string }>
  telegram: { total_posted: number; pending: number }
  lastScrape: string | null
}

interface TelegramSettings {
  bot_token: string
  channels: Array<{ name: string; id: string; active: boolean; language: string }>
  auto_post: boolean
  message_template: string
}

interface ScraperLog {
  id: string
  source: string
  status: string
  newCount: number
  dupCount: number
  errCount: number
  message: string
  duration: number
  timestamp: string
}

interface AdsSettings {
  google_adsense_client_id: string
  google_adsense_slot_id: string
  header_ad_enabled: string
  sidebar_ad_enabled: string
  between_courses_ad_enabled: string
  custom_ad_script_head: string
  custom_ad_script_body: string
  ad_banner_url: string
  ad_banner_link: string
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'tr', label: 'Turkish' },
  { value: 'hi', label: 'Hindi' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'de', label: 'German' },
  { value: 'ru', label: 'Russian' },
]

// ===== MAIN ADMIN PAGE =====
export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
    } catch {
      // stats remain null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleLogin = async () => {
    if (!password.trim()) return
    setLoginLoading(true)
    setAuthError('')
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'verify' }),
      })
      const data = await res.json()
      if (data.success) {
        setIsAuthenticated(true)
        setAuthError('')
      } else {
        setAuthError(data.error || 'Invalid password')
      }
    } catch {
      setAuthError('Connection error')
    } finally {
      setLoginLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              <GraduationCap className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-lg">Admin Login</CardTitle>
            <CardDescription>Enter the admin password to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Admin Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Enter password..."
              />
            </div>
            {authError && (
              <p className="text-xs text-red-500">{authError}</p>
            )}
            <Button className="w-full" onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
              {loginLoading ? 'Verifying...' : 'Login'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-amber-600" />
              <h1 className="font-bold">OWL COURSE Admin</h1>
              <Badge variant="outline" className="text-[10px]">Dashboard</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fetchStats}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsAuthenticated(false)} className="text-red-500 text-xs">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="scraper" className="text-xs sm:text-sm gap-1">
              <Zap className="h-3.5 w-3.5" />
              Scraper
            </TabsTrigger>
            <TabsTrigger value="telegram" className="text-xs sm:text-sm gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              Telegram
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm gap-1">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="ads" className="text-xs sm:text-sm gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Ads
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></Card>
                ))}
              </div>
            ) : stats ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard icon={BookOpen} label="Total Courses" value={stats.courses.total} color="bg-amber-500" />
                  <StatCard icon={CheckCircle} label="Published" value={stats.courses.published} color="bg-green-500" />
                  <StatCard icon={Zap} label="New Today" value={stats.courses.newToday} color="bg-blue-500" />
                  <StatCard icon={MessageSquare} label="Telegram Posted" value={stats.telegram.total_posted} color="bg-purple-500" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">By Source</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {stats.sources.map(s => (
                          <div key={s.source} className="flex justify-between py-1 text-sm">
                            <span className="capitalize">{s.label}</span>
                            <Badge variant="secondary">{s.count}</Badge>
                          </div>
                        ))}
                        {stats.sources.length === 0 && (
                          <p className="text-xs text-muted-foreground">No courses yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Categories ({stats.categories.count})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        <div className="flex justify-between py-1">
                          <span>Total Categories</span>
                          <Badge variant="secondary">{stats.categories.count}</Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Telegram Pending</span>
                          <Badge variant="secondary">{stats.telegram.pending}</Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Unpublished</span>
                          <Badge variant="secondary">{stats.courses.unpublished}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Last Scrape</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stats.lastScrape ? (
                        <div className="text-sm space-y-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{new Date(stats.lastScrape).toLocaleString()}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No scrapes yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Could not load stats</p>
            )}
          </TabsContent>

          {/* Scraper Tab */}
          <TabsContent value="scraper">
            <ScraperPanel password={password} onDone={fetchStats} />
          </TabsContent>

          {/* Telegram Tab */}
          <TabsContent value="telegram">
            <TelegramPanel password={password} onDone={fetchStats} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsPanel password={password} />
          </TabsContent>

          {/* Ads Tab */}
          <TabsContent value="ads">
            <AdsPanel password={password} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

// ===== STAT CARD =====
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ===== SCRAPER PANEL =====
function ScraperPanel({ password, onDone }: { password: string; onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const [purging, setPurging] = useState(false)
  const [logs, setLogs] = useState<ScraperLog[]>([])
  const [result, setResult] = useState<{ success: boolean; message: string; totalNew: number; totalDup: number; totalErr: number; totalDuration: number } | null>(null)

  const runScraper = async (source: string) => {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, source }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: data.message, totalNew: data.totalNew, totalDup: data.totalDup, totalErr: data.totalErr, totalDuration: data.totalDuration })
      } else {
        setResult({ success: false, message: data.error || 'Failed', totalNew: 0, totalDup: 0, totalErr: 0, totalDuration: 0 })
      }
      fetchLogs()
      onDone()
    } catch {
      setResult({ success: false, message: 'Failed to run scraper', totalNew: 0, totalDup: 0, totalErr: 0, totalDuration: 0 })
    } finally {
      setRunning(false)
    }
  }

  const purgeCourses = async () => {
    if (!confirm('Are you sure you want to DELETE ALL courses? This cannot be undone!')) return
    setPurging(true)
    setResult(null)
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'purge' }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: data.message, totalNew: 0, totalDup: 0, totalErr: 0, totalDuration: 0 })
        onDone()
      } else {
        setResult({ success: false, message: data.error || 'Failed to purge', totalNew: 0, totalDup: 0, totalErr: 0, totalDuration: 0 })
      }
    } catch {
      setResult({ success: false, message: 'Failed to purge courses', totalNew: 0, totalDup: 0, totalErr: 0, totalDuration: 0 })
    } finally {
      setPurging(false)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/scraper')
      const data = await res.json()
      setLogs(data.logs || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => { fetchLogs() }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" /> Run Scraper
          </CardTitle>
          <CardDescription>Scrape free courses from UdemyFreebies with 100% free coupon codes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runScraper('all')} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span className="ml-2">Scrape All Sources</span>
            </Button>
            <Button variant="outline" onClick={() => runScraper('udemyfreebies')} disabled={running}>
              UdemyFreebies
            </Button>
            <Button variant="destructive" onClick={purgeCourses} disabled={purging || running}>
              {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-2">Purge All Courses</span>
            </Button>
          </div>
          {result && (
            <div className={`p-4 rounded-md text-sm space-y-1 ${result.success ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'}`}>
              <div className="font-medium">{result.message}</div>
              {result.success && (
                <div className="flex gap-3 text-xs mt-1">
                  <span className="text-green-600">+{result.totalNew} new</span>
                  <span className="text-muted-foreground">{result.totalDup} duplicates</span>
                  {result.totalErr > 0 && <span className="text-red-500">{result.totalErr} errors</span>}
                  <span className="text-muted-foreground">{(result.totalDuration / 1000).toFixed(1)}s</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Scraper Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No scraper runs yet</p>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs border p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={log.status === 'success' ? 'default' : log.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {log.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {log.source}
                      </Badge>
                      <span className="text-muted-foreground truncate">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {log.newCount > 0 && (
                        <span className="text-green-600 font-medium">+{log.newCount}</span>
                      )}
                      {log.dupCount > 0 && (
                        <span className="text-muted-foreground">{log.dupCount} dup</span>
                      )}
                      {log.errCount > 0 && (
                        <span className="text-red-500">{log.errCount} err</span>
                      )}
                      <span className="text-muted-foreground">{(log.duration / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===== TELEGRAM PANEL =====
function TelegramPanel({ password, onDone }: { password: string; onDone: () => void }) {
  const [settings, setSettings] = useState<TelegramSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram')
      const data = await res.json()
      if (data.success && data.settings) {
        // Ensure channels have language field
        const channels = (data.settings.channels || []).map((ch: { name?: string; id?: string; active?: boolean; language?: string }) => ({
          name: ch.name || 'Channel',
          id: ch.id || '',
          active: ch.active !== false,
          language: ch.language || 'en',
        }))
        setSettings({
          bot_token: data.settings.bot_token || '',
          channels: channels.length > 0 ? channels : [{ name: 'Main Channel', id: '', active: true, language: 'en' }],
          auto_post: data.settings.auto_post || false,
          message_template: data.settings.message_template || '{title}\n\nInstructor: {instructor}\nRating: {rating}\nStudents: {students_count}\n\n{link}',
        })
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const initSettings: TelegramSettings = {
    bot_token: '',
    channels: [{ name: 'Main Channel', id: '', active: true, language: 'en' }],
    auto_post: false,
    message_template: '{title}\n\nInstructor: {instructor}\nRating: {rating}\nStudents: {students_count}\n\n{link}',
  }

  const currentSettings = settings || initSettings

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          action: 'save_settings',
          channels: currentSettings.channels,
          auto_post: currentSettings.auto_post,
          message_template: currentSettings.message_template,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTestResult('Settings saved successfully!')
      } else {
        setTestResult(data.error || 'Failed to save settings')
      }
      setTimeout(() => setTestResult(null), 3000)
    } catch {
      setTestResult('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const activeChannel = currentSettings.channels.find(ch => ch.active)
      const channelId = activeChannel?.id || ''
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          action: 'test',
          channel_id: channelId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTestResult('Test message sent successfully!')
      } else {
        setTestResult(data.error || 'Test failed. Check bot token and channel ID.')
      }
    } catch {
      setTestResult('Failed to test connection')
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  const addChannel = () => {
    const newSettings = { ...currentSettings }
    newSettings.channels = [...newSettings.channels, { name: `Channel ${newSettings.channels.length + 1}`, id: '', active: true, language: 'en' }]
    setSettings(newSettings)
  }

  const removeChannel = (idx: number) => {
    const newSettings = { ...currentSettings }
    newSettings.channels = currentSettings.channels.filter((_, i) => i !== idx)
    setSettings(newSettings)
  }

  const updateChannel = (idx: number, field: 'name' | 'id' | 'active' | 'language', value: string | boolean) => {
    const newSettings = { ...currentSettings }
    const channels = [...newSettings.channels]
    channels[idx] = { ...channels[idx], [field]: value }
    newSettings.channels = channels
    setSettings(newSettings)
  }

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium">Telegram Integration</p>
            <p className="text-xs text-muted-foreground">Configure your Telegram bot token and channels to auto-post courses.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" /> Bot Configuration
          </CardTitle>
          <CardDescription>Bot token is configured via TELEGRAM_BOT_TOKEN environment variable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="flex items-center gap-2">
            <Switch
              checked={currentSettings.auto_post || false}
              onCheckedChange={(checked) => setSettings({ ...currentSettings, auto_post: checked })}
            />
            <Label className="text-xs">Auto-post new courses</Label>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Channels</Label>
              <Button size="sm" variant="outline" onClick={addChannel}>
                <Plus className="h-3 w-3" />
                <span className="ml-1 text-xs">Add Channel</span>
              </Button>
            </div>
            <div className="space-y-2">
              {currentSettings.channels?.map((ch, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 p-2 border rounded-md">
                  <Switch
                    checked={ch.active}
                    onCheckedChange={(checked) => updateChannel(idx, 'active', checked)}
                  />
                  <Input
                    value={ch.name}
                    onChange={(e) => updateChannel(idx, 'name', e.target.value)}
                    placeholder="Channel name"
                    className="flex-1 min-w-[120px] text-xs"
                  />
                  <Select
                    value={ch.language || 'en'}
                    onValueChange={(val) => updateChannel(idx, 'language', val)}
                  >
                    <SelectTrigger className="w-[130px] text-xs h-9">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value} className="text-xs">
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={ch.id}
                    onChange={(e) => updateChannel(idx, 'id', e.target.value)}
                    placeholder="@channel_id"
                    className="flex-1 min-w-[120px] text-xs font-mono"
                  />
                  {currentSettings.channels.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeChannel(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs">Message Template</Label>
            <Textarea
              value={currentSettings.message_template || ''}
              onChange={(e) => setSettings({ ...currentSettings, message_template: e.target.value })}
              rows={4}
              className="font-mono text-xs"
              placeholder="&#123;title&#125;&#10;&#123;link&#125;"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Available: &#123;title&#125;, &#123;instructor&#125;, &#123;category&#125;, &#123;rating&#125;, &#123;students_count&#125;, &#123;original_price&#125;, &#123;language&#125;, &#123;link&#125;
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              <span className="ml-2">Save Settings</span>
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !currentSettings.bot_token}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              <span className="ml-2">Test Connection</span>
            </Button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-md text-xs ${testResult.includes('success') || testResult.includes('successfully') || testResult.includes('Saved') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {testResult}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===== SETTINGS PANEL =====
function SettingsPanel({ password }: { password: string }) {
  const [siteName, setSiteName] = useState('')
  const [siteDesc, setSiteDesc] = useState('')
  const [perPage, setPerPage] = useState('12')
  const [scraperEnabled, setScraperEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin')
        const data = await res.json()
        if (data.success) {
          setSiteName(data.settings?.site_name || 'OWL COURSE')
          setSiteDesc(data.settings?.site_description || '')
          setPerPage(data.settings?.courses_per_page || '12')
          setScraperEnabled(data.settings?.scraper_enabled !== 'false')
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const saveAll = async () => {
    try {
      const settings = [
        { key: 'site_name', value: siteName },
        { key: 'site_description', value: siteDesc },
        { key: 'courses_per_page', value: perPage },
        { key: 'scraper_enabled', value: String(scraperEnabled) },
      ]

      // Update admin password if provided
      if (newAdminPassword.trim()) {
        // First verify current password
        const verifyRes = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, action: 'set', key: 'admin_password', value: newAdminPassword }),
        })
        const verifyData = await verifyRes.json()
        if (!verifyData.success) {
          alert('Failed to update admin password')
          return
        }
      }

      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'set_many', settings }),
      })

      setSaved(true)
      setNewAdminPassword('')
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Failed to save settings')
    }
  }

  if (loading) return <Skeleton className="h-64" />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" /> Site Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Site Name</Label>
              <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Site Description</Label>
              <Input value={siteDesc} onChange={(e) => setSiteDesc(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Courses Per Page</Label>
              <Input type="number" value={perPage} onChange={(e) => setPerPage(e.target.value)} min="4" max="48" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={scraperEnabled} onCheckedChange={setScraperEnabled} />
              <Label className="text-xs">Enable Scraper</Label>
            </div>
          </div>
          <Button onClick={saveAll}>
            {saved ? <CheckCircle className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            <span className="ml-2">{saved ? 'Saved!' : 'Save Settings'}</span>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Change Admin Password</Label>
            <Input
              type="password"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              placeholder="New admin password"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Leave empty to keep current password. Current: {password.slice(0, 2)}{'*'.repeat(Math.max(0, password.length - 2))}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== ADS PANEL =====
function AdsPanel({ password }: { password: string }) {
  const [settings, setSettings] = useState<AdsSettings>({
    google_adsense_client_id: '',
    google_adsense_slot_id: '',
    header_ad_enabled: 'false',
    sidebar_ad_enabled: 'false',
    between_courses_ad_enabled: 'false',
    custom_ad_script_head: '',
    custom_ad_script_body: '',
    ad_banner_url: '',
    ad_banner_link: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchAdsSettings = async () => {
      try {
        const res = await fetch('/api/ads')
        const data = await res.json()
        if (data.success && data.settings) {
          setSettings({
            google_adsense_client_id: data.settings.google_adsense_client_id || '',
            google_adsense_slot_id: data.settings.google_adsense_slot_id || '',
            header_ad_enabled: data.settings.header_ad_enabled === true ? 'true' : 'false',
            sidebar_ad_enabled: data.settings.sidebar_ad_enabled === true ? 'true' : 'false',
            between_courses_ad_enabled: data.settings.between_courses_ad_enabled === true ? 'true' : 'false',
            custom_ad_script_head: data.settings.custom_ad_script_head || '',
            custom_ad_script_body: data.settings.custom_ad_script_body || '',
            ad_banner_url: data.settings.ad_banner_url || '',
            ad_banner_link: data.settings.ad_banner_link || '',
          })
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false)
      }
    }
    fetchAdsSettings()
  }, [])

  const saveAds = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...settings,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        alert(data.error || 'Failed to save ad settings')
      }
    } catch {
      alert('Failed to save ad settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-64" />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" /> Google AdSense
          </CardTitle>
          <CardDescription>Configure Google AdSense integration for monetization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">AdSense Client ID</Label>
              <Input
                value={settings.google_adsense_client_id}
                onChange={(e) => setSettings({ ...settings, google_adsense_client_id: e.target.value })}
                placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Your Google AdSense publisher ID</p>
            </div>
            <div>
              <Label className="text-xs">AdSense Slot ID</Label>
              <Input
                value={settings.google_adsense_slot_id}
                onChange={(e) => setSettings({ ...settings, google_adsense_slot_id: e.target.value })}
                placeholder="1234567890"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Ad unit slot ID for display ads</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" /> Ad Placements
          </CardTitle>
          <CardDescription>Toggle ad placements across the site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-2 border rounded-md">
            <div>
              <Label className="text-xs font-medium">Header Ad</Label>
              <p className="text-[10px] text-muted-foreground">Show banner ad in the header area</p>
            </div>
            <Switch
              checked={settings.header_ad_enabled === 'true'}
              onCheckedChange={(checked) => setSettings({ ...settings, header_ad_enabled: checked ? 'true' : 'false' })}
            />
          </div>
          <div className="flex items-center justify-between p-2 border rounded-md">
            <div>
              <Label className="text-xs font-medium">Sidebar Ad</Label>
              <p className="text-[10px] text-muted-foreground">Show ad in the sidebar section</p>
            </div>
            <Switch
              checked={settings.sidebar_ad_enabled === 'true'}
              onCheckedChange={(checked) => setSettings({ ...settings, sidebar_ad_enabled: checked ? 'true' : 'false' })}
            />
          </div>
          <div className="flex items-center justify-between p-2 border rounded-md">
            <div>
              <Label className="text-xs font-medium">Between-Courses Ad</Label>
              <p className="text-[10px] text-muted-foreground">Insert ad between course listings</p>
            </div>
            <Switch
              checked={settings.between_courses_ad_enabled === 'true'}
              onCheckedChange={(checked) => setSettings({ ...settings, between_courses_ad_enabled: checked ? 'true' : 'false' })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" /> Custom Ad Scripts
          </CardTitle>
          <CardDescription>Add custom JavaScript for third-party ad networks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Custom Ad Script (Head)</Label>
            <Textarea
              value={settings.custom_ad_script_head}
              onChange={(e) => setSettings({ ...settings, custom_ad_script_head: e.target.value })}
              rows={4}
              className="font-mono text-xs"
              placeholder="<!-- Paste ad script for &lt;head&gt; here -->"
            />
            <p className="text-[10px] text-muted-foreground mt-1">This script will be injected into the &lt;head&gt; section</p>
          </div>
          <div>
            <Label className="text-xs">Custom Ad Script (Body)</Label>
            <Textarea
              value={settings.custom_ad_script_body}
              onChange={(e) => setSettings({ ...settings, custom_ad_script_body: e.target.value })}
              rows={4}
              className="font-mono text-xs"
              placeholder="<!-- Paste ad script for &lt;body&gt; here -->"
            />
            <p className="text-[10px] text-muted-foreground mt-1">This script will be injected at the end of the &lt;body&gt; section</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" /> Custom Banner
          </CardTitle>
          <CardDescription>Display a custom banner ad image with a clickable link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Custom Banner Image URL</Label>
            <Input
              value={settings.ad_banner_url}
              onChange={(e) => setSettings({ ...settings, ad_banner_url: e.target.value })}
              placeholder="https://example.com/banner.jpg"
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">URL of the banner image to display</p>
          </div>
          <div>
            <Label className="text-xs">Custom Banner Link URL</Label>
            <Input
              value={settings.ad_banner_link}
              onChange={(e) => setSettings({ ...settings, ad_banner_link: e.target.value })}
              placeholder="https://example.com/offer"
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">URL users will be redirected to when clicking the banner</p>
          </div>
          {settings.ad_banner_url && (
            <div className="border rounded-md p-2 bg-muted">
              <p className="text-[10px] text-muted-foreground mb-1">Banner Preview:</p>
              <div className="relative aspect-[728/90] max-w-md bg-background rounded overflow-hidden border">
                <img
                  src={settings.ad_banner_url}
                  alt="Custom banner preview"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={saveAds} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
          <span className="ml-2">{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Ad Settings'}</span>
        </Button>
        {saved && (
          <span className="text-xs text-green-600">Ad settings updated successfully</span>
        )}
      </div>
    </div>
  )
}
