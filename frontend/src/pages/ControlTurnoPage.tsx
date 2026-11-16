import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  LayoutDashboard,
  MessageCircle,
  MoonStar,
  RefreshCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/Button';
import { cn } from '../utils/helpers';

type Assignment = 'icebreakers' | 'new-feed';

type ShiftState = {
  completed: string[];
  assignment: Assignment;
};

type ShiftTask = {
  id: string;
  title: string;
  description: string;
  deadline?: string;
  windowLabel?: string;
  priority?: boolean;
  icon: typeof Send;
  accent: string;
};

const STORAGE_PREFIX = 'control-turno-diario-v1';

const TASKS: ShiftTask[] = [
  {
    id: 'saludos',
    title: 'Enviar saludos',
    description: 'Usa refrescamientos humanos, variados y adaptados a cada conversación.',
    icon: MessageCircle,
    accent: 'text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/60',
  },
  {
    id: 'insistencias',
    title: 'Enviar insistencias',
    description: 'Retoma contactos activos con mensajes naturales, sin reclamar ni presionar.',
    deadline: '01:00',
    priority: true,
    icon: Flame,
    accent: 'text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/60',
  },
  {
    id: 'capture',
    title: 'Mandar el capture',
    description: 'Envía la evidencia del turno y comprueba que haya quedado registrada.',
    deadline: '05:00',
    priority: true,
    icon: Camera,
    accent: 'text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60',
  },
  {
    id: 'barrido-cartas',
    title: 'Sacar el barrido de cartas',
    description: 'Realiza el barrido después de enviar el capture y déjalo terminado antes de las 6:00 a. m.',
    deadline: '06:00',
    windowLabel: 'De 05:00 a 06:00',
    priority: true,
    icon: Send,
    accent: 'text-fuchsia-600 bg-fuchsia-100 dark:text-fuchsia-300 dark:bg-fuchsia-950/60',
  },
  {
    id: 'new-feeds',
    title: 'Enviar New Feeds',
    description: 'Completa las 3 fotos, pies de foto, respuestas rápidas, saludo e insistencias.',
    icon: LayoutDashboard,
    accent: 'text-cyan-600 bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-950/60',
  },
  {
    id: 'asignacion',
    title: 'Completar la asignación del día',
    description: 'Realiza Icebreakers o New Feed según lo indicado para el turno.',
    icon: Sparkles,
    accent: 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-950/60',
  },
];

function shiftDate(date = new Date()) {
  const result = new Date(date);
  if (result.getHours() < 12) result.setDate(result.getDate() - 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatToday(date: Date) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function deadlineState(deadline: string | undefined, completed: boolean, turnDate: Date) {
  if (!deadline || completed) return null;
  const [hours, minutes] = deadline.split(':').map(Number);
  const limit = new Date(turnDate);
  limit.setDate(limit.getDate() + 1);
  limit.setHours(hours, minutes, 0, 0);
  return new Date() > limit ? 'late' : 'pending';
}

export function ControlTurnoPage() {
  const turnDate = shiftDate();
  const dateKey = localDateKey(turnDate);
  const storageKey = `${STORAGE_PREFIX}:${dateKey}`;
  const [state, setState] = useState<ShiftState>({ completed: [], assignment: 'icebreakers' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setState(JSON.parse(stored));
    } catch {
      setState({ completed: [], assignment: 'icebreakers' });
    } finally {
      setReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(state));
  }, [ready, state, storageKey]);

  const completedCount = state.completed.length;
  const progress = Math.round((completedCount / TASKS.length) * 100);
  const allDone = completedCount === TASKS.length;
  const nextTask = useMemo(() => TASKS.find((task) => !state.completed.includes(task.id)), [state.completed]);

  const toggleTask = (id: string) => {
    setState((current) => ({
      ...current,
      completed: current.completed.includes(id)
        ? current.completed.filter((taskId) => taskId !== id)
        : [...current.completed, id],
    }));
  };

  const resetDay = () => setState((current) => ({ ...current, completed: [] }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1fr_280px] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">
              <MoonStar className="h-4 w-4" /> Rutina nocturna diaria
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Control de Turno</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-indigo-100 sm:text-base">
              Sigue el orden, cumple los horarios importantes y termina cada turno con todo bajo control.
            </p>
            <p className="mt-4 capitalize text-sm font-medium text-white/70">Turno del {formatToday(turnDate)}</p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-indigo-100">Progreso del turno</span>
              <span className="text-2xl font-black">{progress}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs text-indigo-100">{completedCount} de {TASKS.length} tareas completadas</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm dark:border-rose-950 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-rose-100 p-2.5 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"><Flame className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold uppercase tracking-wider text-rose-500">Prioridad</p><p className="font-bold text-gray-900 dark:text-white">Insistencias antes de la 1:00 a. m.</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm dark:border-amber-950 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-amber-100 p-2.5 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300"><Camera className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold uppercase tracking-wider text-amber-500">Límite</p><p className="font-bold text-gray-900 dark:text-white">Capture antes de las 5:00 a. m.</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-950 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Objetivo diario</p><p className="font-bold text-gray-900 dark:text-white">Completar el 100% del turno</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-fuchsia-100 bg-white p-5 shadow-sm dark:border-fuchsia-950 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-fuchsia-100 p-2.5 text-fuchsia-600 dark:bg-fuchsia-950/60 dark:text-fuchsia-300"><Send className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-500">Después del capture</p><p className="font-bold text-gray-900 dark:text-white">Barrido de 5:00 a 6:00 a. m.</p></div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Checklist del día</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Marca cada tarea justo después de completarla.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={resetDay} disabled={completedCount === 0}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Reiniciar
            </Button>
          </div>

          <div className="space-y-3">
            {TASKS.map((task, index) => {
              const done = state.completed.includes(task.id);
              const status = deadlineState(task.deadline, done, turnDate);
              const Icon = task.icon;
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    'group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all sm:p-5',
                    done
                      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20'
                      : 'border-gray-100 bg-gray-50/60 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:shadow-md dark:border-gray-800 dark:bg-gray-950/40 dark:hover:border-indigo-800 dark:hover:bg-gray-900'
                  )}
                >
                  <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors', done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white text-transparent dark:border-gray-600 dark:bg-gray-800')}>
                    <Check className="h-4 w-4" />
                  </span>
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', task.accent)}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn('font-bold', done ? 'text-emerald-800 line-through dark:text-emerald-300' : 'text-gray-900 dark:text-white')}>{index + 1}. {task.title}</span>
                      {task.priority && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">Importante</span>}
                      {task.deadline && (
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', status === 'late' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300')}>
                          {status === 'late' ? <AlertTriangle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />} {task.windowLabel || `Antes de ${task.deadline}`}
                        </span>
                      )}
                    </span>
                    <span className={cn('mt-1 block text-sm leading-relaxed', done ? 'text-emerald-700/70 dark:text-emerald-400/70' : 'text-gray-500 dark:text-gray-400')}>{task.description}</span>
                  </span>
                  <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-1 dark:text-gray-600" />
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-5 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-gray-900">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-indigo-600 p-2.5 text-white"><Sparkles className="h-5 w-5" /></span>
              <div><h2 className="font-black text-gray-900 dark:text-white">Asignación del día</h2><p className="text-xs text-gray-500 dark:text-gray-400">Elige lo que corresponde hoy</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1.5 shadow-inner dark:bg-gray-950">
              <button onClick={() => setState((current) => ({ ...current, assignment: 'icebreakers' }))} className={cn('rounded-lg px-3 py-2.5 text-xs font-bold transition-all', state.assignment === 'icebreakers' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800')}>Icebreakers</button>
              <button onClick={() => setState((current) => ({ ...current, assignment: 'new-feed' }))} className={cn('rounded-lg px-3 py-2.5 text-xs font-bold transition-all', state.assignment === 'new-feed' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800')}>New Feed</button>
            </div>
            <div className="mt-4 rounded-xl border border-indigo-100 bg-white/80 p-4 text-sm text-gray-600 dark:border-indigo-900/60 dark:bg-gray-950/60 dark:text-gray-300">
              Hoy corresponde completar <strong className="text-indigo-700 dark:text-indigo-300">{state.assignment === 'icebreakers' ? 'el Plan de Trabajo con Icebreakers' : 'el contenido de New Feed'}</strong>.
            </div>
          </div>

          <div className={cn('rounded-3xl border p-5 shadow-sm', allDone ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900')}>
            {allDone ? (
              <><CheckCircle2 className="h-9 w-9 text-emerald-500" /><h3 className="mt-3 text-lg font-black text-emerald-800 dark:text-emerald-300">Turno completado</h3><p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-400/80">Todo quedó listo por hoy. Buen trabajo.</p></>
            ) : (
              <><Send className="h-8 w-8 text-indigo-500" /><p className="mt-3 text-xs font-bold uppercase tracking-wider text-gray-400">Siguiente tarea</p><h3 className="mt-1 font-black text-gray-900 dark:text-white">{nextTask?.title}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sigue el orden para que nada importante se quede pendiente.</p></>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
