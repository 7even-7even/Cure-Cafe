const COLORS = ['#10b981', '#f97316', '#8b5cf6', '#0ea5e9', '#f43f5e'];

export default function NutrientPie({ item, compact = false }) {
  const nutrients = [
    { key: 'carbsGrams', label: 'Carbs', value: Number(item?.carbsGrams || item?.carbs || 0) },
    { key: 'proteinGrams', label: 'Protein', value: Number(item?.proteinGrams || item?.protein || 0) },
    { key: 'fatGrams', label: 'Fats', value: Number(item?.fatGrams || item?.fat || 0) },
    { key: 'vitaminsGrams', label: 'Vitamins', value: Number(item?.vitaminsGrams || item?.vitamins || 0) },
    { key: 'fiberGrams', label: 'Fiber', value: Number(item?.fiberGrams || item?.fiber || 0) }
  ];
  const total = nutrients.reduce((sum, n) => sum + n.value, 0) || 1;
  let cursor = 0;
  const gradient = nutrients.map((n, index) => {
    const start = cursor;
    const end = cursor + (n.value / total) * 360;
    cursor = end;
    return `${COLORS[index]} ${start}deg ${end}deg`;
  }).join(', ');

  return (
    <div className={`flex ${compact ? 'items-center gap-3' : 'items-center gap-4'}`}>
      <div className={`${compact ? 'h-16 w-16' : 'h-24 w-24'} shrink-0 rounded-full p-1 shadow-inner`} style={{ background: `conic-gradient(${gradient})` }}>
        <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-black text-slate-950`}>{Math.round(item?.calories || 0)}<br /><span className="text-[10px] text-slate-500">kcal</span></span>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-1 text-xs">
        {nutrients.map((n, index) => {
          const pct = Math.round((n.value / total) * 100);
          return (
            <div key={n.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />{n.label}</span>
              <span className="font-black text-slate-900">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
