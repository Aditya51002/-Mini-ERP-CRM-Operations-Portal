export default function Pagination({ page, pageSize, total, totalPages, onPageChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm">
      <span className="text-slate-600">
        Page {page} of {Math.max(totalPages, 1)} · {total} total · {pageSize} per page
      </span>
      <div className="flex gap-2">
        <button
          className="secondary-button h-9"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          Previous
        </button>
        <button
          className="secondary-button h-9"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
