import React from "react";
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid'; // ⭐️ FIX 1: Type-only import
import { useLogs } from "../hooks/useLogs";
 
interface LogsProps {
  serverId: string;
  token?: string;
}

const columns: GridColDef[] = [
  { 
    field: 'timestamp', 
    headerName: 'Time', 
    width: 180, 
    type: 'dateTime', 
    valueGetter: (value) => { 
      return value ? new Date(value) : null;
    }
  },
  { field: 'level', headerName: 'Level', width: 120 },
  { field: 'source', headerName: 'Source', width: 150 },
  { field: 'event_id', headerName: 'Event ID', width: 120 },
  { field: 'message', headerName: 'Message', flex: 1 },
];

export const Logs: React.FC<LogsProps> = ({ serverId, token }) => {
  const logs = useLogs(serverId, token);

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200 p-4">
      <h1 className="text-3xl font-bold mb-4">Event Logs</h1>
      <div style={{ height: '80vh', width: '100%' }}>
        <DataGrid
          rows={logs}
          columns={columns}
          getRowId={(row) => row.id}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },  
          }}
          pageSizeOptions={[10, 25, 50, 100]} 
          pagination 
          slots={{
            toolbar: GridToolbar, 
          }} 
        />
      </div>
    </div>
  );
};