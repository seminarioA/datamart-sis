import { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const STEPS = [
  {
    element: '[data-tour="kpi"]',
    popover: {
      title: 'Indicadores clave (KPIs)',
      description: 'Haz clic en cualquier KPI para ver su definición y evolución histórica completa.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Módulos de análisis',
      description: '10 módulos: Resumen, Cobertura, Perfil del Asegurado, Red Prestacional, Prestaciones, Evolución, Proyecciones, Arquetipos, Intervenciones y Conciliación.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="filters"]',
    popover: {
      title: 'Filtros dinámicos',
      description: 'Filtra por año, región, sexo, grupo etario o tipo de servicio. Todos los módulos responden en tiempo real.',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="pdf"]',
    popover: {
      title: 'Exportar informe PDF',
      description: 'Genera un informe ejecutivo completo compilado con LaTeX directamente en el servidor VPS.',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="content"]',
    popover: {
      title: '¡Listo para explorar!',
      description: 'Mapa coroplético, gráficos de tendencia, demografía, proyecciones y más. Navega por los módulos y explora los 629 M de atenciones SIS.',
      side: 'top', align: 'start',
    },
  },
]

export default function Onboarding({ onClose }) {
  useEffect(() => {
    const driverObj = driver({
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Comenzar',
      overlayOpacity: 0.55,
      smoothScroll: true,
      allowClose: true,
      onDestroyed: onClose,
      popoverClass: 'sis-popover',
      steps: STEPS,
    })

    // Pequeño delay para que el DOM esté listo
    const t = setTimeout(() => driverObj.drive(), 300)
    return () => { clearTimeout(t); try { driverObj.destroy() } catch {} }
  }, [])

  return null
}
