export type Address = `0x${string}`;

export type Workspace = {
  workspace_id: number;
  owner: string;
  approver_1: string;
  approver_2: string;
  pipeline_signer: string;
  change_count: number;
  last_submission_at: number;
};

export type Risk = "RISK_LOW" | "RISK_HIGH" | "RISK_CRITICAL" | string;

export type Change = {
  workspace_id: number;
  change_id: number;
  description: string;
  artifact_uri: string;
  artifact_digest: string;
  artifact_status: string;
  risk: Risk;
  created_at: number;
  approved_at: number;
  approver_1_approved: boolean;
  approver_2_approved: boolean;
  approvals: number;
  approvals_required: number;
  delay_seconds: number;
  execute_after: number;
  seconds_remaining: number;
  ready: boolean;
  status: "AWAITING_APPROVAL" | "TIMELOCK" | "READY" | "EXECUTED" | string;
  executed: boolean;
  executed_digest: string;
  executed_at: number;
};

export type ChangeFeed = {
  workspace_id: number;
  start: number;
  count: number;
  total_changes: number;
  rows: Change[];
};

export type Config = {
  workspace_count: number;
  cooldown_seconds: number;
  max_changes_per_workspace: number;
  max_description_length: number;
  supported_artifact_hosts?: string[];
  risk_policy: Record<
    string,
    { approvals_required: number; delay_seconds: number }
  >;
};

export type TxState = {
  hash: `0x${string}`;
  action: string;
  status: string;
  sender?: Address;
  workspaceId?: number;
  changeId?: number;
  baselineWorkspaceCount?: number;
  baselineChangeCount?: number;
  baselineApprovals?: number;
};
