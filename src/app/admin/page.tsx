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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BookOpen,
  Send,
  Play,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  GraduationCap,
  BarChart3,
  MessageSquare,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Zap,
  AlertTriangle,
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
  channels: Array<{ name: string; id: string; active: boolean }>
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

// ===== MAIN ADMIN PAGE =====
export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')

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

  const handleLogin = () => {
    if (!password.trim()) return
    setIsAuthenticated(true)
    setAuthError('')
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
            <Button className="w-full" onClick={handleLogin}>
              <Settings className="h-4 w-4 mr-2" />
              Login
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
          <TabsList className="grid w-full grid-cols-4 mb-6">
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
          <CardDescription>Scrape free courses from UdemyFreebies and StudyBullet in parallel</CardDescription>
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
            <Button variant="outline" onClick={() => runScraper('studybullet')} disabled={running}>
              StudyBullet
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
  const [stats, setStats] = useState<{ total_courses: number; posted_courses: number; pending_courses: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram')
      const data = await res.json()
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const initSettings: TelegramSettings = {
    bot_token: '',
    channels: [{ name: 'Main Channel', id: '', active: true }],
    auto_post: false,
    message_template: '{title}\n\nInstructor: {instructor}\nRating: {rating}\nStudents: {students_count}\n\n{link}',
  }

  const currentSettings = settings || initSettings

  const saveSettings = async () => {
    setSaving(true)
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          action: 'set',
          key: 'telegram',
          value: JSON.stringify(currentSettings),
        }),
      })
      setTestResult('Settings saved successfully!')
      setTimeout(() => setTestResult(null), 3000)
    } catch {
      setTestResult('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const addChannel = () => {
    const newSettings = { ...currentSettings }
    newSettings.channels = [...newSettings.channels, { name: `Channel ${newSettings.channels.length + 1}`, id: '', active: true }]
    setSettings(newSettings)
  }

  const removeChannel = (idx: number) => {
    const newSettings = { ...currentSettings }
    newSettings.channels = currentSettings.channels.filter((_, i) => i !== idx)
    setSettings(newSettings)
  }

  const updateChannel = (idx: number, field: 'name' | 'id' | 'active', value: string | boolean) => {
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Bot Token</Label>
            <Input
              value={currentSettings.bot_token || ''}
              onChange={(e) => setSettings({ ...currentSettings, bot_token: e.target.value })}
              placeholder="123456:ABCdef..."
              className="font-mono text-xs"
            />
          </div>

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
                <div key={idx} className="flex items-center gap-2 p-2 border rounded-md">
                  <Switch
                    checked={ch.active}
                    onCheckedChange={(checked) => updateChannel(idx, 'active', checked)}
                  />
                  <Input
                    value={ch.name}
                    onChange={(e) => updateChannel(idx, 'name', e.target.value)}
                    placeholder="Channel name"
                    className="flex-1 text-xs"
                  />
                  <Input
                    value={ch.id}
                    onChange={(e) => updateChannel(idx, 'id', e.target.value)}
                    placeholder="@channel_id"
                    className="flex-1 text-xs font-mono"
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

          <Button onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            <span className="ml-2">Save Settings</span>
          </Button>

          {testResult && (
            <div className={`p-3 rounded-md text-xs ${testResult.includes('success') || testResult.includes('Saved') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
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
