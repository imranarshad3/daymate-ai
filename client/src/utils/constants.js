import {
  User, Briefcase, Phone, Heart, BookOpen, ShoppingCart, House, Wallet, Sparkle,
  Drop, Barbell, Moon, Sun, Leaf, Brain, HandsPraying, PersonSimpleRun, Code, Money, Coffee, Lightbulb, Plant, Star,
} from '@phosphor-icons/react';

export const CATEGORIES = [
  { id: 'personal', label: 'Personal', Icon: User, color: '#a5b4fc' },
  { id: 'work', label: 'Work', Icon: Briefcase, color: '#60a5fa' },
  { id: 'call', label: 'Call', Icon: Phone, color: '#5eead4' },
  { id: 'health', label: 'Health', Icon: Heart, color: '#fda4af' },
  { id: 'study', label: 'Study', Icon: BookOpen, color: '#c4b5fd' },
  { id: 'shopping', label: 'Shopping', Icon: ShoppingCart, color: '#fcd34d' },
  { id: 'family', label: 'Family', Icon: House, color: '#7dd3fc' },
  { id: 'finance', label: 'Finance', Icon: Wallet, color: '#86efac' },
  { id: 'other', label: 'Other', Icon: Sparkle, color: '#94a3b8' },
];

export const catOf = (id) => CATEGORIES.find((c) => c.id === id) || { id, label: id, Icon: Sparkle, color: '#a3acbb' };

export const HABIT_ICONS = {
  sparkle: Sparkle, drop: Drop, barbell: Barbell, book: BookOpen, moon: Moon, sun: Sun, heart: Heart, leaf: Leaf,
  brain: Brain, pray: HandsPraying, run: PersonSimpleRun, code: Code, money: Money, phone: Phone, coffee: Coffee,
  idea: Lightbulb, plant: Plant, star: Star,
};
export const habitIcon = (k) => HABIT_ICONS[k] || Sparkle;

export const PRIORITIES = [
  { id: 'low', label: 'Low', color: '#8e98a8' },
  { id: 'medium', label: 'Medium', color: '#e3bd63' },
  { id: 'high', label: 'High', color: '#ff6b6b' },
];

export const REMIND_OPTIONS = [
  { v: 0, label: 'At time only' },
  { v: 5, label: '5 min before' },
  { v: 10, label: '10 min before' },
  { v: 15, label: '15 min before' },
  { v: 30, label: '30 min before' },
  { v: 60, label: '1 hour before' },
];

export const REPEAT_OPTIONS = [
  { v: 'none', label: "Doesn't repeat" },
  { v: 'daily', label: 'Every day' },
  { v: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { v: 'weekly', label: 'Every week' },
  { v: 'monthly', label: 'Every month' },
];

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
