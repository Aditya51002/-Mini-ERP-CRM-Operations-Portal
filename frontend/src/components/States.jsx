export function LoadingState({ label = "Loading" }) {
  return (
    <div className="panel flex min-h-40 items-center justify-center p-6 text-sm font-semibold text-slate-600">
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="panel border-red-200 bg-red-50 p-5">
      <p className="text-sm font-semibold text-workred">{message}</p>
      {onRetry && (
        <button className="secondary-button mt-4" onClick={onRetry} type="button">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ label }) {
  return (
    <div className="panel p-6 text-sm text-slate-500">
      {label}
    </div>
  );
}
