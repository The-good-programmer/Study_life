/** Shared subject-folder styling options (kept out of the modal so Fast Refresh works). */

export const FOLDER_COLORS: { id: string; name: string; bg: string; border: string; text: string; dot: string; glow: string }[] = [
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40', text: 'text-indigo-300', dot: 'bg-indigo-500', glow: 'shadow-indigo-500/20' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-300', dot: 'bg-purple-500', glow: 'shadow-purple-500/20' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-500', glow: 'shadow-emerald-500/20' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-500', glow: 'shadow-amber-500/20' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-500/15', border: 'border-rose-500/40', text: 'text-rose-300', dot: 'bg-rose-500', glow: 'shadow-rose-500/20' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40', text: 'text-cyan-300', dot: 'bg-cyan-500', glow: 'shadow-cyan-500/20' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-300', dot: 'bg-blue-500', glow: 'shadow-blue-500/20' },
];

export const FOLDER_ICONS = [
  '📚', '🧠', '🧬', '⚛️', '🧪', '📐', '💻', '🩺', '🎨', '⚖️', '🏛️', '🌍', '📈', '🚀', '📝', '⚡'
];

export const SUBJECT_PRESETS = [
  'Biology', 'Neuroscience', 'Calculus', 'Computer Science', 'Organic Chemistry', 
  'Physics', 'World History', 'Microeconomics', 'Psychology', 'Literature'
];
