export default function DataTable({ data, loading, emptyMsg = 'Sin datos.' }) {
  if (loading) return (
    <div style={styles.empty}>
      <div style={styles.spinner} />
      Cargando...
    </div>
  )
  if (!data || data.length === 0) return <p style={styles.emptyText}>{emptyMsg}</p>

  const cols = Object.keys(data[0])

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={styles.th}>
                {c.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              {cols.map(c => (
                <td key={c} style={styles.td}>
                  {row[c] === null || row[c] === undefined
                    ? <span style={{ color: '#cbd5e1' }}>—</span>
                    : typeof row[c] === 'boolean'
                      ? <span style={{ color: row[c] ? '#16a34a' : '#dc2626' }}>{row[c] ? 'Sí' : 'No'}</span>
                      : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const styles = {
  wrapper: {
    overflowX: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '10px 14px',
    background: '#f1f5f9',
    color: '#475569',
    fontWeight: '600',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #e2e8f0',
    textTransform: 'capitalize',
  },
  td: {
    padding: '9px 14px',
    color: '#334155',
    borderBottom: '1px solid #f1f5f9',
    whiteSpace: 'nowrap',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '2rem',
    color: '#94a3b8',
    fontSize: '14px',
  },
  emptyText: {
    color: '#94a3b8',
    padding: '1.5rem 0',
    fontSize: '14px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #e2e8f0',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}
