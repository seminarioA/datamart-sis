import React from 'react'
import { ExternalLink, Database, Server, Code2, BarChart3, Users } from 'lucide-react'

const STACK = [
  { icon: Database,  label:'PostgreSQL 16',      desc:'DataMart dimensional (star schema)' },
  { icon: Code2,     label:'Python + FastAPI',    desc:'ELT en batches + API REST con cache 3 capas' },
  { icon: BarChart3, label:'Apache Airflow 2.9',  desc:'Orquestación de DAGs (ELT + refresh MVs)' },
  { icon: Code2,     label:'React 18 + Vite',     desc:'Frontend SPA con ApexCharts y Leaflet' },
  { icon: Server,    label:'Oracle Cloud VPS',    desc:'Ubuntu 24.04 — 1GB RAM, 50GB SSD (Always Free)' },
  { icon: Server,    label:'Cloudflare Tunnel',   desc:'Acceso público sin puertos expuestos' },
]

const AUTHORS = [
  { name:'Alejandro Seminario Medina',  code:'U22247454' },
  { name:'Sigidiego Ortega Vilela',     code:'U22323434' },
  { name:'Sergio Mena Delgado',         code:'U22323434' },
]

export default function Acerca({ dark }) {
  const card = {
    background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:4, padding:'16px 20px', marginBottom:8,
  }
  const h2 = {
    fontSize:10, fontWeight:700, fontFamily:"'Montserrat',sans-serif",
    textTransform:'uppercase', letterSpacing:'.08em',
    color:'var(--navy)', marginBottom:12, borderLeft:'3px solid var(--navy)',
    paddingLeft:8,
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'12px 20px 24px', display:'flex', flexDirection:'column', gap:8 }}>

      {/* Proyecto */}
      <div style={card}>
        <div style={h2}>Sobre el proyecto</div>
        <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.7, margin:0 }}>
          DataMart SIS es un sistema de inteligencia de negocios construido sobre datos abiertos del
          <strong> Seguro Integral de Salud (SIS)</strong> del Ministerio de Salud del Perú.
          Procesa más de <strong>14 millones de registros</strong> de atenciones de salud (2017–2025)
          y los presenta en un dashboard interactivo con análisis predictivo.
        </p>
        <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
          <a href="https://github.com/seminarioA/datamart-sis" target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--navy)', textDecoration:'none', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'6px 12px', fontWeight:600 }}>
            ↗ Ver en GitHub
          </a>
          <a href="https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis" target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--navy)', textDecoration:'none', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'6px 12px', fontWeight:600 }}>
            <Database size={14} /> Datos Abiertos MINSA
          </a>
        </div>
      </div>

      {/* Autores */}
      <div style={card}>
        <div style={h2}>Autores</div>
        <div style={{ display:'grid', gap:10 }}>
          {AUTHORS.map(a => (
            <div key={a.name} style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--navy)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Users size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{a.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>Código: {a.code}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:6, fontSize:12, color:'var(--muted)', background:'var(--bg)', padding:'8px 12px', borderRadius:4 }}>
            <strong style={{ color:'var(--text)' }}>Docente:</strong> Balcazar Chumacero, Oscar Eduardo<br/>
            <strong style={{ color:'var(--text)' }}>Curso:</strong> Inteligencia de Negocios<br/>
            <strong style={{ color:'var(--text)' }}>Universidad:</strong>{' '}
            <a href="https://utp.edu.pe" target="_blank" rel="noopener noreferrer" style={{ color:'var(--navy)' }}>
              Universidad Tecnológica del Perú (UTP)
            </a><br/>
            <strong style={{ color:'var(--text)' }}>Período:</strong> 2025 – 2026
          </div>
        </div>
      </div>

      {/* Stack tecnológico */}
      <div style={card}>
        <div style={h2}>Stack tecnológico</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {STACK.map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} style={{ display:'flex', gap:10, alignItems:'flex-start', background:'var(--bg)', borderRadius:4, padding:'10px 12px' }}>
                <Icon size={16} style={{ color:'var(--navy)', flexShrink:0, marginTop:1 }} />
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize:10, color:'var(--muted)', marginTop:2, lineHeight:1.4 }}>{s.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fuente */}
      <div style={card}>
        <div style={h2}>Fuente de datos</div>
        <div style={{ display:'grid', gap:6 }}>
          {[
            ['Entidad','Seguro Integral de Salud (SIS) — MINSA'],
            ['Licencia','Open Data Commons Attribution License (ODC-By)'],
            ['Cobertura','2017 – 2025 (archivos anuales/semestrales)'],
            ['Formato','CSV comprimido en ZIP'],
          ].map(([k,v])=>(
            <div key={k} style={{ display:'flex', gap:8, fontSize:12 }}>
              <span style={{ color:'var(--muted)', flexShrink:0, width:80 }}>{k}:</span>
              <span style={{ color:'var(--text)' }}>{v}</span>
            </div>
          ))}
          <a href="https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis"
            target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--navy)', marginTop:4 }}>
            <ExternalLink size={12} /> Portal Nacional de Datos Abiertos
          </a>
        </div>
      </div>
    </div>
  )
}
