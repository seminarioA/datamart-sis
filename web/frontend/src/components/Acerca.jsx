import React from 'react'
import { ExternalLink, Database, Users } from 'lucide-react'
import {
  Postgresql, Python, Fastapi, ApacheAirflow,
  React as ReactIcon, Vitejs, Oracle, Cloudflare,
} from '@thesvg/react'

const STACK = [
  { icon: Postgresql,   label:'PostgreSQL 16',      desc:'DataMart dimensional (star schema)' },
  { icon: Python,       label:'Python + FastAPI',    desc:'ELT en batches + API REST con cache 3 capas',
    icon2: Fastapi },
  { icon: ApacheAirflow,label:'Apache Airflow 2.9',  desc:'Orquestación de DAGs (ELT + refresh MVs)' },
  { icon: ReactIcon,    label:'React 18 + Vite',     desc:'Frontend SPA con ApexCharts y Leaflet',
    icon2: Vitejs },
  { icon: Oracle,       label:'Oracle Cloud VPS',    desc:'Ubuntu 24.04 — 1GB RAM, 50GB SSD (Always Free)' },
  { icon: Cloudflare,   label:'Cloudflare Tunnel',   desc:'Acceso público sin puertos expuestos' },
]

const AUTHORS = [
  { name:'Alejandro Seminario Medina',  code:'U22247454', linkedin:'https://www.linkedin.com/in/alejandroseminariomedina/' },
  { name:'Sigidiego Ortega Vilela',     code:'U22323434', linkedin:'https://www.linkedin.com/in/sigidiego-ortega-vilela-58784338b/' },
  { name:'Sergio Mena Delgado',         code:'U22323434', linkedin:'https://www.linkedin.com/in/sergio-delgado-mena-358087287/' },
]

function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-bold font-heading uppercase tracking-[.07em] text-primary mb-3">
      {children}
    </p>
  )
}

export default function Acerca() {
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3 flex flex-col gap-3 min-h-0">

      <div className="island p-5">
        <SectionTitle>Sobre el proyecto</SectionTitle>
        <p className="text-[13px] text-foreground leading-relaxed">
          DataMart SIS es un sistema de inteligencia de negocios construido sobre datos abiertos del{' '}
          <strong>Seguro Integral de Salud (SIS)</strong> del Ministerio de Salud del Perú.
          Procesa más de <strong>14 millones de registros</strong> de atenciones de salud (2017–2025)
          y los presenta en un dashboard interactivo con análisis predictivo.
        </p>
        <div className="flex gap-2 mt-4 flex-wrap">
          <a href="https://github.com/seminarioA/datamart-sis" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-primary font-semibold no-underline border border-border/60 rounded-lg px-3 py-1.5 bg-muted/30 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">
            ↗ Ver en GitHub
          </a>
          <a href="https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-primary font-semibold no-underline border border-border/60 rounded-lg px-3 py-1.5 bg-muted/30 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">
            <Database size={13} /> Datos Abiertos MINSA
          </a>
        </div>
      </div>

      <div className="island p-5">
        <SectionTitle>Autores</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {AUTHORS.map(a => (
            <div key={a.name}
                 className="flex flex-col items-center text-center gap-2 bg-muted/30 rounded-xl p-4 border border-border/40">
              <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shrink-0"
                   style={{ boxShadow: '0 2px 8px hsl(var(--primary) / .25)' }}>
                <Users size={18} className="text-primary-foreground" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-foreground leading-snug">{a.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Código: {a.code}</div>
              </div>
              {a.linkedin && (
                <a href={a.linkedin} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 text-[11px] text-white font-semibold no-underline rounded px-3 py-1 mt-auto transition-opacity hover:opacity-85"
                   style={{ background: '#0077b5' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </a>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-[12px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5 border border-border/40 leading-relaxed">
          <strong className="text-foreground">Docente:</strong> Balcazar Chumacero, Oscar Eduardo<br/>
          <strong className="text-foreground">Curso:</strong> Inteligencia de Negocios<br/>
          <strong className="text-foreground">Universidad:</strong>{' '}
          <a href="https://utp.edu.pe" target="_blank" rel="noopener noreferrer"
             className="text-primary hover:underline">
            Universidad Tecnológica del Perú (UTP)
          </a><br/>
          <strong className="text-foreground">Período:</strong> 2026
        </div>
      </div>

      <div className="island p-5">
        <SectionTitle>Stack tecnológico</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {STACK.map(s => {
            const Icon  = s.icon
            const Icon2 = s.icon2
            return (
              <div key={s.label}
                   className="flex gap-2.5 items-center bg-muted/30 rounded-lg px-3 py-2.5 border border-border/40">
                <div className="flex items-center gap-1 shrink-0">
                  <Icon width={18} height={18} className="text-foreground" />
                  {Icon2 && <Icon2 width={16} height={16} className="text-foreground opacity-70" />}
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-foreground">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{s.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="island p-5">
        <SectionTitle>Fuente de datos</SectionTitle>
        <div className="flex flex-col gap-2">
          {[
            ['Entidad',   'Seguro Integral de Salud (SIS) — MINSA'],
            ['Licencia',  'Open Data Commons Attribution License (ODC-By)'],
            ['Cobertura', '2017 – 2025 (archivos anuales/semestrales)'],
            ['Formato',   'CSV comprimido en ZIP'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[12px]">
              <span className="text-muted-foreground shrink-0 w-20">{k}:</span>
              <span className="text-foreground">{v}</span>
            </div>
          ))}
          <a href="https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis"
             target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 text-[12px] text-primary mt-1 hover:underline">
            <ExternalLink size={12} /> Portal Nacional de Datos Abiertos
          </a>
        </div>
      </div>

    </div>
  )
}
