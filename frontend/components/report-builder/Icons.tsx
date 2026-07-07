'use client'

// Central icon registry for the report builder. Agent roles and AI actions
// reference icons by string name (see lib/report-builder/{agentMeta,aiActions});
// this module resolves those names to real lucide-react components so any
// surface can do <Icon name="Brain" /> without importing every icon.

import {
  Brain, Search, Calculator, BarChart3, PenLine, Lightbulb, ShieldCheck, Sparkles,
  Wand2, Maximize2, Minimize2, AlignLeft, RefreshCw, Languages, HelpCircle, GitCompare,
  PieChart, PlusCircle, Quote, Link2, LayoutTemplate,
  FileText, FilePlus, BookOpen,
  type LucideIcon,
} from 'lucide-react'

const REGISTRY: Record<string, LucideIcon> = {
  // Agents
  Brain, Search, Calculator, BarChart3, PenLine, Lightbulb, ShieldCheck, Sparkles,
  // AI actions
  Wand2, Maximize2, Minimize2, AlignLeft, RefreshCw, Languages, HelpCircle, GitCompare,
  PieChart, PlusCircle, Quote, Link2, LayoutTemplate,
  // Templates
  FileText, FilePlus, BookOpen,
}

export interface IconProps {
  name: string
  className?: string
}

export function Icon({ name, className }: IconProps) {
  const Cmp = REGISTRY[name] ?? Sparkles
  return <Cmp className={className} />
}

export { REGISTRY as ICONS }
