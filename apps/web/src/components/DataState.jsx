import { apiError } from '../utils/format';

export default function DataState({ isLoading, error, children }) {
  if (isLoading) return <div className="card p-6 text-sm text-slate-500">Loading data...</div>;
  if (error) return <div className="card border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-700">{apiError(error)}</div>;
  return children;
}
