'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import { listPersonaOptions, type PersonaOption } from '@/app/actions/runs';
import { Loader2, User } from 'lucide-react';

// ─── Badge helpers ────────────────────────────────────────────────────────────

function Badge({
  label,
  colorClass,
}: {
  label: string;
  colorClass: string;
}) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function ageBandColor(band: string) {
  switch (band) {
    case '18-34': return 'bg-violet-50 text-violet-700';
    case '35-54': return 'bg-blue-50 text-blue-700';
    case '55-74': return 'bg-amber-50 text-amber-700';
    case '75+':   return 'bg-orange-50 text-orange-700';
    default:      return 'bg-zinc-100 text-zinc-600';
  }
}

function deviceClassColor(dc: string) {
  switch (dc) {
    case 'desktop':  return 'bg-sky-50 text-sky-700';
    case 'mobile':   return 'bg-emerald-50 text-emerald-700';
    case 'tablet':   return 'bg-teal-50 text-teal-700';
    default:         return 'bg-zinc-100 text-zinc-600';
  }
}

// ─── Persona card ─────────────────────────────────────────────────────────────

function PersonaCard({ persona }: { persona: PersonaOption }) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-5 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
          <User className="w-5 h-5 text-zinc-500" />
        </div>
        <div>
          <h3 className="font-semibold text-zinc-900 text-base leading-tight">{persona.display_name}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">ID: {persona.id}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge label={persona.age_band} colorClass={ageBandColor(persona.age_band)} />
        <Badge label={persona.device_class} colorClass={deviceClassColor(persona.device_class)} />
        {persona.assistive_tech && persona.assistive_tech !== 'none' && (
          <Badge label={persona.assistive_tech} colorClass="bg-purple-50 text-purple-700" />
        )}
        {persona.motor_profile && persona.motor_profile !== 'normal' && (
          <Badge label={persona.motor_profile} colorClass="bg-rose-50 text-rose-700" />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await listPersonaOptions();
        if (result.success && result.personas) {
          setPersonas(result.personas);
        } else {
          setError(result.error ?? 'Failed to load personas');
        }
      } catch {
        setError('An error occurred while loading personas');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Personas</h1>
            <p className="text-sm text-zinc-500 mt-1">Read-only seeded v1 persona library</p>
          </div>
          {!loading && !error && (
            <span className="text-sm text-zinc-500">{personas.length} persona{personas.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading personas…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">{error}</div>
        ) : personas.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-12 text-center">
            <User className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-zinc-700 mb-1">No personas found</h2>
            <p className="text-sm text-zinc-500">Ensure the v1 persona seed has been applied to the database.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {personas.map(persona => (
              <PersonaCard key={persona.id} persona={persona} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
