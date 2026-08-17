import React, { useCallback, useMemo, useRef } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

/**
 * Definição de uma coluna da VirtualizedTable.
 * `width` em pixels (ou 0 para flex-grow / ocupar espaço restante).
 */
export interface ColumnDef<T> {
  key: string;
  header: string;
  width: number;           // px, ou 0 para flex-grow
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface VirtualizedTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  rowHeight: number;
  maxHeight?: number;     // altura máxima do container, padrão 480
  emptyMessage?: string;
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: (item: T, index: number) => string;
  /**
   * Extrai uma chave estável do item para o key do React.
   * Se não fornecido, usa o índice.
   */
  itemKey?: (item: T, index: number) => string;
  /**
   * Classes extras aplicadas ao header row (ex: bg-[#0D1F2D])
   */
  headerClassName?: string;
}

/**
 * Tabela virtualizada com react-window FixedSizeList.
 *
 * - Header fixo acima da lista
 * - Rows renderizadas sob demanda (virtualização)
 * - overflow-x-auto para colunas largas
 * - Compatível com Tailwind e tema dark do PerfortAlmox
 */
export const VirtualizedTable = React.memo(function VirtualizedTable<T>({
  columns,
  data,
  rowHeight,
  maxHeight = 480,
  emptyMessage = 'Nenhum registro encontrado',
  onRowClick,
  rowClassName,
  itemKey,
  headerClassName = 'bg-[#0D1F2D] dark:bg-slate-900',
}: VirtualizedTableProps<T>) {
  const listRef = useRef<List>(null);

  // Total width: soma das larguras fixas + distribuição proporcional para flex-grow (width=0)
  const totalFixedWidth = useMemo(
    () => columns.reduce((sum, c) => sum + (c.width > 0 ? c.width : 0), 0),
    [columns]
  );

  const flexCount = useMemo(
    () => columns.filter(c => c.width === 0).length,
    [columns]
  );

  // Se houver colunas flex, dividimos o restante igualmente
  const flexWidth = flexCount > 0 ? 900 : 0; // fallback razoável para flex cols
  const estimatedTotalWidth = useMemo(
    () => totalFixedWidth + flexCount * flexWidth,
    [totalFixedWidth, flexCount, flexWidth]
  );

  // Resolved widths por coluna (incluindo flex distribuídos)
  const resolvedWidths = useMemo(() => {
    return columns.map(c => {
      if (c.width > 0) return c.width;
      return flexWidth;
    });
  }, [columns, flexWidth]);

  // Row renderer
  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const item = data[index];
      if (!item) return null;

      const rowCls = rowClassName ? rowClassName(item, index) : '';
      const cursor = onRowClick ? 'cursor-pointer' : '';

      return (
        <div
          style={style}
          className={
            'flex items-center border-b border-slate-100 dark:border-slate-700 ' +
            'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ' +
            rowCls + ' ' + cursor
          }
          onClick={() => onRowClick?.(item, index)}
        >
          {columns.map((col, ci) => (
            <div
              key={col.key}
              style={{
                width: resolvedWidths[ci],
                minWidth: resolvedWidths[ci],
                flex: col.width === 0 ? '1 1 0' : 'none',
              }}
              className={
                'px-4 py-3 text-sm overflow-hidden text-ellipsis whitespace-nowrap ' +
                (col.align === 'center' ? 'text-center ' : col.align === 'right' ? 'text-right ' : 'text-left ') +
                (ci === 0 ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400')
              }
            >
              {col.render ? col.render(item, index) : (item as Record<string, unknown>)[col.key] as React.ReactNode}
            </div>
          ))}
        </div>
      );
    },
    [data, columns, resolvedWidths, onRowClick, rowClassName]
  );

  // Key extractor
  const keyExtractor = useCallback(
    (index: number) => {
      if (itemKey && data[index]) return itemKey(data[index], index);
      return String(index);
    },
    [data, itemKey]
  );

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div
          className={'flex items-center ' + headerClassName}
          style={{ height: 44 }}
        >
          {columns.map(col => (
            <div
              key={col.key}
              style={{
                width: col.width || flexWidth,
                minWidth: col.width || flexWidth,
                flex: col.width === 0 ? '1 1 0' : 'none',
              }}
              className="px-4 py-3 text-sm font-semibold text-white"
            >
              {col.header}
            </div>
          ))}
        </div>
        <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      {/* Header fixo */}
      <div
        className={'flex items-center ' + headerClassName}
        style={{ height: 44, minWidth: estimatedTotalWidth }}
      >
        {columns.map(col => (
          <div
            key={col.key}
            style={{
              width: col.width || flexWidth,
              minWidth: col.width || flexWidth,
              flex: col.width === 0 ? '1 1 0' : 'none',
            }}
            className="px-4 py-3 text-sm font-semibold text-white"
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Lista virtualizada */}
      <div className="overflow-x-auto">
        <List
          ref={listRef}
          height={Math.min(maxHeight, data.length * rowHeight)}
          itemCount={data.length}
          itemSize={rowHeight}
          width={estimatedTotalWidth}
          overscanCount={5}
        >
          {Row}
        </List>
      </div>
    </div>
  );
}) as <T>(props: VirtualizedTableProps<T>) => React.ReactElement;
