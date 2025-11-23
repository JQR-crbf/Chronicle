// --- Helper Functions ---

export const getTagColors = (tag: string): string => {
  const colors = [
    "bg-rose-100 text-rose-700 border-rose-200",
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-violet-100 text-violet-700 border-violet-200",
    "bg-cyan-100 text-cyan-700 border-cyan-200",
    "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    "bg-lime-100 text-lime-700 border-lime-200",
  ];
  // Simple hash to pick a consistent color for the same tag
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const getRarityColor = (rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'): string => {
  switch (rarity) {
    case 'Legendary': return 'text-amber-500 bg-amber-50 border-amber-200';
    case 'Epic': return 'text-purple-500 bg-purple-50 border-purple-200';
    case 'Rare': return 'text-blue-500 bg-blue-50 border-blue-200';
    default: return 'text-stone-500 bg-stone-50 border-stone-200';
  }
};

