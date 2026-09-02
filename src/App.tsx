import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ClipboardCopy,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  Fingerprint,
  Gauge,
  KeyRound,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Play,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Terminal,
  TimerReset,
  Users,
  Wallet,
  XCircle,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONTRACT_ADDRESS,
  CONTRACT_EXPLORER_URL,
  DEMO_WORKSPACE_ID
} from "./config";
import { reportError } from "./errors";
import {
  connectWallet,
  currentWallet,
  getChange,
  getChanges,
  getConfig,
  getLatestWorkspaceId,
  getTransactionStatus,
  getWorkspace,
  writeContractAction
} from "./genlayer";
import type {
  Address,
  Change,
  ChangeFeed,
  Config,
  TxState,
  Workspace
} from "./types";

const SHORT = (value?: string | null) =>
  value && value.length > 12
    ? `${value.slice(0, 6)}…${value.slice(-4)}`
    : value || "—";

const IS_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TERMINAL_TX_STATUSES = new Set([
  "FINALIZED",
  "FAILED",
  "CANCELED",
  "UNDETERMINED"
]);

function formatUtc(unix?: number) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function riskLabel(risk?: string) {
  if (risk === "RISK_CRITICAL") return "CRITICAL";
  if (risk === "RISK_HIGH") return "HIGH";
  if (risk === "RISK_LOW") return "LOW";
  return "UNCLASSIFIED";
}

function riskClass(risk?: string) {
  if (risk === "RISK_CRITICAL") return "risk critical";
  if (risk === "RISK_HIGH") return "risk high";
  if (risk === "RISK_LOW") return "risk low";
  return "risk neutral";
}

function statusTone(status?: string) {
  if (status === "EXECUTED") return "executed";
  if (status === "READY") return "ready";
  if (status === "TIMELOCK") return "timelock";
  return "waiting";
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [workspaceId, setWorkspaceId] = useState<number>(0);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [changeId, setChangeId] = useState<number>(0);
  const [change, setChange] = useState<Change | null>(null);
  const [feed, setFeed] = useState<ChangeFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tx, setTx] = useState<TxState | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [activeTab, setActiveTab] = useState<"workspace" | "control" | "audit">("workspace");

  const [openWorkspaceInput, setOpenWorkspaceInput] = useState("");
  const [approver1, setApprover1] = useState("");
  const [approver2, setApprover2] = useState("");
  const [pipelineSigner, setPipelineSigner] = useState("");
  const [description, setDescription] = useState("");
  const [artifactUri, setArtifactUri] = useState("");
  const [artifactDigest, setArtifactDigest] = useState("");
  const [executedDigest, setExecutedDigest] = useState("");
  const [openChangeInput, setOpenChangeInput] = useState("");
  const changeIdRef = useRef(0);

  const pending = Boolean(tx && !TERMINAL_TX_STATUSES.has(tx.status));

  const role = useMemo(() => {
    if (!account || !workspace) return "VIEWER";
    const who = account.toLowerCase();
    if (workspace.owner.toLowerCase() === who) return "OWNER";
    const isA1 = workspace.approver_1.toLowerCase() === who;
    const isA2 = workspace.approver_2.toLowerCase() === who;
    const isPipeline = workspace.pipeline_signer.toLowerCase() === who;
    if (isA1 && isPipeline) return "APPROVER 1 + PIPELINE";
    if (isA2 && isPipeline) return "APPROVER 2 + PIPELINE";
    if (isA1) return "APPROVER 1";
    if (isA2) return "APPROVER 2";
    if (isPipeline) return "PIPELINE SIGNER";
    return "VIEWER";
  }, [account, workspace]);

  const browserSecondsRemaining = useMemo(() => {
    if (!change || change.executed) return 0;
    return Math.max(0, change.execute_after - now);
  }, [change, now]);

  const executionGate = useMemo(() => {
    if (!change || change.executed) {
      return { ready: false, label: "Execution unavailable" };
    }
    if (change.approvals < change.approvals_required || !change.approved_at) {
      return {
        ready: false,
        label: `Waiting for approvals · ${change.approvals}/${change.approvals_required}`
      };
    }
    if (browserSecondsRemaining > 0) {
      return {
        ready: false,
        label: `Available in ${formatCountdown(browserSecondsRemaining)}`
      };
    }
    return { ready: true, label: "Attest executed digest" };
  }, [change, browserSecondsRemaining]);

  const canApprove = useMemo(() => {
    if (!account || !workspace || !change || change.executed) return false;
    const who = account.toLowerCase();
    if (
      who === workspace.approver_1.toLowerCase() &&
      !change.approver_1_approved
    ) {
      return true;
    }
    if (
      who === workspace.approver_2.toLowerCase() &&
      !change.approver_2_approved
    ) {
      return true;
    }
    return false;
  }, [account, workspace, change]);

  const isOwner = Boolean(
    account && workspace && account.toLowerCase() === workspace.owner.toLowerCase()
  );

  const isPipelineSigner = Boolean(
    account && workspace && account.toLowerCase() === workspace.pipeline_signer.toLowerCase()
  );

  useEffect(() => {
    changeIdRef.current = changeId;
  }, [changeId]);

  const loadWorkspace = useCallback(async (id: number, quiet = false) => {
    if (!id || id < 1) return;
    if (!quiet) setLoading(true);
    setError("");

    try {
      const nextWorkspace = await getWorkspace(id);
      const nextFeed = await getChanges(id, 1, 20);
      setWorkspaceId(id);
      setWorkspace(nextWorkspace);
      setFeed(nextFeed);
      setOpenWorkspaceInput(String(id));

      const params = new URLSearchParams(window.location.search);
      params.set("workspace", String(id));
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`);

      if (nextWorkspace.change_count > 0) {
        const currentChangeId = changeIdRef.current;
        const desired =
          currentChangeId > 0 && currentChangeId <= nextWorkspace.change_count
            ? currentChangeId
            : nextWorkspace.change_count;
        const nextChange = await getChange(id, desired);
        setChangeId(desired);
        setOpenChangeInput(String(desired));
        setChange(nextChange);
        setExecutedDigest(nextChange.artifact_digest);
      } else {
        setChangeId(0);
        setOpenChangeInput("");
        setChange(null);
      }
    } catch (e) {
      setError(reportError("load workspace", e, "Could not load that workspace."));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadSpecificChange = useCallback(
    async (id: number) => {
      if (!workspaceId || !id) return;
      setLoading(true);
      setError("");
      try {
        const nextChange = await getChange(workspaceId, id);
        setChangeId(id);
        setOpenChangeInput(String(id));
        setChange(nextChange);
        setExecutedDigest(nextChange.artifact_digest);
      } catch (e) {
        setError(reportError("load change", e, "Could not load that change."));
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  const refreshAll = useCallback(async () => {
    try {
      const nextConfig = await getConfig();
      setConfig(nextConfig);
      if (workspaceId > 0) await loadWorkspace(workspaceId, true);
    } catch (e) {
      setError(reportError("refresh", e, "Could not refresh on-chain state."));
    }
  }, [workspaceId, loadWorkspace]);

  const refreshAfterFinalization = useCallback(async (action: string) => {
    try {
      const nextConfig = await getConfig();
      setConfig(nextConfig);

      if (action === "Create workspace" && account) {
        const latest = await getLatestWorkspaceId(account);
        if (latest > 0) {
          changeIdRef.current = 0;
          setChangeId(0);
          await loadWorkspace(latest, true);
          setActiveTab("control");
          setNotice(`Workspace #${latest} is finalized and open.`);
          return;
        }
      }

      if (workspaceId > 0) {
        if (action === "Submit change") {
          changeIdRef.current = 0;
          setChangeId(0);
        }
        await loadWorkspace(workspaceId, true);
        if (action === "Submit change") {
          setActiveTab("control");
        }
      }
    } catch (e) {
      setError(reportError("post-finalization refresh", e));
    }
  }, [account, workspaceId, loadWorkspace]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [nextConfig, wallet] = await Promise.all([getConfig(), currentWallet()]);
        setConfig(nextConfig);
        setAccount(wallet);

        const params = new URLSearchParams(window.location.search);
        const fromUrl = Number(params.get("workspace") || "0");
        const initial =
          fromUrl > 0
            ? fromUrl
            : DEMO_WORKSPACE_ID > 0
              ? DEMO_WORKSPACE_ID
              : nextConfig.workspace_count > 0
                ? 1
                : 0;
        if (initial > 0) await loadWorkspace(initial);
      } catch (e) {
        setError(reportError("initial load", e, "Could not load OpsGate."));
      }
    })();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!window.ethereum?.on) return;

    let cancelled = false;

    const syncVisibleWorkspace = async (message?: string) => {
      if (message) setNotice(message);
      setError("");

      try {
        if (workspaceId > 0) {
          await loadWorkspace(workspaceId, true);
        } else {
          const nextConfig = await getConfig();
          if (!cancelled) setConfig(nextConfig);
        }
      } catch (e) {
        if (!cancelled) {
          setError(reportError("wallet sync", e, "Could not refresh workspace after wallet switch."));
        }
      }
    };

    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const next = (accounts?.[0] as Address | undefined) ?? null;

      setAccount(next);

      if (!next) {
        setNotice("Wallet disconnected.");
        return;
      }

      void syncVisibleWorkspace(`Wallet switched to ${SHORT(next)}. Syncing workspace…`);
    };

    const handleChainChanged = () => {
      void syncVisibleWorkspace("Network changed. Syncing workspace…");
    };

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      cancelled = true;
      window.ethereum?.removeListener?.("accountsChanged", handleAccounts);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [workspaceId, loadWorkspace]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!tx || !TERMINAL_TX_STATUSES.has(tx.status)) return;
    const terminalHash = tx.hash;
    const timer = window.setTimeout(() => {
      setTx((current) => current?.hash === terminalHash ? null : current);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [tx]);

  useEffect(() => {
    if (!workspaceId) return;

    let refreshing = false;

    const refreshOnReturn = () => {
      if (document.hidden || refreshing) return;

      refreshing = true;
      void loadWorkspace(workspaceId, true)
        .catch(() => undefined)
        .finally(() => {
          refreshing = false;
        });
    };

    const handleVisibility = () => {
      if (!document.hidden) refreshOnReturn();
    };

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [workspaceId, loadWorkspace]);

  useEffect(() => {
    if (!tx || TERMINAL_TX_STATUSES.has(tx.status)) return;

    const sender = tx.sender?.toLowerCase();
    let stateProvesSuccess = false;

    if (
      tx.action === "Create workspace" &&
      config &&
      config.workspace_count > (tx.baselineWorkspaceCount ?? 0)
    ) {
      stateProvesSuccess = true;
    }

    if (
      tx.action === "Submit change" &&
      workspace &&
      workspace.workspace_id === tx.workspaceId &&
      workspace.change_count > (tx.baselineChangeCount ?? 0)
    ) {
      stateProvesSuccess = true;
    }

    if (
      tx.action === "Approve change" &&
      workspace &&
      change &&
      workspace.workspace_id === tx.workspaceId &&
      change.change_id === tx.changeId &&
      change.approvals > (tx.baselineApprovals ?? 0)
    ) {
      const approvedBySender =
        sender === workspace.approver_1.toLowerCase()
          ? change.approver_1_approved
          : sender === workspace.approver_2.toLowerCase()
            ? change.approver_2_approved
            : false;
      stateProvesSuccess = approvedBySender;
    }

    if (
      tx.action === "Mark executed" &&
      change &&
      change.change_id === tx.changeId &&
      change.workspace_id === tx.workspaceId &&
      change.executed
    ) {
      stateProvesSuccess = true;
    }

    if (stateProvesSuccess) {
      // A submit can be proven finalized from the authoritative workspace count
      // before the transaction-status endpoint reports FINALIZED. Select the
      // newly-created change immediately here instead of relying on a later
      // effect/polling race.
      if (
        tx.action === "Submit change" &&
        workspace &&
        workspace.workspace_id === tx.workspaceId &&
        workspace.change_count > (tx.baselineChangeCount ?? 0)
      ) {
        const newest = workspace.change_count;
        changeIdRef.current = newest;
        setActiveTab("control");
        void loadSpecificChange(newest);
      }

      setTx((current) =>
        current && current.hash === tx.hash
          ? { ...current, status: "FINALIZED" }
          : current
      );
    }
  }, [tx, config, workspace, change, loadSpecificChange]);

  useEffect(() => {
    if (
      !tx ||
      tx.action !== "Submit change" ||
      tx.status !== "FINALIZED" ||
      !workspace ||
      workspace.workspace_id !== tx.workspaceId ||
      workspace.change_count <= (tx.baselineChangeCount ?? 0)
    ) return;

    const newest = workspace.change_count;
    if (changeIdRef.current === newest) return;

    changeIdRef.current = newest;
    setActiveTab("control");
    void loadSpecificChange(newest);
  }, [tx, workspace, loadSpecificChange]);

  useEffect(() => {
    if (!tx || TERMINAL_TX_STATUSES.has(tx.status)) return;

    let cancelled = false;
    const check = async () => {
      try {
        const result = await getTransactionStatus(tx.hash);
        if (cancelled) return;

        setTx((current) =>
          current ? { ...current, status: result.status } : current
        );

        if (result.status === "FINALIZED") {
          setNotice(`${tx.action} FINALIZED. Reloading authoritative state…`);
          window.setTimeout(() => void refreshAfterFinalization(tx.action), 1300);
        } else if (["FAILED", "CANCELED", "UNDETERMINED"].includes(result.status)) {
          setNotice(`${tx.action} ended as ${result.status}. Local write lock released; on-chain state is unchanged unless the contract reports otherwise.`);
          window.setTimeout(() => void refreshAll(), 700);
        }
      } catch (e) {
        console.warn("[OpsGate] transaction status check:", e);
      }
    };

    void check();
    const timer = window.setInterval(check, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tx, refreshAfterFinalization, refreshAll]);

  async function handleConnect() {
    setError("");
    try {
      const wallet = await connectWallet();
      setAccount(wallet);
      setNotice(`Connected ${SHORT(wallet)}.`);
    } catch (e) {
      setError(reportError("connect wallet", e));
    }
  }

  async function sendAction(
    action: string,
    functionName: string,
    args: Array<string | number | bigint | boolean>
  ) {
    if (!account) {
      await handleConnect();
      return;
    }
    if (pending) return;

    setError("");
    setNotice("");
    try {
      const hash = await writeContractAction(account, functionName, args);
      setTx({
        hash,
        action,
        status: "SUBMITTED",
        sender: account,
        workspaceId: workspaceId || undefined,
        changeId: changeId || undefined,
        baselineWorkspaceCount: config?.workspace_count ?? 0,
        baselineChangeCount: workspace?.change_count ?? 0,
        baselineApprovals: change?.approvals ?? 0
      });
      setNotice(`${action} submitted. Waiting for GenLayer finalization.`);
    } catch (e) {
      setError(reportError(action, e, `${action} failed.`));
    }
  }

  async function createWorkspace() {
    if (!IS_ADDRESS.test(approver1) || !IS_ADDRESS.test(approver2) || !IS_ADDRESS.test(pipelineSigner)) {
      setError("Enter valid 0x addresses for both approvers and the pipeline signer.");
      return;
    }
    if (approver1.toLowerCase() === approver2.toLowerCase()) {
      setError("Approver addresses must be different.");
      return;
    }
    if (account) {
      const owner = account.toLowerCase();
      if (approver1.toLowerCase() === owner || approver2.toLowerCase() === owner) {
        setError("Workspace owner must be different from both approvers.");
        return;
      }
      if (pipelineSigner.toLowerCase() === owner) {
        setError("Workspace owner must be different from the pipeline signer.");
        return;
      }
    }

    await sendAction("Create workspace", "create_workspace", [approver1, approver2, pipelineSigner]);
  }

  async function loadMyLatest() {
    if (!account) {
      await handleConnect();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const id = await getLatestWorkspaceId(account);
      if (!id) {
        setNotice("This wallet has not created an OpsGate workspace yet.");
        return;
      }
      await loadWorkspace(id);
    } catch (e) {
      setError(reportError("load my workspace", e));
    } finally {
      setLoading(false);
    }
  }

  async function submitChange() {
    if (!workspaceId) {
      setError("Open a workspace first.");
      return;
    }
    const clean = description.trim();
    const uri = artifactUri.trim();
    const digest = artifactDigest.trim().toLowerCase();
    if (clean.length < 20) {
      setError("Change description must be at least 20 characters.");
      return;
    }
    if (!/^https:\/\//i.test(uri)) {
      setError("Artifact URI must be a public HTTPS commit-pinned Git locator.");
      return;
    }
    if (!/^[0-9a-f]{40}$/.test(digest)) {
      setError("Artifact digest must be a 40-character hexadecimal Git object id.");
      return;
    }
    await sendAction("Submit change", "submit_change", [workspaceId, clean, uri, digest]);
  }

  async function approveChange() {
    if (!workspaceId || !changeId) return;
    await sendAction("Approve change", "approve_change", [workspaceId, changeId]);
  }

  async function executeChange() {
    if (!workspaceId || !changeId) return;
    const digest = executedDigest.trim().toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(digest)) {
      setError("Execution digest must be a 40-character hexadecimal Git object id.");
      return;
    }
    await sendAction("Mark executed", "mark_change_executed", [workspaceId, changeId, digest]);
  }

  async function copyDigest(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Pinned digest copied.");
    } catch {
      setError("Could not copy the digest from this browser.");
    }
  }

  async function manualTxCheck() {
    if (!tx) return;
    setError("");
    try {
      const result = await getTransactionStatus(tx.hash);
      setTx({ ...tx, status: result.status });

      if (result.status === "FINALIZED") {
        setNotice(`${tx.action} FINALIZED. Reloading authoritative state…`);
        await refreshAfterFinalization(tx.action);
      } else if (["FAILED", "CANCELED", "UNDETERMINED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(result.status)) {
        await refreshAll();
      }
    } catch (e) {
      setError(reportError("check transaction", e));
    }
  }

  const changePolicy = change ? config?.risk_policy?.[change.risk] : null;

  return (
    <div className="app-shell">
      <header className="command-header">
        <a className="brand" href="/" aria-label="OpsGate home">
          <img src="/opsgate-logo.svg" alt="OpsGate" />
          <div>
            <strong>OpsGate</strong>
            <span>production change control</span>
          </div>
        </a>

        <div className="header-center">
          <span className="live-dot"><i /> STUDIO NETWORK · 61999</span>
          <span className="contract-chip">CONTRACT {SHORT(CONTRACT_ADDRESS)}</span>
        </div>

        <div className="header-actions">
          <a
            className="genlayer-chip"
            href={CONTRACT_EXPLORER_URL}
            target="_blank"
            rel="noreferrer"
          >
            <img src="/genlayer-logo.jpg" alt="GenLayer" />
            <span>Built on GenLayer</span>
          </a>
          <button className="wallet-button" onClick={handleConnect}>
            <Wallet size={16} />
            {account ? SHORT(account) : "Connect wallet"}
          </button>
        </div>
      </header>

      <main className="portal-main">
        {(error || notice || loading) && (
          <div className={`system-message ${error ? "error" : "info"}`}>
            {loading ? <LoaderCircle className="spin" size={17} /> : error ? <XCircle size={17} /> : <Radio size={17} />}
            <span>{loading ? "Reading authoritative on-chain state…" : error || notice}</span>
            {error && <button onClick={() => setError("")}>dismiss</button>}
          </div>
        )}

        <section className="portal-hero">
          <div className="hero-copy">
            <span className="eyebrow">OPSGATE / BUILT ON GENLAYER</span>
            <h1>
              Production change control,
              <span> powered by consensus.</span>
            </h1>
            <p>
              Bind every change to a commit-pinned artifact. GenLayer checks description consistency and classifies artifact risk.
              OpsGate deterministically enforces approvals, post-approval timelock, and pipeline-signed execution.
            </p>

            <div className="hero-pipeline">
              <span>Bind artifact</span>
              <i />
              <span>Assess</span>
              <i />
              <span>Approve</span>
              <i />
              <span>Wait</span>
              <i />
              <span>Attest</span>
            </div>
          </div>

          <div className="consensus-orbit" aria-hidden="true">
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="orbit-core">
              <img src="/genlayer-logo.jpg" alt="" />
              <small>GENLAYER</small>
              <strong>CONSENSUS</strong>
            </div>
            <span className="orbit-node node-one">01</span>
            <span className="orbit-node node-two">02</span>
            <span className="orbit-node node-three">03</span>
            <span className="orbit-node node-four">04</span>
            <span className="orbit-node node-five">05</span>
          </div>

          <div className="hero-telemetry">
            <div>
              <span>WORKSPACES</span>
              <strong>{config?.workspace_count ?? "—"}</strong>
            </div>
            <div>
              <span>ACTIVE</span>
              <strong>{workspaceId ? `#${workspaceId}` : "NONE"}</strong>
            </div>
            <div>
              <span>ROLE</span>
              <strong>{role}</strong>
            </div>
          </div>
        </section>

        <nav className="portal-tabs" aria-label="OpsGate sections">
          <button
            className={activeTab === "workspace" ? "active" : ""}
            onClick={() => setActiveTab("workspace")}
          >
            <span className="tab-icon cyan"><Terminal size={19} /></span>
            <span>
              <strong>Workspace</strong>
              <small>Create & load</small>
            </span>
            <em>{workspace ? `#${workspace.workspace_id}` : "SETUP"}</em>
          </button>

          <button
            className={activeTab === "control" ? "active" : ""}
            onClick={() => setActiveTab("control")}
          >
            <span className="tab-icon violet"><Activity size={19} /></span>
            <span>
              <strong>Change Control</strong>
              <small>Classify & approve</small>
            </span>
            <em>{change ? riskLabel(change.risk) : "READY"}</em>
          </button>

          <button
            className={activeTab === "audit" ? "active" : ""}
            onClick={() => setActiveTab("audit")}
          >
            <span className="tab-icon lime"><FileText size={19} /></span>
            <span>
              <strong>Audit & Policy</strong>
              <small>History & rules</small>
            </span>
            <em>{workspace ? `${workspace.change_count} LOGS` : "LOGS"}</em>
          </button>
        </nav>

        <section className="tab-stage">
          {activeTab === "workspace" && (
            <div className="tab-panel workspace-panel">
              <aside className="rack workspace-rack">
                <div className="rack-head">
                  <span><Terminal size={17} /> Workspace control</span>
                  <em>{workspace ? `ONLINE #${workspace.workspace_id}` : "NO TARGET"}</em>
                </div>

                <div className="workspace-display">
                  <span className="micro">CURRENT WORKSPACE</span>
                  <strong>{workspace ? `#${workspace.workspace_id}` : "—"}</strong>
                  <small>{workspace ? `${workspace.change_count} recorded change${workspace.change_count === 1 ? "" : "s"}` : "Open or create an isolated workspace"}</small>
                </div>

                <div className="router-controls">
                  <label>
                    <span>Open workspace by ID</span>
                    <div className="inline-control">
                      <input
                        inputMode="numeric"
                        value={openWorkspaceInput}
                        onChange={(e) => setOpenWorkspaceInput(e.target.value)}
                        placeholder="1"
                      />
                      <button
                        onClick={() => loadWorkspace(Number(openWorkspaceInput))}
                        disabled={!Number(openWorkspaceInput)}
                        title="Open workspace"
                      >
                        Open <ChevronRight size={17} />
                      </button>
                    </div>
                  </label>
                  <button className="secondary full" onClick={loadMyLatest}>
                    <Fingerprint size={17} /> Load my workspace
                  </button>
                </div>

                {workspace && (
                  <div className="role-stack">
                    <RoleRow label="Owner" value={workspace.owner} active={role === "OWNER"} />
                    <RoleRow label="Approver 1" value={workspace.approver_1} active={role.includes("APPROVER 1")} />
                    <RoleRow label="Approver 2" value={workspace.approver_2} active={role.includes("APPROVER 2")} />
                    <RoleRow label="Pipeline signer" value={workspace.pipeline_signer} active={role.includes("PIPELINE")} />
                  </div>
                )}
              </aside>

              <section className="create-workspace-card">
                <div className="card-glow glow-cyan" />
                <div className="create-card-heading">
                  <div className="accent-icon cyan"><Plus size={23} /></div>
                  <div>
                    <span className="eyebrow">NEW ISOLATED ENVIRONMENT</span>
                    <h2>Create isolated workspace</h2>
                    <p>Your connected wallet becomes owner only of the workspace you create.</p>
                  </div>
                </div>

                <div className="create-fields">
                  <label>
                    <span>Approver 1 wallet</span>
                    <input value={approver1} onChange={(e) => setApprover1(e.target.value)} placeholder="0x…" />
                  </label>
                  <label>
                    <span>Approver 2 wallet</span>
                    <input value={approver2} onChange={(e) => setApprover2(e.target.value)} placeholder="0x…" />
                  </label>
                  <label>
                    <span>Pipeline signer wallet</span>
                    <input value={pipelineSigner} onChange={(e) => setPipelineSigner(e.target.value)} placeholder="0x… (may equal an approver)" />
                  </label>
                </div>

                <button className="primary create-workspace-button" onClick={createWorkspace} disabled={pending}>
                  <Plus size={18} /> Create workspace
                </button>
              </section>

              <aside className="quickstart-stack">
                <div className="quick-card violet-card">
                  <span className="quick-number">01</span>
                  <div>
                    <strong>Create a workspace</strong>
                    <small>Owner + two approvers + authenticated pipeline signer.</small>
                  </div>
                </div>
                <div className="quick-card cyan-card">
                  <span className="quick-number">02</span>
                  <div>
                    <strong>Submit a change</strong>
                    <small>Commit-pinned artifact + description go to GenLayer consensus.</small>
                  </div>
                </div>
                <div className="quick-card lime-card">
                  <span className="quick-number">03</span>
                  <div>
                    <strong>Approve, wait, execute</strong>
                    <small>The pipeline signer attests the exact approved digest.</small>
                  </div>
                </div>
                <button className="next-tab-button" onClick={() => setActiveTab("control")} disabled={!workspace}>
                  Continue to Change Control <ChevronRight size={17} />
                </button>
              </aside>
            </div>
          )}

          {activeTab === "control" && (
            <div className="tab-panel control-panel">
              <section className="submission-console control-card">
                <div className="card-glow glow-violet" />
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">01 · DECLARE</span>
                    <h3>Submit production change</h3>
                  </div>
                  <Zap size={22} />
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={config?.max_description_length ?? 1200}
                  placeholder="Describe the production change, its operational effect, reversibility, data impact, and security impact…"
                />
                <div className="create-fields artifact-fields">
                  <label>
                    <span>Commit-pinned artifact URI</span>
                    <input value={artifactUri} onChange={(e) => setArtifactUri(e.target.value)} placeholder="https://raw.githubusercontent.com/owner/repo/&lt;40-char-commit&gt;/path/file.txt" />
                  </label>
                  <label>
                    <span>Artifact digest / Git object id</span>
                    <input value={artifactDigest} onChange={(e) => setArtifactDigest(e.target.value)} placeholder="40 lowercase hex characters" />
                  </label>
                </div>
                <div className="composer-footer">
                  <span>{description.length}/{config?.max_description_length ?? 1200}</span>
                  <div>
                    {!isOwner && workspace && <small>Only Workspace #{workspace.workspace_id}'s owner may submit.</small>}
                    <button
                      className="primary"
                      onClick={submitChange}
                      disabled={pending || !workspaceId || !isOwner || description.trim().length < 20 || artifactUri.trim().length < 24 || artifactDigest.trim().length !== 40}
                    >
                      <Activity size={18} /> Submit for consensus
                    </button>
                  </div>
                </div>

                <div className="control-context">
                  <div>
                    <span>WORKSPACE</span>
                    <strong>{workspace ? `#${workspace.workspace_id}` : "NONE"}</strong>
                  </div>
                  <div>
                    <span>YOUR ROLE</span>
                    <strong>{role}</strong>
                  </div>
                </div>
              </section>

              <section className="rack change-rack control-card">
                <div className="rack-head">
                  <span><FileText size={17} /> 02 · Consensus result</span>
                  <em>{change ? `CHANGE #${change.change_id}` : "NO CHANGE"}</em>
                </div>

                {change ? (
                  <>
                    <div className="change-heading">
                      <div>
                        <span className="micro">WORKSPACE #{change.workspace_id}</span>
                        <h2>Change #{change.change_id}</h2>
                      </div>
                      <span className={riskClass(change.risk)}>{riskLabel(change.risk)}</span>
                    </div>

                    <blockquote>{change.description}</blockquote>

                    <div className={`artifact-panel ${change.artifact_status === "ARTIFACT_MATCH" ? "verified" : "attention"}`}>
                      <div className="artifact-verdict">
                        <span className="artifact-verdict-icon"><ShieldCheck size={20} /></span>
                        <div>
                          <span className="micro">PINNED ARTIFACT</span>
                          <strong>{change.artifact_status === "ARTIFACT_MATCH" ? "Artifact verified" : change.artifact_status.replaceAll("_", " ")}</strong>
                          <small>Consensus checked this description against the commit-pinned source.</small>
                        </div>
                        <span className="artifact-status-badge">{change.artifact_status === "ARTIFACT_MATCH" ? "MATCH" : change.artifact_status}</span>
                      </div>

                      <div className="artifact-identity">
                        <div>
                          <span className="micro">GIT OBJECT ID</span>
                          <code title={change.artifact_digest}>{SHORT(change.artifact_digest)}</code>
                        </div>
                        <div className="artifact-actions">
                          <button type="button" onClick={() => void copyDigest(change.artifact_digest)} title="Copy full digest">
                            <ClipboardCopy size={14} /> Copy
                          </button>
                          <a href={change.artifact_uri} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} /> Open source
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="semantic-split">
                      <div>
                        <span className="micro">GENLAYER DECIDES</span>
                        <strong>{riskLabel(change.risk)} operational risk</strong>
                        <small>Artifact consistency + risk from independent validator consensus.</small>
                      </div>
                      <div>
                        <span className="micro">CONTRACT DERIVES</span>
                        <strong>{change.approvals_required} approval{change.approvals_required === 1 ? "" : "s"} · {change.delay_seconds}s</strong>
                        <small>Approval threshold and timelock are deterministic.</small>
                      </div>
                    </div>

                    <div className="change-meta">
                      <div><span>CREATED</span><strong>{formatUtc(change.created_at)}</strong></div>
                      <div><span>FINAL APPROVAL</span><strong>{formatUtc(change.approved_at)}</strong></div>
                      <div><span>EXECUTE AFTER</span><strong>{formatUtc(change.execute_after)}</strong></div>
                      <div><span>STATUS</span><strong className={`status-text ${statusTone(change.status)}`}>{change.status}</strong></div>
                    </div>
                  </>
                ) : (
                  <div className="empty-console">
                    <Gauge size={34} />
                    <h2>No change selected.</h2>
                    <p>Submit a change or open one from Audit & Policy.</p>
                  </div>
                )}
              </section>

              <aside className="rack gate-rack control-card">
                <div className="rack-head">
                  <span><LockKeyhole size={17} /> 03 · Approval gate</span>
                  <em className={change ? statusTone(change.status) : ""}>{change?.status ?? "IDLE"}</em>
                </div>

                {change && workspace ? (
                  <>
                    <div className="approval-circuit">
                      <ApprovalNode
                        index="A1"
                        label="Approver 1"
                        address={workspace.approver_1}
                        approved={change.approver_1_approved}
                      />
                      <div className={`circuit-line ${change.approver_1_approved ? "on" : ""}`} />
                      <ApprovalNode
                        index="A2"
                        label="Approver 2"
                        address={workspace.approver_2}
                        approved={change.approver_2_approved}
                      />
                    </div>

                    <div className="approval-meter">
                      <div>
                        <span>APPROVALS</span>
                        <strong>{change.approvals}/{change.approvals_required}</strong>
                      </div>
                      <progress value={change.approvals} max={change.approvals_required} />
                    </div>

                    <div className="timer-console">
                      <div className="timer-icon"><Clock3 size={22} /></div>
                      <div>
                        <span>ONCHAIN TIMELOCK</span>
                        <strong>T− {formatCountdown(browserSecondsRemaining)}</strong>
                        <small>Display uses on-chain <code>execute_after</code>. Contract write remains authoritative.</small>
                      </div>
                    </div>

                    {canApprove && (
                      <button className="approve-button" onClick={approveChange} disabled={pending}>
                        <ShieldCheck size={19} /> Approve change
                      </button>
                    )}

                    {isPipelineSigner && !change.executed && (
                      <div className="execution-attestation">
                        <label>
                          <span>Executed digest</span>
                          <input value={executedDigest} onChange={(e) => setExecutedDigest(e.target.value)} placeholder={change.artifact_digest} />
                        </label>
                        <button
                          className={`execute-button ${executionGate.ready ? "is-ready" : "is-locked"}`}
                          onClick={executeChange}
                          disabled={pending || !executionGate.ready}
                          title={!executionGate.ready && change.execute_after ? `Available after ${formatUtc(change.execute_after)}` : undefined}
                        >
                          {executionGate.ready ? <Play size={18} /> : <Clock3 size={18} />}
                          {executionGate.label}
                        </button>
                        {!executionGate.ready && change.approved_at > 0 && browserSecondsRemaining > 0 && (
                          <small className="execution-availability">Available after {formatUtc(change.execute_after)}.</small>
                        )}
                      </div>
                    )}

                    {change.executed && (
                      <div className="executed-seal">
                        <CheckCircle2 size={25} />
                        <div><strong>EXECUTED</strong><span>{change.executed_digest ? `Digest ${SHORT(change.executed_digest)} · ${formatUtc(change.executed_at)}` : "On-chain record is terminal."}</span></div>
                      </div>
                    )}

                    {!canApprove && !isPipelineSigner && !change.executed && (
                      <div className="viewer-note">
                        <KeyRound size={16} /> Connected wallet has no write role for this change.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="idle-gate">
                    <Circle size={24} />
                    <strong>Gate waiting for target</strong>
                    <span>Select a change to inspect the approval circuit.</span>
                  </div>
                )}
              </aside>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="tab-panel audit-panel">
              <section className="audit-console audit-history-card">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">APPEND-ONLY ONCHAIN AUDIT</span>
                    <h3>Change history</h3>
                  </div>
                  <button className="icon-button" onClick={refreshAll} title="Refresh">
                    <RefreshCw size={17} />
                  </button>
                </div>

                <div className="change-opener">
                  <input
                    inputMode="numeric"
                    placeholder="Change ID"
                    value={openChangeInput}
                    onChange={(e) => setOpenChangeInput(e.target.value)}
                  />
                  <button onClick={() => loadSpecificChange(Number(openChangeInput))} disabled={!workspaceId || !Number(openChangeInput)}>
                    Open
                  </button>
                </div>

                <div className="audit-list">
                  {feed?.rows?.length ? (
                    [...feed.rows].reverse().map((row) => (
                      <button
                        className={`audit-row ${row.change_id === changeId ? "active" : ""}`}
                        key={row.change_id}
                        onClick={() => {
                          void loadSpecificChange(row.change_id);
                          setActiveTab("control");
                        }}
                      >
                        <span className="audit-id">#{row.change_id}</span>
                        <span className={riskClass(row.risk)}>{riskLabel(row.risk)}</span>
                        <span className="audit-copy">{row.description}</span>
                        <span className={`audit-status ${statusTone(row.status)}`}>{row.status}</span>
                        <ChevronRight size={15} />
                      </button>
                    ))
                  ) : (
                    <div className="empty-audit">No changes recorded in the loaded workspace.</div>
                  )}
                </div>
              </section>

              <section className="policy-board">
                <div className="policy-intro">
                  <span className="eyebrow">DETERMINISTIC CONSEQUENCE</span>
                  <h2>Consensus assesses artifact.<br />Code chooses the gate.</h2>
                  <p>AI never chooses the number of approvals or the timelock.</p>
                </div>

                <div className="policy-risk-grid">
                  <div className="policy-tile low-tile">
                    <span className="risk low">LOW</span>
                    <strong>1 approval</strong>
                    <small>0 second timelock</small>
                  </div>
                  <div className="policy-tile high-tile">
                    <span className="risk high">HIGH</span>
                    <strong>2 approvals</strong>
                    <small>120 second timelock</small>
                  </div>
                  <div className="policy-tile critical-tile">
                    <span className="risk critical">CRITICAL</span>
                    <strong>2 approvals</strong>
                    <small>600 second timelock</small>
                  </div>
                </div>

                <div className="policy-note">
                  <ShieldCheck size={19} />
                  <span>Artifact verdict is consensus-bound. Approval threshold, approved_at timelock anchor, and pipeline execution authorization are deterministic.</span>
                </div>
              </section>
            </div>
          )}
        </section>

        {tx && (
          <section className="tx-dock tx-floating">
            <div>
              <span className="micro">LATEST TRANSACTION</span>
              <strong>{tx.action}</strong>
              <code>{tx.hash}</code>
            </div>
            <div className="tx-actions">
              <span className={`tx-status ${tx.status === "FINALIZED" ? "done" : tx.status === "FAILED" ? "failed" : "pending"}`}>
                {tx.status === "FINALIZED" ? <Check size={14} /> : tx.status === "FAILED" ? <XCircle size={14} /> : tx.status === "UNKNOWN" ? <Radio size={14} /> : <LoaderCircle className="spin" size={14} />}
                {tx.status}
              </span>
              <button onClick={manualTxCheck}><RefreshCw size={15} /> Check</button>
              <a href={`https://explorer-studio.genlayer.com/tx/${tx.hash}`} target="_blank" rel="noreferrer"><ArrowUpRight size={16} /></a>
            </div>
          </section>
        )}
      </main>

      <footer>
        <div className="footer-brand">
          <img src="/opsgate-logo.svg" alt="OpsGate" />
          <div><strong>OpsGate</strong><span>risk-aware change control</span></div>
        </div>
        <div className="footer-principle">
          <TimerReset size={16} />
          <span>Bind artifact → assess → approve → wait → attest</span>
        </div>
        <a href="https://genlayer.com" target="_blank" rel="noreferrer" className="footer-genlayer">
          <img src="/genlayer-logo.jpg" alt="GenLayer" />
          <span>Built on GenLayer</span>
          <ExternalLink size={13} />
        </a>
      </footer>
    </div>
  );
}

function RoleRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={`role-row ${active ? "active" : ""}`}>
      <span className="role-dot" />
      <div><small>{label}</small><strong>{SHORT(value)}</strong></div>
      {active && <em>YOU</em>}
    </div>
  );
}

function ApprovalNode({
  index,
  label,
  address,
  approved
}: {
  index: string;
  label: string;
  address: string;
  approved: boolean;
}) {
  return (
    <div className={`approval-node ${approved ? "approved" : ""}`}>
      <div className="node-orb">{approved ? <Check size={17} /> : index}</div>
      <div><span>{label}</span><strong>{SHORT(address)}</strong></div>
      <em>{approved ? "APPROVED" : "WAITING"}</em>
    </div>
  );
}
