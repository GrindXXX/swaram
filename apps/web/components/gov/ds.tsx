/* ============================================================================
   DESIGN-SYSTEM ADAPTER  (gov/admin surfaces)

   Single choke point between the gov/admin surfaces and @swaram/ui, which is
   owned by the scaffold agent. If its exported names or prop shapes differ from
   what is assumed below, THIS IS THE ONLY FILE THAT NEEDS EDITING.

   ASSUMED @swaram/ui CONTRACT
   ---------------------------------------------------------------------------
     StatusPill   ({ status: IssueStatus,   size?: 'sm'|'md' })
     PriorityPill ({ priority: IssuePriority, size?: 'sm'|'md' })
     QueueRow     ({ issue, selected?, onOpen? })     — used for simple lists
     AITraceCard  ({ runs: { agent_name, output, confidence, was_overridden }[] })

   Everything else on these surfaces is rendered with the local newsprint
   stylesheet (components/gov/newsprint.css) and needs nothing from @swaram/ui.
   ========================================================================== */
export { StatusPill, PriorityPill, QueueRow, AITraceCard } from '@swaram/ui';
