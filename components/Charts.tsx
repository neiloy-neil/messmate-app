'use client'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { MemberSummary, fmt } from '@/lib/calculations'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const COLORS = ['#6366f1','#14b8a6','#f97316','#eab308','#ef4444','#8b5cf6','#22c55e','#ec4899']

export function MealChart({ summaries }: { summaries: MemberSummary[] }) {
  const data = {
    labels: summaries.map(s => s.member.name),
    datasets: [{
      data: summaries.map(s => s.meals),
      backgroundColor: COLORS.slice(0, summaries.length),
      borderWidth: 0, hoverBorderWidth: 2, hoverBorderColor: '#fff',
    }],
  }
  return (
    <Doughnut
      data={data}
      options={{
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#8b949e', font: { family: 'Inter', size: 12 }, padding: 12, boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${c.raw} meals` } },
        },
      }}
    />
  )
}

export function BalanceChart({ summaries }: { summaries: MemberSummary[] }) {
  const data = {
    labels: summaries.map(s => s.member.name),
    datasets: [{
      label: 'Balance (৳)',
      data: summaries.map(s => s.balance),
      backgroundColor: summaries.map(s => s.balance >= 0 ? 'rgba(34,197,94,0.65)' : 'rgba(239,68,68,0.65)'),
      borderColor: summaries.map(s => s.balance >= 0 ? '#22c55e' : '#ef4444'),
      borderWidth: 1, borderRadius: 6,
    }],
  }
  return (
    <Bar
      data={data}
      options={{
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `Balance: ${Number(c.raw) >= 0 ? '+' : ''}${fmt(Number(c.raw))}` } },
        },
        scales: {
          x: { ticks: { color: '#8b949e', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#8b949e', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      }}
    />
  )
}
