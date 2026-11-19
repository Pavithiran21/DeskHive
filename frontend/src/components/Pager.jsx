import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/** "1–20 of 64" with previous and next page buttons, for any { page, size, totalItems, totalPages }. */
export function Pager({ data, onPage, showSize = false }) {
  if (!data || data.totalItems === 0) {
    return null;
  }
  const first = (data.page - 1) * data.size + 1;
  const last = Math.min(data.page * data.size, data.totalItems);
  return (
    <nav className="pager" aria-label="Pages">
      <span className="fill">
        {first}–{last} of {data.totalItems}
      </span>
      {showSize && <span>{data.size} per page</span>}
      <button
        type="button"
        className="icon-btn"
        aria-label="Previous page"
        disabled={data.page <= 1}
        onClick={() => onPage(data.page - 1)}
      >
        <IconChevronLeft />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Next page"
        disabled={data.page >= data.totalPages}
        onClick={() => onPage(data.page + 1)}
      >
        <IconChevronRight />
      </button>
    </nav>
  );
}
