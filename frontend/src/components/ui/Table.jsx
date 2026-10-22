import { cn } from '../../lib/cn'

/** Admin table. Scrolls sideways on small screens instead of breaking the page. */
export function Table({ className, children, ...props }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export const THead = ({ children }) => <thead className="bg-surface-3">{children}</thead>
export const TBody = ({ children }) => <tbody>{children}</tbody>

export function TR({ selected, onClick, className, children, ...props }) {
  return (
    <tr
      onClick={onClick}
      aria-selected={selected || undefined}
      className={cn(
        'border-b border-border transition-colors hover:bg-tint',
        selected && 'bg-tint',
        onClick && 'cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export const TH = ({ className, children, ...props }) => (
  <th
    scope="col"
    className={cn('border-b border-border px-4 py-2.5 font-semibold text-muted whitespace-nowrap', className)}
    {...props}
  >
    {children}
  </th>
)

export const TD = ({ className, children, ...props }) => (
  <td className={cn('px-4 py-3 align-middle text-text', className)} {...props}>{children}</td>
)

/** Full-width empty row: <TableEmpty colSpan={6}>No tickets yet</TableEmpty> */
export const TableEmpty = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted">{children}</td>
  </tr>
)
