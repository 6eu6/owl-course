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
  DialogTrigger,
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
} from 'lucide-react'

// ===== TYPES =====
interface Stats {
  courses: { total: number; published: number; unpublished: number }
  by_source: Array<{ _id: string; count: number }>
  categories: string[]
  telegram: { total_posted: number; total_messages: number }
}

interface TelegramSettings {
  bot_token: string
  channels: Array<{ name: string; id: string; active: boolean }>
  auto_post: boolean
  message_template: string
}

// ===== MAIN ADMIN PAGE =====
export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-amber-600" />
              <h1 className="font-bold">لوحة التحكم</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchStats}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              الإحصائيات
            </TabsTrigger>
            <TabsTrigger value="scraper" className="text-xs sm:text-sm gap-1">
              <Play className="h-3.5 w-3.5" />
              السكرايبر
            </TabsTrigger>
            <TabsTrigger value="telegram" className="text-xs sm:text-sm gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              تليجرام
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm gap-1">
              <Settings className="h-3.5 w-3.5" />
              إعدادات
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
                  <StatCard icon={BookOpen} label="إجمالي الكورسات" value={stats.courses.total} color="bg-blue-500" />
                  <StatCard icon={CheckCircle} label="منشور" value={stats.courses.published} color="bg-green-500" />
                  <StatCard icon={XCircle} label="غير منشور" value={stats.courses.unpublished} color="bg-orange-500" />
                  <StatCard icon={MessageSquare} label="مرسلة لتليجرام" value={stats.telegram.total_posted} color="bg-purple-500" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">حسب المصدر</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stats.by_source.map(s => (
                        <div key={String(s._id)} className="flex justify-between py-1 text-sm">
                          <span className="capitalize">{String(s._id)}</span>
                          <Badge variant="secondary">{s.count}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">التصنيفات ({stats.categories.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-48">
                        <div className="flex flex-wrap gap-1">
                          {stats.categories.map(cat => (
                            <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">تعذر تحميل الإحصائيات</p>
            )}
          </TabsContent>

          {/* Scraper Tab */}
          <TabsContent value="scraper">
            <ScraperPanel onDone={fetchStats} />
          </TabsContent>

          {/* Telegram Tab */}
          <TabsContent value="telegram">
            <TelegramPanel onDone={fetchStats} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsPanel />
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
function ScraperPanel({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<Array<{ timestamp: string; type: string; results: Record<string, { added: number }> }>>([])
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const runScraper = async (source: string) => {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      const data = await res.json()
      setResult({ success: data.success, message: data.message })
      onDone()
    } catch {
      setResult({ success: false, message: 'فشل تشغيل السكرايبر' })
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
            <Play className="h-4 w-4" /> تشغيل السكرايبر
          </CardTitle>
          <CardDescription>اسحب كورسات مجانية جديدة من المصادر</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runScraper('all')} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span className="mr-2">سحب الكل</span>
            </Button>
            <Button variant="outline" onClick={() => runScraper('udemyfreebies')} disabled={running}>
              UdemyFreebies
            </Button>
            <Button variant="outline" onClick={() => runScraper('studybullet')} disabled={running}>
              StudyBullet
            </Button>
          </div>
          {result && (
            <div className={`p-3 rounded-md text-sm ${result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result.message}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">سجل العمليات</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد عمليات سابقة</p>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border p-2 rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{log.type}</Badge>
                      <span>{new Date(log.timestamp).toLocaleString('ar')}</span>
                    </div>
                    <div className="flex gap-2">
                      {(log.results?.udemyfreebies && (
                        <span className="text-muted-foreground">Udemy: +{log.results.udemyfreebies.added || 0}</span>
                      ))}
                      {(log.results?.studybullet && (
                        <span className="text-muted-foreground">StudyBullet: +{log.results.studybullet.added || 0}</span>
                      ))}
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
function TelegramPanel({ onDone }: { onDone: () => void }) {
  const [settings, setSettings] = useState<TelegramSettings | null>(null)
  const [stats, setStats] = useState<{ total_courses: number; posted_courses: number; pending_courses: number } | null>(null)
  const [messages, setMessages] = useState<Array<{ id: string; course_title: string; channels: string[]; sent_at: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [postId, setPostId] = useState<string>('')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram')
      const data = await res.json()
      setSettings(data.settings)
      setStats(data.stats)
      setMessages(data.recent_messages || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...settings }),
      })
      alert('تم حفظ الإعدادات')
    } catch {
      alert('فشل حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (!settings?.bot_token || !settings?.channels?.[0]?.id) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', bot_token: settings.bot_token, channel_id: settings.channels[0].id }),
      })
      const data = await res.json()
      setTestResult(data.message)
    } catch {
      setTestResult('فشل الاتصال')
    } finally {
      setTesting(false)
    }
  }

  const autoPost = async () => {
    setPosting(true)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_post', limit: parseInt(postId) || 5 }),
      })
      const data = await res.json()
      alert(`تم نشر ${data.posted || 0} كورس`)
      onDone()
      fetchData()
    } catch {
      alert('فشل النشر')
    } finally {
      setPosting(false)
    }
  }

  const addChannel = () => {
    if (!settings) return
    setSettings({
      ...settings,
      channels: [...settings.channels, { name: `قناة ${settings.channels.length + 1}`, id: '', active: true }],
    })
  }

  const removeChannel = (idx: number) => {
    if (!settings) return
    setSettings({
      ...settings,
      channels: settings.channels.filter((_, i) => i !== idx),
    })
  }

  const updateChannel = (idx: number, field: 'name' | 'id' | 'active', value: string | boolean) => {
    if (!settings) return
    const channels = [...settings.channels]
    channels[idx] = { ...channels[idx], [field]: value }
    setSettings({ ...settings, channels })
  }

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.total_courses}</div>
              <div className="text-xs text-muted-foreground">إجمالي الكورسات</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.posted_courses}</div>
              <div className="text-xs text-muted-foreground">مرسلة</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.pending_courses}</div>
              <div className="text-xs text-muted-foreground">في الانتظار</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" /> إعدادات البوت
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Bot Token</Label>
            <Input
              value={settings?.bot_token || ''}
              onChange={(e) => setSettings(prev => prev ? { ...prev, bot_token: e.target.value } : prev)}
              placeholder="123456:ABCdef..."
              className="font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={settings?.auto_post || false}
              onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, auto_post: checked } : prev)}
            />
            <Label className="text-xs">نشر تلقائي</Label>
          </div>

          <Separator />

          {/* Channels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">القنوات</Label>
              <Button size="sm" variant="outline" onClick={addChannel}>
                <Plus className="h-3 w-3" />
                <span className="ml-1 text-xs">إضافة قناة</span>
              </Button>
            </div>
            <div className="space-y-2">
              {settings?.channels?.map((ch, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 border rounded-md">
                  <Switch
                    checked={ch.active}
                    onCheckedChange={(checked) => updateChannel(idx, 'active', checked)}
                  />
                  <Input
                    value={ch.name}
                    onChange={(e) => updateChannel(idx, 'name', e.target.value)}
                    placeholder="اسم القناة"
                    className="flex-1 text-xs"
                  />
                  <Input
                    value={ch.id}
                    onChange={(e) => updateChannel(idx, 'id', e.target.value)}
                    placeholder="@channel_id"
                    className="flex-1 text-xs font-mono"
                  />
                  {settings.channels.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeChannel(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Message Template */}
          <div>
            <Label className="text-xs">قالب الرسالة</Label>
            <Textarea
              value={settings?.message_template || ''}
              onChange={(e) => setSettings(prev => prev ? { ...prev, message_template: e.target.value } : prev)}
              rows={4}
              className="font-mono text-xs"
              placeholder="&#123;title&#125;&#10;&#123;link&#125;"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              المتاحات: &#123;title&#125;, &#123;instructor&#125;, &#123;category&#125;, &#123;rating&#125;, &#123;students_count&#125;, &#123;original_price&#125;, &#123;language&#125;, &#123;link&#125;
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              <span className="mr-2">حفظ</span>
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !settings?.bot_token}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="mr-2">اختبار</span>
            </Button>
            <Button variant="outline" onClick={autoPost} disabled={posting}>
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="mr-2">نشر تلقائي</span>
            </Button>
            <Input
              type="number"
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              placeholder="عدد"
              className="w-16 text-center text-xs"
              min="1"
              max="50"
            />
          </div>

          {testResult && (
            <div className={`p-2 rounded-md text-xs ${testResult.includes('نجاح') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {testResult}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Messages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">آخر الرسائل</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد رسائل</p>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex items-center justify-between text-xs border p-2 rounded">
                    <div>
                      <p className="font-medium line-clamp-1">{msg.course_title}</p>
                      <div className="flex gap-1 mt-1">
                        {msg.channels.map((ch, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{ch}</Badge>
                        ))}
                      </div>
                    </div>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(msg.sent_at).toLocaleString('ar')}
                    </span>
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

// ===== SETTINGS PANEL =====
function SettingsPanel() {
  const [siteName, setSiteName] = useState('')
  const [siteDesc, setSiteDesc] = useState('')
  const [perPage, setPerPage] = useState('12')
  const [scraperEnabled, setScraperEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/courses')
        const data = await res.json()
        setSiteName(data.settings?.site_name || 'OWL COURSE')
        setSiteDesc(data.settings?.site_description || '')
        setPerPage(String(data.settings?.courses_per_page || 12))
        setScraperEnabled(data.settings?.scraper_enabled !== false)
      } catch {
        // use defaults
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const saveAll = async () => {
    try {
      const settings = [
        { key: 'site_name', value: siteName },
        { key: 'site_description', value: siteDesc },
        { key: 'courses_per_page', value: perPage },
        { key: 'scraper_enabled', value: String(scraperEnabled) },
      ]
      await Promise.all(
        settings.map(s =>
          fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
          })
        )
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('فشل الحفظ')
    }
  }

  if (loading) return <Skeleton className="h-64" />

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" /> إعدادات الموقع
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">اسم الموقع</Label>
          <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">وصف الموقع</Label>
          <Input value={siteDesc} onChange={(e) => setSiteDesc(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">عدد الكورسات في الصفحة</Label>
          <Input type="number" value={perPage} onChange={(e) => setPerPage(e.target.value)} min="4" max="48" />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={scraperEnabled} onCheckedChange={setScraperEnabled} />
          <Label className="text-xs">تفعيل السكرايبر</Label>
        </div>
        <Button onClick={saveAll}>
          {saved ? <CheckCircle className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
          <span className="mr-2">{saved ? 'تم الحفظ!' : 'حفظ الإعدادات'}</span>
        </Button>
      </CardContent>
    </Card>
  )
}
