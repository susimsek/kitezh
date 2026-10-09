import { Button, Form } from "react-bootstrap";
import { ActionIcon } from "@/components/shared/ActionIcon";

export function PaginationControls({
  page,
  totalPages,
  totalElements,
  size,
  rowsPerPage,
  pageLabel,
  previous,
  next,
  first,
  last,
  onPageChange,
  onSizeChange,
  pageSizeId = "admin-page-size",
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  size: number;
  rowsPerPage: string;
  pageLabel: string;
  previous: string;
  next: string;
  first: string;
  last: string;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  pageSizeId?: string;
}) {
  if (totalElements === 0) return null;
  const safePage = Math.min(Math.max(page, 0), Math.max(totalPages - 1, 0));
  const firstRecord = safePage * size + 1;
  const lastRecord = Math.min((safePage + 1) * size, totalElements);
  return (
    <div className="admin-pagination">
      <div className="admin-pagination-summary" aria-live="polite">
        <strong>
          {firstRecord}–{lastRecord}
        </strong>
        <span className="text-body-secondary"> / {totalElements}</span>
      </div>
      <div className="admin-pagination-size">
        <label className="text-body-secondary" htmlFor={pageSizeId}>
          {rowsPerPage}
        </label>
        <Form.Select
          id={pageSizeId}
          size="sm"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </Form.Select>
      </div>
      <div className="admin-pagination-nav">
        <Button
          size="sm"
          variant="secondary"
          className="admin-pagination-control"
          aria-label={first}
          title={first}
          disabled={safePage === 0}
          onClick={() => onPageChange(0)}
        >
          <ActionIcon action="firstPage" className="m-0" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="admin-pagination-control"
          aria-label={previous}
          title={previous}
          disabled={safePage === 0}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ActionIcon action="previousPage" className="m-0" />
        </Button>
        <span className="admin-pagination-page-indicator">
          {pageLabel} <strong>{safePage + 1}</strong> / {Math.max(totalPages, 1)}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="admin-pagination-control"
          aria-label={next}
          title={next}
          disabled={safePage + 1 >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          <ActionIcon action="nextPage" className="m-0" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="admin-pagination-control"
          aria-label={last}
          title={last}
          disabled={safePage + 1 >= totalPages}
          onClick={() => onPageChange(Math.max(totalPages - 1, 0))}
        >
          <ActionIcon action="lastPage" className="m-0" />
        </Button>
      </div>
    </div>
  );
}
