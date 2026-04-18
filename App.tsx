import { useState, useMemo, CSSProperties, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  CheckCircle2, 
  Circle, 
  History, 
  LayoutDashboard, 
  ListTodo, 
  Plus, 
  Settings, 
  BarChart3,
  Dumbbell,
  Trash2,
  ChevronRight,
  ChevronLeft,
  X,
  Target,
  Clock,
  ArrowUpRight,
  Menu,
  Activity,
  LogOut,
  Sun,
  Moon,
  Palette,
  ChevronLast,
  ChevronFirst,
  Download,
  Upload,
  RotateCcw,
  Info,
  Droplet,
  Zap,
  Timer,
  Coffee,
  Brain,
  Scale,
  Ruler,
  Calculator
} from 'lucide-react';
import { 
  format, 
  addDays, 
  subDays, 
  startOfWeek, 
  isSameDay, 
  parseISO, 
  getDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths
} from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLocalStorage } from './hooks/useLocalStorage';
import { 
  ExerciseTemplate, 
  ExerciseLog, 
  DayOfWeek, 
  DAYS_OF_WEEK, 
  MetricValue,
  ExerciseMetric,
  AppSettings,
  DailyHealth
} from './types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';

/** Utility for class names */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- UI Components ---
function ProgressRing({ size = 60, stroke = 4, progress = 0, color = "#60A5FA" }: { size?: number, stroke?: number, progress?: number, color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90 transition-all duration-500">
      <circle
        stroke="currentColor"
        strokeWidth={stroke}
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        className="text-border"
      />
      <motion.circle
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
        strokeLinecap="round"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  );
}

// --- Icons / Assets ---
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Today', icon: LayoutDashboard },
  { id: 'templates', label: 'Exercises', icon: Dumbbell },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'history', label: 'History', icon: History },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

const formatDuration = (decimalHours: number) => {
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return '0h';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [statsSelectedTemplate, setStatsSelectedTemplate] = useState<string | 'all'>('all');
  const [templates, setTemplates] = useLocalStorage<ExerciseTemplate[]>('ft_templates', []);
  const [logs, setLogs] = useLocalStorage<ExerciseLog[]>('ft_logs', []);
  const [dailyHealth, setDailyHealth] = useLocalStorage<DailyHealth[]>('ft_health', []);
  const [settings, setSettings] = useLocalStorage<AppSettings>('ft_settings', {
    showTooltips: true,
    waterGoal: 8,
    sleepGoal: 8,
    weight: 70,
    height: 170,
    age: 25,
    gender: 'male'
  });

  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [creationBatch, setCreationBatch] = useState<Array<{ 
    tempId: string; 
    name: string; 
    metrics: ExerciseMetric[];
  }>>([{ tempId: Math.random().toString(36), name: '', metrics: [] }]);
  const [batchScheduledDays, setBatchScheduledDays] = useState<DayOfWeek[]>([]);
  
  const [showLogModal, setShowLogModal] = useState<{ template: ExerciseTemplate; date: Date } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(new Date());
  const dayDetailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCalendarDate && dayDetailsRef.current) {
      dayDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedCalendarDate]);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentDayOfWeekIndex = (getDay(today) + 6) % 7;
  const currentDayName = DAYS_OF_WEEK[currentDayOfWeekIndex];

  const currentHealth = useMemo(() => {
    return dailyHealth.find(h => h.date === todayStr) || {
      date: todayStr,
      water: 0,
      sleep: 0
    };
  }, [dailyHealth, todayStr]);

  // Gamification & XP Logic
  const userStats = useMemo(() => {
    let xp = 0;
    
    // 1. Exercise XP (10 points per logged exercise/template)
    xp += logs.length * 10;
    
    // 2. Daily Completion Bonus (25 points if all scheduled items for a day are logged)
    const uniqueDates = [...new Set(logs.map(l => l.date))] as string[];
    uniqueDates.forEach(date => {
      const d = parseISO(date);
      const dayName = DAYS_OF_WEEK[(getDay(d) + 6) % 7];
      const scheduled = templates.filter(t => t.scheduledDays.includes(dayName));
      
      if (scheduled.length > 0) {
        const dayLogs = logs.filter(l => l.date === date);
        const completedIds = new Set(dayLogs.map(l => l.templateId));
        if (scheduled.every(s => completedIds.has(s.id))) {
          xp += 25;
        }
      }
    });
    
    // 3. Consistency Bonus (50 points for every 7 days of activity)
    // We calculate how many full weeks of activity the user has achieved
    const logDates = ([...new Set(logs.map(l => l.date))].sort()) as string[];
    let totalConsistentWeeks = 0;
    let currentInRow = 0;
    let prevD: Date | null = null;

    logDates.forEach(dStr => {
      const d = parseISO(dStr);
      if (prevD && isSameDay(d, addDays(prevD, 1))) {
        currentInRow++;
      } else {
        currentInRow = 1;
      }
      
      if (currentInRow >= 7 && currentInRow % 7 === 0) {
        totalConsistentWeeks++;
      }
      prevD = d;
    });

    xp += totalConsistentWeeks * 50;

    const level = Math.floor(xp / 100) + 1;
    const currentLevelXp = xp % 100;
    
    return { xp, level, currentLevelXp, totalConsistentWeeks };
  }, [logs, templates]);

  const updateHealth = (updates: Partial<DailyHealth>, date: string = todayStr) => {
    setDailyHealth(prev => {
      const existing = prev.find(h => h.date === date);
      if (existing) {
        return prev.map(h => h.date === date ? { ...h, ...updates } : h);
      } else {
        return [...prev, { 
          date, 
          water: 0, 
          sleep: 0, 
          ...updates 
        } as DailyHealth];
      }
    });
  };

  // Streak calculation
  const streak = useMemo(() => {
    if (logs.length === 0) return 0;
    const logDates = [...new Set(logs.map(l => l.date))].sort().reverse();
    let currentStreak = 0;
    
    // Check if we have logs today or yesterday to even have a streak
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
    if (!logDates.includes(todayStr) && !logDates.includes(yesterdayStr)) return 0;

    for (let i = 0; i < 365; i++) {
      const dStr = format(subDays(today, i), 'yyyy-MM-dd');
      if (logDates.includes(dStr)) {
          currentStreak++;
      } else {
          // If the break is today, we check if yesterday had a log
          if (i === 0) continue; 
          break;
      }
    }
    return currentStreak;
  }, [logs, todayStr]);

  // Next session session
  const nextSession = useMemo(() => {
    for (let i = 1; i <= 7; i++) {
        const d = addDays(today, i);
        const dayIdx = (getDay(d) + 6) % 7;
        const dayName = DAYS_OF_WEEK[dayIdx];
        const scheduled = templates.filter(t => t.scheduledDays.includes(dayName));
        if (scheduled.length > 0) return { dayName, date: d, templates: scheduled };
    }
    return null;
  }, [templates, today]);

  // Weekly progress percentage
  const weeklyProgress = useMemo(() => {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    
    let totalScheduled = 0;
    let completedScheduled = 0;
    
    weekDays.forEach(day => {
        const dName = DAYS_OF_WEEK[(getDay(day) + 6) % 7];
        const scheduled = templates.filter(t => t.scheduledDays.includes(dName));
        totalScheduled += scheduled.length;
        
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayLogs = logs.filter(l => l.date === dayStr && l.isScheduled);
        const completedIds = new Set(dayLogs.map(l => l.templateId));
        completedScheduled += completedIds.size;
    });
    
    return totalScheduled > 0 ? Math.min(100, Math.round((completedScheduled / totalScheduled) * 100)) : 0;
  }, [logs, templates, today]);

  // Logic to handle "Scheduled for Today"
  const scheduledToday = templates.filter(t => t.scheduledDays.includes(currentDayName));
  const logsToday = logs.filter(l => isSameDay(parseISO(l.date), today));

  const isLight = false; // Theme switched removed per request
  const chartColors = {
    grid: '#1E293B',
    text: '#94A3B8',
    tooltipBg: '#0F172A',
    tooltipBorder: '#1E293B',
  };

  const addTemplate = (template: Omit<ExerciseTemplate, 'id'>) => {
    const newTemplate = { ...template, id: crypto.randomUUID() };
    setTemplates([...templates, newTemplate]);
    setShowAddTemplate(false);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
    setLogs(logs.filter(l => l.templateId !== id));
  };

  const logExercise = (templateId: string, metrics: MetricValue[], date: Date, notes?: string) => {
    const newLog: ExerciseLog = {
      id: crypto.randomUUID(),
      templateId,
      date: format(date, 'yyyy-MM-dd'),
      metrics,
      notes,
      isScheduled: templates.find(t => t.id === templateId)?.scheduledDays.includes(DAYS_OF_WEEK[(getDay(date) + 6) % 7]) || false
    };
    setLogs([...logs, newLog]);
    setShowLogModal(null);
  };

  const deleteLog = (id: string) => {
    setLogs(logs.filter(l => l.id !== id));
  };

  return (
    <div 
      className="flex h-screen bg-bg text-text overflow-hidden font-sans relative selection:bg-accent selection:text-black"
    >
      {/* Sidebar Navigation - Desktop */}
      <aside 
        className={cn(
          "hidden lg:flex border-r border-border/50 flex-col items-stretch py-10 bg-card shrink-0 transition-all duration-500 z-30",
          sidebarCollapsed ? "w-24" : "w-72"
        )}
      >
        <div className="px-8 mb-12 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Activity size={24} className="text-accent" />
                </div>
                {!sidebarCollapsed && (
                  <div className="flex flex-col">
                    <span className="font-display font-black text-2xl tracking-tighter leading-none">Flex</span>
                    <span className="label-xs leading-none mt-1 opacity-60">Track</span>
                  </div>
                )}
              </div>
        </div>

        {/* Level Progress - Sidebar */}
        <div className={cn("px-6 mb-12 transition-all", sidebarCollapsed ? "px-4" : "px-8")}>
          <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="label-xs opacity-70">Lvl {userStats.level}</span>
              {!sidebarCollapsed && <span className="text-[10px] font-mono opacity-50">{userStats.xp} XP</span>}
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${userStats.currentLevelXp}%` }}
                 className="h-full bg-accent"
               />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 px-6">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "h-14 rounded-2xl flex items-center transition-all duration-300 group relative",
                sidebarCollapsed ? "justify-center" : "px-5 gap-5",
                activeTab === item.id 
                  ? "bg-white/5 border border-white/10 text-white" 
                  : "text-text-dim hover:text-white hover:bg-white/[0.02]"
              )}
            >
              <item.icon size={20} strokeWidth={activeTab === item.id ? 2 : 1.5} className={cn("shrink-0", activeTab === item.id ? "text-accent" : "text-text-dim")} />
              
              {!sidebarCollapsed && (
                <span className="font-semibold text-sm tracking-tight">{item.label}</span>
              )}

              {activeTab === item.id && !sidebarCollapsed && (
                <motion.div layoutId="sidebarActive" className="ml-auto w-1 h-1 bg-accent rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-auto px-4 flex flex-col gap-2">
           <button 
             onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
             className={cn(
               "h-12 rounded-xl flex items-center text-text-dim hover:text-text hover:bg-card/50 transition-all duration-200",
               sidebarCollapsed ? "justify-center" : "px-4 gap-4"
             )}
           >
              {sidebarCollapsed ? <ChevronLast size={20} /> : (
                <>
                  <ChevronFirst size={20} />
                  <span className="font-bold text-sm">Collapse</span>
                </>
              )}
           </button>
           <button 
             onClick={() => setShowSettings(true)}
             className={cn(
               "h-12 rounded-xl flex items-center text-text-dim hover:text-text hover:bg-card/50 transition-all duration-200",
               sidebarCollapsed ? "justify-center" : "px-4 gap-4"
             )}
           >
              <Settings size={20} />
              {!sidebarCollapsed && <span className="font-bold text-sm">Settings</span>}
           </button>
        </div>
      </aside>

      {/* Modern Bottom Navigation - Mobile/Tablet */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-lg h-16 glass-card rounded-[2rem] z-50 flex items-center justify-around px-2 shadow-2xl lg:hidden">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-all duration-300 relative px-4 h-full",
              activeTab === item.id ? "text-accent" : "text-text-dim"
            )}
          >
            {activeTab === item.id && (
              <motion.div 
                layoutId="activeTabGlow"
                className="absolute -top-1 w-1 h-1 bg-accent rounded-full shadow-[0_0_10px_var(--ft-accent)]"
              />
            )}
            <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Mobile Header - High Glass */}
      <div className="lg:hidden fixed top-0 w-full h-16 bg-bg/40 backdrop-blur-xl border-b border-white/5 z-40 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.3)]">
            <Activity size={18} className="text-black" strokeWidth={3} />
          </div>
          <span className="font-bold tracking-tight uppercase italic text-sm">Flex<span className="text-accent underline decoration-2 underline-offset-4">Track</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
             <span className="text-[8px] font-black uppercase text-accent leading-none">LVL {userStats.level}</span>
             <div className="w-12 h-1 bg-border rounded-full mt-1 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${userStats.currentLevelXp}%` }}
                  className="h-full bg-accent" 
                />
             </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 glass-card rounded-full active:scale-95 transition-transform">
            <Settings size={18} className="text-text-dim" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-bg custom-scrollbar pt-16 md:pt-0">
        <header className="px-8 md:px-12 pt-10 md:pt-16 pb-8 md:pb-12 flex flex-col md:flex-row md:items-end justify-between max-w-7xl mx-auto w-full gap-6">
          <div>
            <span className="label-xs text-accent">
              {format(today, 'EEEE, d MMMM')}
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight mt-3">Daily Mastery</h1>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
                <span className="label-xs opacity-50">Consistency</span>
                <span className="text-2xl font-display font-black text-white leading-none mt-1">{weeklyProgress}%</span>
             </div>
             <div className="w-px h-10 bg-white/10" />
             <div className="flex flex-col items-end">
                <span className="label-xs opacity-50">Current Streak</span>
                <span className="text-2xl font-display font-black text-accent leading-none mt-1">{streak} Days</span>
             </div>
          </div>
        </header>

        <div className="px-8 md:px-12 pb-24 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* KPI Overview Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Streak Card */}
                  <div className="premium-card p-6 flex flex-col justify-between group">
                    <div className="flex justify-between items-start mb-10">
                      <div className="label-xs">Momentum</div>
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                        <Zap size={18} fill="currentColor" />
                      </div>
                    </div>
                    <div>
                      <div className="metric-large">{streak}</div>
                      <div className="label-xs mt-2 opacity-50">Day Streak</div>
                    </div>
                  </div>

                  {/* Weekly Progress Card */}
                  <div className="premium-card p-6 flex flex-col justify-between group">
                    <div className="flex justify-between items-start mb-10">
                      <div className="label-xs">Performance</div>
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                        <ArrowUpRight size={18} />
                      </div>
                    </div>
                    <div>
                      <div className="metric-large">{weeklyProgress}%</div>
                      <div className="label-xs mt-2 opacity-50">Weekly Goals</div>
                    </div>
                  </div>

                  {/* Next Session Card */}
                  <div className="premium-card p-6 flex flex-col justify-between group">
                    <div className="flex justify-between items-start mb-10">
                      <div className="label-xs">Scheduled</div>
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                        <Calendar size={18} />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-display font-black mb-1 truncate">{nextSession ? nextSession.dayName : 'Free Day'}</div>
                      <div className="label-xs opacity-50">{nextSession ? format(nextSession.date, 'MMM d') : '-'}</div>
                    </div>
                  </div>

                  {/* Quick Activity Button */}
                  <button 
                    onClick={() => setActiveTab('templates')}
                    className="premium-card bg-accent border-accent p-6 flex flex-col justify-between group hover:scale-[0.98] transition-transform text-white"
                  >
                    <div className="flex justify-normal items-start mb-10">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <Plus size={24} strokeWidth={3} />
                      </div>
                    </div>
                    <div className="text-2xl font-display font-black text-left leading-none uppercase">New<br />Workout</div>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Daily Checklist Column (2/3) */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="premium-card p-6 lg:p-8 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                            <ListTodo size={28} className="text-accent" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-display font-black tracking-tight">Active Duty</h2>
                            <p className="label-xs mt-1 opacity-50">{scheduledToday.length} Sessions Assigned</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {scheduledToday.length > 0 ? (
                          scheduledToday.map(template => {
                            const log = logsToday.find(l => l.templateId === template.id);
                            return (
                              <div 
                                key={template.id}
                                className={cn(
                                  "group flex items-center gap-5 p-5 rounded-[2rem] border transition-all duration-300",
                                  log ? "bg-accent/5 border-accent/20" : "bg-white/[0.02] border-white/5 hover:border-white/20"
                                )}
                              >
                                <button 
                                  disabled={!!log}
                                  onClick={() => setShowLogModal({ template, date: today })}
                                  className={cn(
                                    "flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all border-2",
                                    log 
                                      ? "bg-accent border-accent text-black" 
                                      : "border-white/10 text-transparent hover:border-accent"
                                  )}
                                >
                                  {log && <CheckCircle2 size={20} strokeWidth={3} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <h3 className={cn("font-bold text-lg tracking-tight truncate", log && "opacity-40")}>
                                    {template.name}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    {template.metrics.map((m, i) => (
                                      <span key={i} className="text-[10px] font-bold uppercase tracking-widest text-text-dim px-2 py-0.5 rounded-full border border-white/5 bg-white/[0.03]">
                                        {m.targetValue ? `${m.targetValue} ${m.label}` : m.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {log && (
                                  <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-accent/10 rounded-full border border-accent/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                    <span className="label-xs text-accent">Verified</span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-20 text-center bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10">
                            <Coffee className="mx-auto text-text-dim opacity-20 mb-6" size={56} opacity={0.3} />
                            <h3 className="text-xl font-display font-bold mb-2">Rest & Recovery</h3>
                            <p className="text-text-dim text-xs max-w-xs mx-auto italic px-10 leading-relaxed opacity-60">No scheduled activities for today. Ideal conditions for deep recovery or active mobility work.</p>
                            <button 
                                onClick={() => setActiveTab('templates')}
                                className="mt-8 label-xs text-accent hover:underline underline-offset-8"
                            >
                                Exercise Library
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Frequency Card */}
                    <div className="premium-card p-6 lg:p-8">
                      <div className="flex justify-between items-center mb-10">
                         <h2 className="label-xs opacity-50">Volume Distribution</h2>
                         <div className="label-xs text-accent">Log Frequency</div>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Array.from({ length: 7 }).map((_, i) => {
                            const d = subDays(today, 6 - i);
                            const dStr = format(d, 'yyyy-MM-dd');
                            return {
                              name: format(d, 'EEE').toUpperCase(),
                              count: logs.filter(l => l.date === dStr).length,
                              isToday: isSameDay(d, today)
                            };
                          })}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#FFFFFF" opacity={0.05} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 9, fontWeight: '800', fill: '#8E9196', letterSpacing: '0.1em' }} 
                              dy={15}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                              contentStyle={{ backgroundColor: '#141415', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
                              itemStyle={{ fontSize: 10, fontWeight: '800', color: '#60A5FA', textTransform: 'uppercase' }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {Array.from({ length: 7 }).map((entry, index) => {
                                const isToday = index === 6;
                                return (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={isToday ? '#60A5FA' : 'rgba(255,255,255,0.05)'} 
                                  />
                                );
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Health Trackers Column (1/3) */}
                  <div className="space-y-6">
                    {/* Water Tracker */}
                    <div className="premium-card p-6 lg:p-8 relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-12">
                        <div>
                          <h2 className="text-2xl font-display font-black tracking-tight">Hydration</h2>
                          <p className="label-xs mt-2 opacity-50">TGT: {settings.waterGoal} Units</p>
                        </div>
                        <div className="w-14 h-14 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-500">
                          <Droplet size={28} className={currentHealth.water >= settings.waterGoal ? "animate-bounce" : ""} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-8 mb-10">
                        <div className="flex items-baseline gap-3">
                          <span className="metric-large">{currentHealth.water}</span>
                          <span className="label-xs opacity-50">Total</span>
                        </div>
                        <div className="flex gap-4">
                           <button 
                             onClick={() => updateHealth({ water: Math.max(0, currentHealth.water - 1) })}
                             className="flex-1 h-16 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-text-dim hover:text-white hover:bg-white/[0.08] transition-all"
                           >
                             <RotateCcw size={22} />
                           </button>
                           <button 
                             onClick={() => updateHealth({ water: currentHealth.water + 1 })}
                             className="flex-[2] h-16 rounded-3xl bg-accent text-white flex items-center justify-center shadow-lg shadow-blue-500/40 hover:scale-[0.98] transition-all"
                           >
                             <Plus size={32} strokeWidth={3} />
                           </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                           <motion.div 
                              key={i}
                              initial={false}
                              animate={{ 
                               backgroundColor: i < currentHealth.water ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                                opacity: i < currentHealth.water ? 1 : 0.5,
                                scale: i < currentHealth.water ? 1 : 0.95
                              }}
                              className="h-2 rounded-full overflow-hidden"
                           />
                        ))}
                      </div>
                    </div>

                    {/* Sleep Tracker */}
                    <div className="premium-card p-6 lg:p-8">
                       <div className="flex justify-between items-start mb-12">
                        <div>
                          <h2 className="text-2xl font-display font-black tracking-tight">Recovery</h2>
                          <p className="label-xs mt-2 opacity-50">TGT: {settings.sleepGoal} HR</p>
                        </div>
                        <div className="w-14 h-14 rounded-3xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-500">
                          <Moon size={28} />
                        </div>
                      </div>

                      <div className="flex items-end gap-4 mb-10">
                         <div className="flex items-baseline gap-2">
                            <span className="metric-large">
                               {Math.floor(currentHealth.sleep)}
                            </span>
                            <span className="label-xs opacity-50 mr-2">H</span>
                            <span className="metric-large">
                               {Math.round((currentHealth.sleep % 1) * 60)}
                            </span>
                            <span className="label-xs opacity-50">M</span>
                         </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {!currentHealth.sleepStart ? (
                          <motion.button 
                            key="start-sleep"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={() => updateHealth({ sleepStart: now.toISOString() })}
                            className="w-full h-16 rounded-3xl bg-white/[0.03] border border-white/10 text-white font-black tracking-widest uppercase text-[10px] flex items-center justify-center gap-3 hover:bg-white/[0.08] transition-all mb-6"
                          >
                            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
                            Initiate Cycle
                          </motion.button>
                        ) : (
                          <motion.div 
                            key="sleeping"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-6 space-y-4"
                          >
                            <div className="flex flex-col items-center justify-center h-28 bg-white/[0.02] rounded-[2rem] border border-accent/20 relative overflow-hidden">
                                <div className="absolute inset-0 bg-accent/5 animate-pulse" />
                                <span className="label-xs text-accent opacity-70 mb-2 z-10">Monitoring...</span>
                                <div className="text-3xl font-display font-black text-white z-10">
                                   {(() => {
                                     const diff = Math.max(0, now.getTime() - new Date(currentHealth.sleepStart!).getTime());
                                     const h = Math.floor(diff / (1000 * 60 * 60));
                                     const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                     const s = Math.floor((diff % (1000 * 60)) / 1000);
                                     return `${h}h ${m}m ${s}s`;
                                   })()}
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                  const startLocal = new Date(currentHealth.sleepStart!);
                                  const durationHrsLocal = (now.getTime() - startLocal.getTime()) / (1000 * 60 * 60);
                                  updateHealth({ 
                                    sleep: Math.round((currentHealth.sleep + durationHrsLocal) * 100) / 100,
                                    sleepStart: undefined 
                                  });
                                }}
                                className="w-full h-16 rounded-3xl bg-purple-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-purple-500/40 hover:scale-[0.98] transition-all"
                            >
                                Wake Up & Log
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex items-center gap-4 bg-white/[0.03] rounded-3xl p-5 border border-white/5">
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0">
                          <Brain size={20} className="text-purple-400" />
                        </div>
                        <p className="text-[11px] text-text-dim leading-relaxed italic opacity-60">
                          Prioritize sleep architecture for neurological restoration and GH release.
                        </p>
                      </div>
                    </div>

                    {/* Fasting Tracker */}
                    <div className="premium-card p-6 lg:p-8 relative overflow-hidden group">
                       <div className="flex justify-between items-start mb-12">
                        <div>
                          <h2 className="text-2xl font-display font-black tracking-tight">Metabolism</h2>
                          <p className="label-xs mt-2 opacity-50">State: Autophagy</p>
                        </div>
                        <div className="w-14 h-14 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <Clock size={28} />
                        </div>
                      </div>

                       {!currentHealth.fastingStart ? (
                        <button 
                          onClick={() => updateHealth({ fastingStart: now.toISOString() })}
                          className="w-full h-40 rounded-[2.5rem] bg-white/[0.03] border border-white/5 text-white flex flex-col items-center justify-center gap-4 hover:bg-white/[0.08] transition-all group shadow-inner"
                        >
                          <Zap size={32} strokeWidth={2.5} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                          <span className="label-xs opacity-60">Initiate Fast</span>
                        </button>
                      ) : !currentHealth.fastingEnd ? (
                        <div className="space-y-6">
                           <div className="flex flex-col items-center py-10 bg-white/[0.02] rounded-[3rem] border border-emerald-500/20 relative overflow-hidden">
                              <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />
                              <span className="label-xs text-emerald-500 opacity-60 mb-3 tracking-widest z-10 uppercase">Timer Live</span>
                              <div className="text-4xl font-display font-black text-white z-10">
                                 {(() => {
                                   const diff = Math.max(0, now.getTime() - new Date(currentHealth.fastingStart).getTime());
                                   const h = Math.floor(diff / (1000 * 60 * 60));
                                   const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                   const s = Math.floor((diff % (1000 * 60)) / 1000);
                                   return `${h}h ${m}m ${s}s`;
                                 })()}
                              </div>
                           </div>
                           <button 
                            onClick={() => updateHealth({ fastingEnd: now.toISOString() })}
                            className="w-full h-16 rounded-3xl bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/40 hover:scale-[0.98] transition-all"
                           >
                            Terminate Session
                           </button>
                        </div>
                      ) : (
                         <div className="space-y-6">
                            <div className="flex items-center justify-between p-6 bg-white/[0.03] rounded-[2rem] border border-emerald-500/20">
                              <div className="flex items-center gap-4">
                                <CheckCircle2 size={24} className="text-emerald-500" />
                                <span className="label-xs opacity-60">Session Logged</span>
                              </div>
                              <span className="text-xl font-display font-black text-emerald-500">
                                 {formatDuration((new Date(currentHealth.fastingEnd).getTime() - new Date(currentHealth.fastingStart).getTime()) / (1000 * 60 * 60))}
                              </span>
                            </div>
                            <button 
                              onClick={() => updateHealth({ fastingStart: undefined, fastingEnd: undefined })}
                              className="w-full h-16 rounded-3xl bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/40 hover:scale-[0.98] transition-all"
                            >
                              Reset Protocol
                            </button>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'templates' && (
              <motion.div
                key="templates"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div className="flex items-center gap-6">
                  <h2 className="text-2xl font-display font-black tracking-tight whitespace-nowrap uppercase">Exercise Protocols</h2>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {templates.map(template => (
                    <div key={template.id} className="premium-card p-6 md:p-8 group">
                      <div className="flex justify-between items-start mb-10">
                        <div>
                           <h3 className="text-2xl font-display font-black text-white mb-3 uppercase tracking-tight">{template.name}</h3>
                           <div className="flex flex-wrap gap-2">
                             {template.metrics.map((m, idx) => (
                               <span key={idx} className="label-xs opacity-30 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-xl">
                                 {m.label}
                               </span>
                             ))}
                           </div>
                        </div>
                        <button onClick={() => deleteTemplate(template.id)} className="w-10 h-10 rounded-2xl bg-red-500/5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                           <Calendar size={12} className="text-accent/40" />
                           <span className="label-xs opacity-30 tracking-[0.2em]">Deployment Schedule</span>
                        </div>
                        <div className="flex gap-2">
                          {DAYS_OF_WEEK.map(day => {
                            const isActive = template.scheduledDays.includes(day);
                            return (
                              <div 
                                key={day} 
                                className={cn(
                                  "flex-1 py-3 rounded-2xl border text-center text-[10px] font-black transition-all",
                                  isActive 
                                    ? "bg-accent border-accent text-black" 
                                    : "border-white/5 text-text-dim/20 bg-white/[0.01]"
                                )}
                              >
                                {day.slice(0, 1)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button 
                    onClick={() => setShowAddTemplate(true)}
                    className="premium-card p-10 flex flex-col items-center justify-center gap-6 border-dashed border-2 border-white/10 hover:border-accent/40 hover:bg-accent/[0.01] transition-all group"
                  >
                    <div className="w-16 h-16 rounded-[2rem] bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-accent group-hover:text-black transition-all shadow-xl">
                       <Plus size={32} strokeWidth={3} />
                    </div>
                    <div>
                      <span className="text-sm font-black uppercase tracking-[0.3em] block mb-2 opacity-60">Create Protocol</span>
                      <span className="text-[10px] text-accent font-bold opacity-40 italic">Add New Entry to Database</span>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold tracking-tight">Timeline</h2>
                
                <div className="space-y-16">
                   {Array.from({ length: 30 }).map((_, dayOffset) => {
                     const date = subDays(today, dayOffset);
                     const dateStr = format(date, 'yyyy-MM-dd');
                     const dateLogs = logs.filter(l => l.date === dateStr);
                     const health = dailyHealth.find(h => h.date === dateStr);
                     const hasData = dateLogs.length > 0 || (health && (health.water > 0 || health.sleep > 0 || health.fastingStart));

                     if (!hasData && dayOffset > 7) return null; // Only show empty days for the first week
                     
                     return (
                       <section key={dateStr} className="relative pl-12 md:pl-16">
                         <div className="absolute left-0 top-0 bottom-[-64px] w-px bg-white/5 last:bottom-0"></div>
                         <div className={cn(
                           "absolute left-[-6px] top-1.5 w-3 h-3 rounded-full border-2",
                           hasData ? "bg-accent border-accent" : "bg-bg border-white/10"
                         )}></div>
                         
                         <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-5 mb-8">
                            <h3 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tight">
                              {isSameDay(date, today) ? 'Today' : format(date, 'EEEE')}
                            </h3>
                            <span className="label-xs opacity-40">
                               {format(date, 'd MMM, yyyy')}
                            </span>
                         </div>

                         <div className="grid gap-4 mb-8">
                            {(() => {
                              const health = dailyHealth.find(h => h.date === dateStr);
                              if (!health) return null;
                              return (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {health.water > 0 && (
                                    <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl flex items-center gap-4">
                                      <Droplet size={18} className="text-blue-500" />
                                      <div>
                                        <div className="label-xs opacity-50 mb-1">Fluid</div>
                                        <div className="text-lg font-display font-black">{health.water} Units</div>
                                      </div>
                                    </div>
                                  )}
                                  {health.sleep > 0 && (
                                    <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl flex items-center gap-4">
                                      <Moon size={18} className="text-purple-500" />
                                      <div>
                                        <div className="label-xs opacity-50 mb-1">Recovery</div>
                                        <div className="text-lg font-display font-black">{formatDuration(health.sleep)}</div>
                                      </div>
                                    </div>
                                  )}
                                  {(health.fastingStart && health.fastingEnd) && (
                                    <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl flex items-center gap-4">
                                      <Clock size={18} className="text-emerald-500" />
                                      <div>
                                        <div className="label-xs opacity-50 mb-1">Fast</div>
                                        <div className="text-lg font-display font-black">
                                          {formatDuration((new Date(health.fastingEnd).getTime() - new Date(health.fastingStart).getTime()) / (1000 * 60 * 60))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                         </div>

                         {dateLogs.length > 0 ? (
                            <div className="grid gap-4">
                               {dateLogs.map(log => {
                                 const template = templates.find(t => t.id === log.templateId);
                                 return (
                                   <div key={log.id} className="premium-card p-5 md:p-6 flex justify-between items-center group">
                                     <div className="flex gap-6 items-center">
                                       <div className="text-accent bg-white/[0.03] p-3 rounded-2xl border border-white/5">
                                          <Dumbbell size={22} />
                                       </div>
                                       <div>
                                         <h4 className="font-bold text-lg">{template?.name || 'Workout'}</h4>
                                         <div className="flex gap-4 mt-2">
                                            {log.metrics.map((m, idx) => (
                                              <div key={idx} className="flex items-center gap-1.5">
                                                <span className="text-sm font-mono font-bold text-white">{m.value}</span>
                                                <span className="label-xs opacity-40 lowercase tracking-tighter">{m.type}</span>
                                              </div>
                                            ))}
                                         </div>
                                       </div>
                                     </div>
                                     <button onClick={() => deleteLog(log.id)} className="opacity-0 group-hover:opacity-100 p-2 text-text-dim hover:text-red-500 transition-all">
                                        <Trash2 size={18} />
                                     </button>
                                   </div>
                                 );
                               })}
                            </div>
                         ) : (
                           <div className="inline-block label-xs opacity-20 italic">Rest Protocol Enforced</div>
                         )}
                       </section>
                     );
                   })}
                </div>
              </motion.div>
            )}

            {activeTab === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{format(calendarDate, 'MMMM yyyy')}</h2>
                    <p className="text-text-dim text-sm">Schedule Overview</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                      className="p-2 border border-border rounded-lg hover:bg-card transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                      className="p-2 border border-border rounded-lg hover:bg-card transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden p-4">
                  <div className="grid grid-cols-7 border-b border-border pb-4 mb-4">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <div key={day} className="text-center text-[10px] font-bold text-text-dim uppercase tracking-widest">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const start = startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 1 });
                      const end = eachDayOfInterval({
                        start,
                        end: addDays(startOfWeek(endOfMonth(calendarDate), { weekStartsOn: 1 }), 6)
                      });
                      
                      return end.map(day => {
                        const dayStr = format(day, 'EEEE');
                        const scheduled = templates.filter(t => t.scheduledDays.includes(dayStr as any));
                        const dayLogs = logs.filter(l => l.date === format(day, 'yyyy-MM-dd'));
                        const isTodayVal = isSameDay(day, today);
                        const currentMonth = isSameMonth(day, calendarDate);

                        return (
                          <button 
                            key={day.toISOString()} 
                            onClick={() => setSelectedCalendarDate(day)}
                            className={cn(
                              "min-h-[80px] md:min-h-[100px] border border-border/20 p-2 group transition-all text-left w-full",
                              !currentMonth && "opacity-20 pointer-events-none",
                              isTodayVal && "bg-accent/5 border-accent/40",
                              selectedCalendarDate && isSameDay(day, selectedCalendarDate) && "ring-1 ring-accent bg-accent/[0.02]"
                            )}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className={cn(
                                "text-xs font-mono font-bold",
                                isTodayVal ? "text-accent" : "text-text-dim"
                              )}>
                                {format(day, 'd')}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {scheduled.map(t => {
                                const isComplete = dayLogs.some(l => l.templateId === t.id);
                                return (
                                  <div 
                                    key={t.id} 
                                    className={cn(
                                      "text-[8px] p-1 rounded font-bold uppercase truncate border",
                                      isComplete 
                                        ? "bg-accent/20 border-accent/30 text-accent" 
                                        : "bg-border border-transparent text-text-dim"
                                    )}
                                  >
                                    {t.name}
                                  </div>
                                );
                              })}
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Day Details */}
                <AnimatePresence mode="wait">
                  {selectedCalendarDate && (
                    <motion.div
                      ref={dayDetailsRef}
                      key={selectedCalendarDate.toISOString()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-card border border-border rounded-[2rem] p-5 md:p-8"
                    >
                      <div className="flex justify-between items-center mb-6 relative z-10">
                        <div>
                          <h3 className="text-lg md:text-xl font-bold">{format(selectedCalendarDate, 'EEEE, MMM do')}</h3>
                          <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest mt-1">Daily Activity Report</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setActiveTab('templates')}
                            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-accent hover:border-accent transition-all"
                          >
                            <Plus size={14} />
                            Log Extra
                          </button>
                          <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-xl border border-accent/20">
                            <span className="w-2 h-2 rounded-full bg-accent" />
                            <span className="text-[10px] font-bold text-accent uppercase tracking-widest">
                              {logs.filter(l => l.date === format(selectedCalendarDate, 'yyyy-MM-dd')).length} Done
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Giant background number for typographic flair */}
                      <div className="absolute top-0 right-10 text-[10rem] font-black text-white/[0.02] leading-none pointer-events-none font-mono">
                        {format(selectedCalendarDate, 'dd')}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                        {(() => {
                           const selectedDateStr = format(selectedCalendarDate, 'yyyy-MM-dd');
                           const dayHealth = dailyHealth.find(h => h.date === selectedDateStr);

                           return (
                             <>
                               {dayHealth && (dayHealth.water > 0 || dayHealth.sleep > 0 || (dayHealth.fastingStart && dayHealth.fastingEnd)) && (
                                 <div className="md:col-span-2 glass-card rounded-3xl p-6 flex flex-wrap gap-6 mb-2">
                                    {dayHealth.water > 0 && (
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                                          <Droplet size={18} />
                                        </div>
                                        <div>
                                          <p className="text-[8px] font-black uppercase tracking-widest text-text-dim">Fluid</p>
                                          <p className="font-display font-black text-lg">{dayHealth.water} Units</p>
                                        </div>
                                      </div>
                                    )}
                                    {dayHealth.sleep > 0 && (
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                                          <Moon size={18} />
                                        </div>
                                        <div>
                                          <p className="text-[8px] font-black uppercase tracking-widest text-text-dim">Sleep</p>
                                          <p className="font-display font-black text-lg">{formatDuration(dayHealth.sleep)}</p>
                                        </div>
                                      </div>
                                    )}
                                    {dayHealth.fastingStart && dayHealth.fastingEnd && (
                                       <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                                            <Clock size={18} />
                                          </div>
                                          <div>
                                            <p className="text-[8px] font-black uppercase tracking-widest text-text-dim">Fast</p>
                                            <p className="font-display font-black text-lg">
                                               {formatDuration((new Date(dayHealth.fastingEnd).getTime() - new Date(dayHealth.fastingStart).getTime()) / (1000 * 60 * 60))}
                                            </p>
                                          </div>
                                       </div>
                                    )}
                                 </div>
                               )}
                               {(() => {
                                 const dayLogs = logs.filter(l => l.date === selectedDateStr);
                                 const loggedTemplateIds = new Set(dayLogs.map(l => l.templateId));
                                 const scheduledForDay = templates.filter(t => t.scheduledDays.includes(format(selectedCalendarDate, 'EEEE') as any));
                                 const scheduledTemplateIds = new Set(scheduledForDay.map(t => t.id));

                                 const allRelevantTemplates = templates.filter(t => scheduledTemplateIds.has(t.id) || loggedTemplateIds.has(t.id));

                                 return allRelevantTemplates.map(template => {
                                  const log = dayLogs.find(l => l.templateId === template.id);
                                  const isScheduled = scheduledTemplateIds.has(template.id);

                                  return (
                                    <button 
                                      key={template.id} 
                                      onClick={() => !log && setShowLogModal({ template, date: selectedCalendarDate })}
                                      className={cn(
                                        "p-6 bg-card/50 border border-border/50 rounded-3xl flex items-center justify-between group hover:border-accent/30 transition-all text-left",
                                        !log ? "hover:translate-y-[-2px] hover:shadow-lg active:scale-[0.98]" : "cursor-default"
                                      )}
                                    >
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className="font-bold text-lg tracking-tight">{template.name}</h4>
                                          {!isScheduled && (
                                            <span className="px-2 py-0.5 bg-border text-[8px] font-bold rounded-full text-text-dim uppercase tracking-widest">Extra</span>
                                          )}
                                        </div>
                                        <div className="flex gap-4 mt-3">
                                          {template.metrics.map(m => (
                                            <div key={m.type} className="flex flex-col">
                                              <span className="text-[8px] font-bold uppercase text-text-dim tracking-tighter mb-0.5">{m.label}</span>
                                              <div className="flex items-baseline gap-1">
                                                <span className="text-sm font-mono font-bold text-text">
                                                  {log ? log.metrics.find(lm => lm.type === m.type)?.value : '--'}
                                                </span>
                                                {isScheduled && m.targetValue && (
                                                  <span className="text-[10px] text-border font-mono italic">
                                                    / {m.targetValue}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all shadow-lg",
                                        log ? "bg-accent border-accent text-black scale-105" : "border-border text-border group-hover:border-accent group-hover:bg-accent/5 group-hover:text-accent group-hover:rotate-12"
                                      )}>
                                        {log ? <CheckCircle2 size={24} /> : <Target size={24} className="opacity-20 group-hover:opacity-100" />}
                                      </div>
                                    </button>
                                  );
                                 });
                               })()}
                             </>
                           );
                        })()}
                      </div>

                      {(() => {
                         const selectedDateStr = format(selectedCalendarDate, 'yyyy-MM-dd');
                         const dayLogs = logs.filter(l => l.date === selectedDateStr);
                         const scheduledForDay = templates.filter(t => t.scheduledDays.includes(format(selectedCalendarDate, 'EEEE') as any));
                         return (scheduledForDay.length === 0 && dayLogs.length === 0);
                      })() && (
                        <div className="text-center py-16 border-2 border-dashed border-border rounded-[2.5rem] bg-bg/30">
                          <Plus size={32} className="mx-auto text-border mb-4 opacity-50" />
                          <p className="text-text-dim text-xs font-bold uppercase tracking-widest">No activities scheduled or logged for this day</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8"
              >
                 <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Performance Analytics</h2>
                      <p className="text-text-dim text-sm mt-1">Holistic view of your progression and volume</p>
                    </div>
                 </div>
                 
                  {/* Summary KPI Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <div className="premium-card p-6 relative overflow-hidden group">
                      <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest mb-2 block">Progression Average</span>
                      <h4 className="text-4xl font-display font-black text-accent">
                        {logs.length > 10 ? '+8.5%' : '--'}
                      </h4>
                    </div>
                    <div className="premium-card p-6">
                      <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest mb-2 block">Consistency Score</span>
                      <h4 className="text-4xl font-display font-black">
                        {logs.length > 0 ? Math.round((logs.filter(l => l.isScheduled).length / logs.length) * 100) : 0}%
                      </h4>
                    </div>
                    <div className="premium-card p-6">
                      <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest mb-2 block">Weekly Volume</span>
                      <h4 className="text-4xl font-display font-black uppercase">
                        {Math.round(logs.filter(l => parseISO(l.date) > subDays(today, 7)).reduce((acc, curr) => acc + curr.metrics.reduce((a, c) => a + c.value, 0), 0) / 100) / 10}k
                      </h4>
                    </div>
                    <div className="premium-card p-6">
                      <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest mb-2 block">Personal Records</span>
                      <h4 className="text-4xl font-display font-black text-accent">{templates.length > 0 ? logs.length : 0}</h4>
                    </div>
                  </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {/* Weekly Load Analysis */}
                    <div className="bg-card border border-border rounded-2xl p-5 md:p-8">
                       <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-text-dim mb-8">Weekly Load Distribution</h3>
                       <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={templates.map(t => {
                              const tLogs = logs.filter(l => l.templateId === t.id && parseISO(l.date) > subDays(today, 7));
                              const volume = tLogs.reduce((acc, curr) => acc + curr.metrics.reduce((a, c) => a + c.value, 0), 0);
                              return { name: t.name, volume };
                            }).filter(v => v.volume > 0)}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} opacity={0.2} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartColors.text }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartColors.text }} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '12px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              />
                              <Bar dataKey="volume" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                       </div>
                    </div>

                    {/* Intensity Distribution (Exercise Volume share) */}
                    <div className="bg-card border border-border rounded-2xl p-5 md:p-8">
                       <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-text-dim mb-8">Volume Distribution</h3>
                       <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={templates.map((t, idx) => {
                                  const volume = logs.filter(l => l.templateId === t.id).reduce((acc, curr) => acc + curr.metrics.reduce((a,c) => a+c.value,0), 0);
                                  return { name: t.name, value: volume };
                                }).filter(v => v.value > 0)}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {templates.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#60A5FA' : '#111827'} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '12px' }}
                                itemStyle={{ color: '#fafafa', fontSize: '10px', fontWeight: 'bold' }}
                              />
                            </PieChart>
                         </ResponsiveContainer>
                       </div>
                    </div>

                  <div className="h-[400px] sm:h-[500px] lg:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={Array.from({ length: 14 }).map((_, i) => {
                        const d = subDays(today, 13 - i);
                        const dayLogs = logs.filter(l => l.date === format(d, 'yyyy-MM-dd'));
                        const volume = dayLogs.reduce((acc, curr) => acc + curr.metrics.reduce((a,c) => a+c.value, 0), 0);
                        return { name: format(d, 'MMM d'), volume };
                      })}>
                        <defs>
                          <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#FFFFFF" opacity={0.05} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fill: '#8E9196', fontWeight: 'bold' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fill: '#8E9196', fontWeight: 'bold' }} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#141415', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px' }}
                          itemStyle={{ color: '#60A5FA', fontSize: '10px', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="volume" stroke="#60A5FA" fill="url(#volGradient)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                 </div>

                 {/* Vitals & Calculator Section */}
                  <div className="space-y-10">
                     <div className="flex items-center gap-6">
                       <h3 className="text-2xl font-display font-black tracking-tight whitespace-nowrap uppercase">Biometric Intelligence</h3>
                       <div className="h-px flex-1 bg-white/5" />
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Interactive Calculator Input */}
                        <div className="lg:col-span-12 xl:col-span-8 premium-card p-6 lg:p-10">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                              <div className="space-y-12">
                                 <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                      <label className="label-xs opacity-50 flex items-center gap-3">
                                         <Scale size={16} className="text-accent" />
                                         Weight
                                      </label>
                                      <span className="text-4xl font-display font-black tracking-tight text-white uppercase">
                                         {settings.weight || 70} <span className="text-xs opacity-40 ml-2">kg</span>
                                      </span>
                                    </div>
                                    <input 
                                       type="range"
                                       min="30"
                                       max="150"
                                       step="0.5"
                                       value={settings.weight || 70}
                                       onChange={(e) => setSettings({ ...settings, weight: Number(e.target.value) })}
                                       className="w-full h-1.5 bg-white/[0.03] rounded-full appearance-none cursor-pointer accent-accent"
                                    />
                                 </div>

                                 <div className="space-y-6">
                                    <label className="label-xs opacity-50 flex items-center gap-3">
                                       <Ruler size={16} className="text-accent" />
                                       Height
                                    </label>
                                    <div className="grid grid-cols-2 gap-8">
                                       <div className="space-y-4">
                                          <div className="flex justify-between items-end">
                                             <span className="label-xs opacity-30 tracking-[0.2em] uppercase">Feet</span>
                                             <span className="text-3xl font-display font-black text-white leading-none">
                                                {Math.floor((settings.height || 170) / 30.48)}
                                             </span>
                                          </div>
                                          <input 
                                             type="range"
                                             min="3"
                                             max="8"
                                             step="1"
                                             value={Math.floor((settings.height || 170) / 30.48)}
                                             onChange={(e) => {
                                                const ft = Number(e.target.value);
                                                const currentCm = settings.height || 170;
                                                const currentInchesTotal = currentCm / 2.54;
                                                const currentRemainingInches = Math.round(currentInchesTotal % 12);
                                                const newCm = ((ft * 12) + currentRemainingInches) * 2.54;
                                                setSettings({ ...settings, height: Math.round(newCm) });
                                             }}
                                             className="w-full h-1 bg-white/[0.03] rounded-full appearance-none cursor-pointer accent-accent"
                                          />
                                       </div>
                                       <div className="space-y-4">
                                          <div className="flex justify-between items-end">
                                             <span className="label-xs opacity-30 tracking-[0.2em] uppercase">Inches</span>
                                             <span className="text-3xl font-display font-black text-white leading-none">
                                                {Math.round(((settings.height || 170) / 2.54) % 12)}
                                             </span>
                                          </div>
                                          <input 
                                             type="range"
                                             min="0"
                                             max="11"
                                             step="1"
                                             value={Math.round(((settings.height || 170) / 2.54) % 12)}
                                             onChange={(e) => {
                                                const newInches = Number(e.target.value);
                                                const currentCm = settings.height || 170;
                                                const currentFeet = Math.floor(currentCm / 30.48);
                                                const newCm = ((currentFeet * 12) + newInches) * 2.54;
                                                setSettings({ ...settings, height: Math.round(newCm) });
                                             }}
                                             className="w-full h-1 bg-white/[0.03] rounded-full appearance-none cursor-pointer accent-accent"
                                          />
                                       </div>
                                    </div>
                                   <div className="label-xs opacity-20 text-right uppercase tracking-[0.2em]">
                                      System Total: {settings.height || 170} cm
                                   </div>
                                </div>
                             </div>

                             <div className="space-y-8">
                                <div className="grid grid-cols-2 gap-6">
                                   <div className="space-y-4">
                                      <label className="label-xs opacity-50">Age Profile</label>
                                      <input 
                                         type="number"
                                         value={settings.age || 25}
                                         onChange={(e) => setSettings({ ...settings, age: Number(e.target.value) })}
                                         className="w-full bg-white/[0.03] border border-white/5 rounded-3xl p-6 text-3xl font-display font-black text-white outline-none focus:border-accent transition-all uppercase"
                                      />
                                   </div>
                                   <div className="space-y-4">
                                      <label className="label-xs opacity-50">Identity</label>
                                      <div className="grid grid-cols-2 gap-2 bg-white/[0.03] p-1.5 rounded-3xl border border-white/5">
                                         <button 
                                            onClick={() => setSettings({ ...settings, gender: 'male' })}
                                            className={cn(
                                               "py-4 rounded-2xl label-xs tracking-widest transition-all",
                                               settings.gender === 'male' ? "bg-accent text-black font-black" : "opacity-40 hover:opacity-100 hover:bg-white/5"
                                            )}
                                         >
                                            M
                                         </button>
                                         <button 
                                            onClick={() => setSettings({ ...settings, gender: 'female' })}
                                            className={cn(
                                               "py-4 rounded-2xl label-xs tracking-widest transition-all",
                                               settings.gender === 'female' ? "bg-accent text-black font-black" : "opacity-40 hover:opacity-100 hover:bg-white/5"
                                            )}
                                         >
                                            F
                                         </button>
                                      </div>
                                   </div>
                                </div>

                                <div className="p-6 bg-accent/5 border border-accent/10 rounded-[2.5rem]">
                                   <div className="flex items-start gap-4">
                                      <Info size={18} className="text-accent mt-0.5 flex-shrink-0" />
                                      <p className="text-[12px] italic leading-relaxed text-accent/80 font-medium">
                                         {(() => {
                                            const w = settings.weight ?? 70;
                                            const h = settings.height ?? 170;
                                            const bmi = w / Math.pow(h / 100, 2);
                                            if (bmi < 18.5) return "Your BMI suggests potential nutritional deficiency. Prioritize caloric density and hypertrophy stimuli.";
                                            if (bmi < 25) return "Metabolic equilibrium achieved. Maintain current volumetric load and recovery protocols.";
                                            if (bmi < 30) return "Elevated BMI detected. Consider intensifying cardiovascular output or metabolic conditioning.";
                                            return "High systemic stress risk. Recommend clinical metabolic screening and structured activity ramp-up.";
                                         })()}
                                      </p>
                                   </div>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* Display Results */}
                       <div className="lg:col-span-12 xl:col-span-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-8">
                          <div className="premium-card p-10 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:rotate-12 transition-transform">
                                <Calculator size={140} />
                             </div>
                             
                             <div className="relative mb-10">
                                {(() => {
                                   const w = settings.weight ?? 70;
                                   const h = settings.height ?? 170;
                                   const bmi = w / Math.pow(h / 100, 2);
                                   const progress = Math.max(0, Math.min(100, ((bmi - 15) / 20) * 100));
                                   return <ProgressRing size={180} stroke={14} progress={progress} color="#60A5FA" />;
                                })()}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                   <span className="text-6xl font-display font-black tracking-tight leading-none text-white uppercase">
                                      {((settings.weight ?? 70) / Math.pow((settings.height ?? 170) / 100, 2)).toFixed(1)}
                                   </span>
                                   <span className="label-xs text-accent mt-3 opacity-80">Body Mass Profile</span>
                                </div>
                             </div>

                             <div className="space-y-4 w-full">
                                <div className="flex justify-between items-center p-5 bg-white/[0.02] rounded-[2rem] border border-white/5">
                                   <span className="label-xs opacity-50">Fat Estimate</span>
                                   <span className="text-2xl font-display font-black text-white uppercase">
                                      {(() => {
                                         const w = settings.weight ?? 70;
                                         const h = settings.height ?? 170;
                                         const age = settings.age ?? 25;
                                         const gender = settings.gender === 'female' ? 0 : 1;
                                         const bmi = w / Math.pow(h / 100, 2);
                                         const bf = (1.20 * bmi) + (0.23 * age) - (10.8 * gender) - 5.4;
                                         return Math.max(0, bf).toFixed(1);
                                      })()}%
                                   </span>
                                </div>
                                <div className="flex justify-between items-center p-5 bg-white/[0.02] rounded-[2rem] border border-white/5">
                                   <span className="label-xs opacity-50">Status</span>
                                   <span className={cn(
                                      "text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border",
                                      (() => {
                                         const w = settings.weight ?? 70;
                                         const h = settings.height ?? 170;
                                         const bmi = w / Math.pow(h / 100, 2);
                                         if (bmi < 18.5) return "border-blue-500/20 text-blue-400 bg-blue-500/5";
                                         if (bmi < 25) return "border-accent/20 text-accent bg-accent/5";
                                         if (bmi < 30) return "border-orange-500/20 text-orange-400 bg-orange-500/5";
                                         return "border-red-500/20 text-red-500 bg-red-500/5";
                                      })()
                                   )}>
                                      {(() => {
                                         const w = settings.weight ?? 70;
                                         const h = settings.height ?? 170;
                                         const bmi = w / Math.pow(h / 100, 2);
                                         if (bmi < 18.5) return "Underweight";
                                         if (bmi < 25) return "Optimized";
                                         if (bmi < 30) return "Elevated";
                                         return "High Risk";
                                      })()}
                                   </span>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Health Performance Analytics */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-dim px-4">Health Performance</h3>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Hydration Analytics */}
                      <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-sm font-bold tracking-tight">Hydration Trend</h4>
                          <Droplet size={14} className="text-accent" />
                        </div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={Array.from({ length: 7 }).map((_, i) => {
                              const d = subDays(today, 6 - i);
                              const dayStr = format(d, 'yyyy-MM-dd');
                              const health = dailyHealth.find(h => h.date === dayStr);
                              return { 
                                name: format(d, 'EEE'), 
                                water: health?.water || 0,
                                goal: settings.waterGoal
                              };
                            })}>
                              <defs>
                                <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} opacity={0.1} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartColors.text }} />
                              <YAxis hide domain={[0, 'auto']} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '8px', fontSize: '10px' }}
                              />
                              <Area type="monotone" dataKey="water" stroke="#3b82f6" fill="url(#waterGradient)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Sleep Analytics */}
                      <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-sm font-bold tracking-tight">Sleep Efficiency</h4>
                          <Moon size={14} className="text-accent" />
                        </div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={Array.from({ length: 7 }).map((_, i) => {
                              const d = subDays(today, 6 - i);
                              const dayStr = format(d, 'yyyy-MM-dd');
                              const health = dailyHealth.find(h => h.date === dayStr);
                              return { 
                                name: format(d, 'EEE'), 
                                hours: health?.sleep || 0,
                                goal: settings.sleepGoal
                              };
                            })}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} opacity={0.1} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartColors.text }} />
                              <YAxis hide domain={[0, 'auto']} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '8px', fontSize: '10px' }}
                              />
                              <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                                {Array.from({ length: 7 }).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill="#a855f7" />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Fasting Analytics */}
                      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 lg:col-span-1">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-sm font-bold tracking-tight">Fasting Consistency</h4>
                          <Zap size={14} className="text-teal-500" />
                        </div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={Array.from({ length: 7 }).map((_, i) => {
                              const d = subDays(today, 6 - i);
                              const dayStr = format(d, 'yyyy-MM-dd');
                              const health = dailyHealth.find(h => h.date === dayStr);
                              
                              let fastingHours = 0;
                              if (health?.fastingStart && health?.fastingEnd) {
                                fastingHours = (new Date(health.fastingEnd).getTime() - new Date(health.fastingStart).getTime()) / (1000 * 60 * 60);
                              } else if (health?.fastingStart && isSameDay(parseISO(dayStr), today)) {
                                fastingHours = (new Date().getTime() - new Date(health.fastingStart).getTime()) / (1000 * 60 * 60);
                              }

                              return { 
                                name: format(d, 'EEE'), 
                                hours: Math.round(fastingHours * 10) / 10
                              };
                            })}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} opacity={0.1} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chartColors.text }} />
                              <YAxis hide domain={[0, 'auto']} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '8px', fontSize: '10px' }}
                              />
                              <Line type="stepAfter" dataKey="hours" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3, fill: '#14b8a6' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Recent Health Records List */}
                      <div className="md:col-span-2 lg:col-span-1 glass-card rounded-3xl p-6 lg:p-8 flex flex-col focus-within:border-accent/40 transition-all">
                        <div className="flex justify-between items-center mb-6">
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-text-dim">Recent Records</h4>
                           <History size={14} className="text-text-dim" />
                        </div>
                        <div className="space-y-4 max-h-[192px] overflow-y-auto pr-2 custom-scrollbar">
                           {dailyHealth.length === 0 ? (
                             <div className="text-center py-8">
                               <p className="text-[10px] font-bold text-text-dim/40 uppercase italic">No records yet</p>
                             </div>
                           ) : (
                             dailyHealth.sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10).map(record => (
                               <div key={record.date} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                                  <div className="flex flex-col">
                                     <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{format(parseISO(record.date), 'MMM d, EEEE')}</span>
                                     <div className="flex gap-3 mt-1 underline-offset-2 decoration-accent/20">
                                        {record.water > 0 && <Droplet size={10} className="text-blue-500" />}
                                        {record.sleep > 0 && <Moon size={10} className="text-purple-500" />}
                                        {(record.fastingStart && record.fastingEnd) && <Zap size={10} className="text-emerald-500" />}
                                     </div>
                                  </div>
                                  <div className="flex gap-4">
                                     {record.water > 0 && (
                                       <div className="flex flex-col items-end">
                                         <span className="text-xs font-black italic">{record.water}</span>
                                         <span className="text-[7px] text-text-dim uppercase font-bold">Units</span>
                                       </div>
                                     )}
                                     {record.sleep > 0 && (
                                       <div className="flex flex-col items-end">
                                         <span className="text-xs font-black italic">{formatDuration(record.sleep)}</span>
                                         <span className="text-[7px] text-text-dim uppercase font-bold">Sleep</span>
                                       </div>
                                     )}
                                  </div>
                               </div>
                             ))
                           )}
                        </div>
                      </div>

                      {/* Gamification Card - Level & XP */}
                      <div className="bg-card border border-accent/30 rounded-2xl p-5 md:p-6 relative overflow-hidden group">
                        <div className="absolute -top-4 -right-4 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all" />
                        
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-sm font-bold tracking-tight">Level Progress</h4>
                          <div className="bg-accent/10 px-2 py-1 rounded text-[10px] font-black text-accent uppercase tracking-widest border border-accent/20">
                            Rank: Novice
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mb-8">
                           <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-black shadow-[0_0_30px_var(--ft-accent)]">
                             <Target size={32} strokeWidth={3} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-text-dim leading-none mb-1">Current Level</p>
                              <h3 className="text-4xl font-mono font-bold leading-none">{userStats.level}</h3>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <div className="flex justify-between items-end">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Experience Points</span>
                              <span className="text-xs font-mono font-bold text-accent">{userStats.xp} / {(userStats.level) * 100}</span>
                           </div>
                           <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${userStats.currentLevelXp}%` }}
                                className="h-full bg-accent"
                              />
                           </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-border/50 grid grid-cols-2 gap-4">
                           <div>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-text-dim mb-1">Consistency</p>
                              <p className="font-mono text-xs font-bold">{userStats.totalConsistentWeeks} Weeks</p>
                           </div>
                           <div>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-text-dim mb-1">Base XP</p>
                              <p className="font-mono text-xs font-bold">{logs.length * 10}</p>
                           </div>
                        </div>
                      </div>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-md p-4">
             <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
                             className="bg-card w-full max-w-md rounded-3xl md:rounded-[2.5rem] overflow-hidden p-6 md:p-8 border border-border shadow-2xl"

            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight">App Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-border rounded-full transition-colors">
                  <X />
                </button>
              </div>

              <div className="space-y-8">
                {/* About Section */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-dim mb-4">About FlexTrack</label>
                  <div className="bg-bg/50 border border-border rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-black shrink-0">
                        <Activity size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">FlexTrack</h3>
                        <p className="text-[10px] font-mono font-bold text-accent uppercase tracking-widest">Version 1.2.0</p>
                      </div>
                    </div>
                    <p className="text-xs text-text-dim leading-relaxed">
                      FlexTrack is your all-in-one fitness companion designed to help you stay consistent, organized, and motivated every day. Plan workouts, create daily fitness checklists, schedule exercise sessions, and track your progress with smart visual insights—all in one place. Whether you're starting your fitness journey or leveling up your routine, FlexTrack helps you build discipline, stay accountable, and achieve real results with a simple and powerful experience.
                    </p>
                    <div className="pt-2 border-t border-border mt-2">
                       <div className="flex items-center gap-2 text-xs text-text-dim font-bold uppercase tracking-tighter">
                          <Info size={12} className="text-accent" />
                          <span>Built for Peak Performance</span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Goal Management */}
                <div className="space-y-6">
                  <label className="label-xs opacity-50">Nutritional Thresholds</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="premium-card p-6 bg-white/[0.02]">
                      <div className="flex items-center gap-2 mb-3">
                        <Droplet size={14} className="text-blue-500" />
                        <span className="label-xs opacity-50">Water Goal</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <input 
                          type="number"
                          value={settings.waterGoal}
                          onChange={(e) => setSettings({ ...settings, waterGoal: Number(e.target.value) })}
                          className="bg-transparent border-b border-white/10 text-3xl font-display font-black w-20 outline-none focus:border-accent text-white uppercase"
                        />
                        <span className="label-xs opacity-30 mt-1">Units</span>
                      </div>
                    </div>
                    <div className="premium-card p-6 bg-white/[0.02]">
                      <div className="flex items-center gap-2 mb-3">
                        <Moon size={14} className="text-purple-500" />
                        <span className="label-xs opacity-50">Sleep Goal</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <input 
                          type="number"
                          value={settings.sleepGoal}
                          onChange={(e) => setSettings({ ...settings, sleepGoal: Number(e.target.value) })}
                          className="bg-transparent border-b border-white/10 text-3xl font-display font-black w-20 outline-none focus:border-accent text-white uppercase"
                        />
                        <span className="label-xs opacity-30 mt-1">Hours</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Management */}
                <div className="space-y-6">
                  <label className="label-xs opacity-50 font-black uppercase tracking-widest text-text-dim">Application Control</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        const data = { templates, logs };
                        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `biometric-backup-${format(new Date(), 'yyyyMMdd')}.json`;
                        a.click();
                      }}
                      className="w-full h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center px-6 gap-4 label-xs font-bold hover:bg-white/[0.08] transition-all"
                    >
                      <Download size={18} />
                      Export Protocol
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
                          setTemplates([]);
                          setLogs([]);
                          localStorage.clear();
                          window.location.reload();
                        }
                      }}
                      className="w-full h-16 rounded-2xl bg-white/[0.03] border border-red-500/10 flex items-center px-6 gap-4 label-xs font-bold text-red-500 hover:bg-red-500/5 transition-all"
                    >
                      <RotateCcw size={18} />
                      Reset Protocol
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EXISTING MODALS --- */}
      
      {/* Add Template Modal */}
      <AnimatePresence>
        {showAddTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="premium-card w-full max-w-2xl overflow-hidden p-6 md:p-12 relative"
            >
              <div className="flex justify-between items-start mb-12">
                <div>
                  <span className="label-xs text-accent opacity-80 mb-2 block">Protocol Designer</span>
                  <h2 className="text-3xl md:text-5xl font-display font-black tracking-tight text-white mt-1">
                    {creationBatch.length > 1 ? 'Batch Creation' : 'Entry Protocol'}
                  </h2>
                </div>
                <button onClick={() => {
                  setShowAddTemplate(false);
                  setCreationBatch([{ tempId: Math.random().toString(36), name: '', metrics: [] }]);
                  setBatchScheduledDays([]);
                }} className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
                  <X />
                </button>
              </div>

              <div className="space-y-10 max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
                {/* Global Schedule */}
                <div className="p-8 bg-white/[0.02] rounded-[2.5rem] border border-white/5">
                  <label className="label-xs opacity-30 mb-6 block tracking-[0.3em]">Deployment Schedule</label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <label key={day} className="cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={batchScheduledDays.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) setBatchScheduledDays(prev => [...prev, day]);
                            else setBatchScheduledDays(prev => prev.filter(d => d !== day));
                          }}
                          className="sr-only peer" 
                        />
                        <span className="w-full py-4 rounded-2xl border border-white/5 label-xs opacity-40 peer-checked:bg-accent peer-checked:text-black peer-checked:border-accent peer-checked:font-black peer-checked:opacity-100 transition-all block text-center">
                          {day.slice(0, 1)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Batch Items */}
                <div className="space-y-6">
                  {creationBatch.map((item, index) => (
                    <motion.div 
                      layout
                      key={item.tempId}
                      className="p-5 md:p-8 bg-card border border-border rounded-3xl md:rounded-[2.5rem] relative group"
                    >
                      {creationBatch.length > 1 && (
                        <button 
                          onClick={() => setCreationBatch(prev => prev.filter(i => i.tempId !== item.tempId))}
                          className="absolute top-6 right-6 p-2 text-text-dim hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}

                      <div className="mb-6">
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim mb-3 font-mono">Exercise Name #{index + 1}</label>
                        <input 
                          value={item.name}
                          onChange={(e) => {
                            const newBatch = [...creationBatch];
                            newBatch[index].name = e.target.value;
                            setCreationBatch(newBatch);
                          }}
                          placeholder="e.g., Bench Press"
                          className={cn(
                            "w-full text-2xl font-bold bg-transparent border-b pb-4 focus:border-accent outline-none transition-all placeholder:text-border/50",
                            item.name.trim() ? "border-border" : "border-red-500/50"
                          )} 
                        />
                        {!item.name.trim() && (
                          <span className="text-[8px] font-bold uppercase text-red-500 mt-2 block tracking-widest">Name required to add to library</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim mb-4 font-mono">Metrics Configuration</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {['reps', 'sets', 'weight', 'duration'].map(metricType => {
                            const activeMetric = item.metrics.find(m => m.type === metricType);
                            return (
                              <div key={metricType} className="space-y-3">
                                <label className="cursor-pointer group block">
                                  <input 
                                    type="checkbox" 
                                    checked={!!activeMetric}
                                    onChange={(e) => {
                                      const newBatch = [...creationBatch];
                                      if (e.target.checked) {
                                        newBatch[index].metrics.push({ 
                                          type: metricType as any, 
                                          label: metricType.charAt(0).toUpperCase() + metricType.slice(1), 
                                          targetValue: undefined 
                                        });
                                      } else {
                                        newBatch[index].metrics = newBatch[index].metrics.filter(m => m.type !== metricType);
                                      }
                                      setCreationBatch(newBatch);
                                    }}
                                    className="sr-only peer" 
                                  />
                                  <div className="p-4 rounded-2xl border border-border flex items-center justify-between peer-checked:border-accent peer-checked:bg-accent/5 transition-all">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-4 h-4 rounded-full border-2 border-border transition-all flex items-center justify-center",
                                        activeMetric && "bg-accent border-accent"
                                      )}>
                                        <div className={cn("w-1.5 h-1.5 bg-black rounded-full transition-opacity", activeMetric ? "opacity-100" : "opacity-0")} />
                                      </div>
                                      <span className="text-[10px] font-bold uppercase tracking-widest">{metricType}</span>
                                    </div>
                                    
                                    {activeMetric && (
                                      <input 
                                        type="number"
                                        placeholder="Target"
                                        value={activeMetric.targetValue || ''}
                                        onChange={(e) => {
                                          const newBatch = [...creationBatch];
                                          const m = newBatch[index].metrics.find(mt => mt.type === metricType);
                                          if (m) m.targetValue = Number(e.target.value) || undefined;
                                          setCreationBatch(newBatch);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-bg border border-border rounded-lg px-2 py-1 text-[10px] font-mono outline-none focus:border-accent w-16 text-center"
                                      />
                                    )}
                                  </div>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  <button 
                    onClick={() => setCreationBatch(prev => [...prev, { tempId: Math.random().toString(36), name: '', metrics: [] }])}
                    className="w-full py-6 border-2 border-dashed border-border rounded-[2.5rem] text-text-dim hover:text-accent hover:border-accent transition-all flex items-center justify-center gap-2 group"
                  >
                    <Plus size={20} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Add Exercise to Batch</span>
                  </button>
                </div>

                <div className="pt-4 pb-2">
                  <button 
                    onClick={() => {
                      const validItems = creationBatch.filter(i => i.name.trim() && i.metrics.length > 0);
                      
                      if (validItems.length === 0) {
                        alert('Please ensure at least one exercise has a name and metrics.');
                        return;
                      }
                      
                      validItems.forEach(item => {
                        addTemplate({ 
                          name: item.name, 
                          metrics: item.metrics, 
                          scheduledDays: batchScheduledDays 
                        });
                      });

                      setShowAddTemplate(false);
                      setCreationBatch([{ tempId: Math.random().toString(36), name: '', metrics: [] }]);
                      setBatchScheduledDays([]);
                    }}
                    className="w-full bg-accent text-black py-6 rounded-[2rem] font-bold text-xl tracking-tight hover:brightness-110 shadow-xl transition-all active:scale-[0.98]"
                  >
                    Confirm {creationBatch.filter(i => i.name.trim() && i.metrics.length > 0).length} {creationBatch.filter(i => i.name.trim() && i.metrics.length > 0).length === 1 ? 'Exercise' : 'Exercises'}
                  </button>
                  {creationBatch.length > creationBatch.filter(i => i.name.trim() && i.metrics.length > 0).length && (
                    <p className="text-[8px] text-center text-text-dim mt-4 uppercase font-bold tracking-widest">
                      Note: Empty exercises will be ignored.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Exercise Modal */}
      <AnimatePresence>
        {showLogModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card w-full max-w-lg rounded-3xl md:rounded-[2.5rem] overflow-hidden p-6 md:p-10 border border-border shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6 md:mb-10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent font-mono">Logging Activity</span>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">{showLogModal.template.name}</h2>
                </div>
                <button onClick={() => setShowLogModal(null)} className="p-2 hover:bg-border rounded-full transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const results: MetricValue[] = showLogModal.template.metrics.map(m => ({
                  type: m.type,
                  value: Number(formData.get(m.type)) || 0
                }));
                logExercise(showLogModal.template.id, results, showLogModal.date);
              }} className="space-y-6 md:space-y-10">
                {showLogModal.template.metrics.map(metric => (
                  <div key={metric.type}>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim mb-2 md:mb-4 font-mono">{metric.label}</label>
                    <div className="flex items-baseline gap-4 border-b border-border pb-2 focus-within:border-accent transition-all">
                      <input 
                        name={metric.type} 
                        type="number" 
                        required 
                        autoFocus
                        placeholder="0"
                        className="w-full text-4xl md:text-6xl font-mono font-bold bg-transparent outline-none placeholder:text-border" 
                      />
                    </div>
                  </div>
                ))}

                <button 
                  type="submit"
                  className="w-full bg-accent text-black py-6 rounded-2xl font-bold text-lg tracking-tight hover:brightness-110 shadow-xl transition-all"
                >
                  Complete Activity
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
