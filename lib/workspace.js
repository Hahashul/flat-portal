'use client'
import { createContext, useContext } from 'react'

// Who is looking, and which organization and project they are looking at.
// readOnly is only a UI hint. The database enforces it (see the RLS policies).
export const WorkspaceContext = createContext({
  role: null, orgId: null, orgName: '', readOnly: true, adminView: false,
  projects: [], projectId: null,
})
export const useWorkspace = () => useContext(WorkspaceContext)
