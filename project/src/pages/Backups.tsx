import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Plus, Trash2, Play, Search, AlertTriangle } from 'lucide-react';
import { notify } from '../lib/notify';
import { getLanguage, onLanguageChange, t, type TfyLanguage } from '../lib/i18n';
import { Modal } from '../components/Modal';

interface BackupPoint {
  id: number;
  name: string;
  createdAt: string;
  type: string;
}

export function Backups() {
  const [backups, setBackups] = useState<BackupPoint[]>([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState<BackupPoint | null>(null);
  const [backupName, setBackupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [language, setLanguage] = useState<TfyLanguage>(() => getLanguage());

  useEffect(() => {
    const handleMessage = (event: any) => {
      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }

      if (message?.type === 'backups' && message?.action === 'list') {
        const items = message?.data?.items || [];
        setBackups(items);
        setSelectedIds((prev) => {
          const next = new Set<number>();
          const available = new Set<number>(items.map((i: BackupPoint) => i.id));
          prev.forEach((id) => {
            if (available.has(id)) next.add(id);
          });
          return next;
        });
      }

      if (message?.type === 'backups' && message?.action === 'result') {
        const ok = Boolean(message?.data?.ok ?? true);
        const msg = message?.data?.message || t(language, ok ? 'backups.notifyOpCompleted' : 'backups.notifyOpFailed');
        notify({
          title: t(language, ok ? 'backups.notifyUpdated' : 'backups.notifyError'),
          message: msg,
          kind: ok ? 'success' : 'error',
          duration: ok ? 3800 : 5600,
        });
        setBusyId(null);
        setCreating(false);
        if (ok) window.chrome?.webview?.postMessage('backups-list');
      }
    };

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
      window.chrome.webview.postMessage('backups-list');
    }

    return () => {
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handleMessage);
      }
    };
  }, []);
  useEffect(() => onLanguageChange(setLanguage), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return backups;
    return backups.filter((b) => b.name.toLowerCase().includes(q));
  }, [backups, query]);

  const send = (message: string) => {
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(message);
    }
  };

  const refresh = () => {
    notify({ title: t(language, 'backups.notifyRefreshing'), message: t(language, 'backups.notifyRefreshingDesc'), kind: 'info', duration: 2200 });
    send('backups-list');
  };

  const openCreate = () => {
    setBackupName(`${t(language, 'backups.defaultNamePrefix')} ${new Date().toLocaleDateString()}`);
    setCreateOpen(true);
  };

  const createBackup = () => {
    const name = backupName.trim();
    if (!name) {
      notify({ title: t(language, 'backups.notifyNameRequired'), message: t(language, 'backups.notifyNameRequiredDesc'), kind: 'warning', duration: 3600 });
      return;
    }

    setCreating(true);
    notify({ title: t(language, 'backups.notifyCreating'), message: t(language, 'backups.notifyCreatingDesc'), kind: 'info', duration: 2600 });
    setCreateOpen(false);
    send(`backups-create|${name}`);
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => send(`backups-delete|${id}`));
    notify({
      title: t(language, 'backups.notifyBulkDelete'),
      message: t(language, 'backups.notifyBulkDeleteDesc').replace('{count}', String(ids.length)),
      kind: 'warning',
      duration: 3200,
    });
    setSelectedIds(new Set());
  };

  const restoreBackup = (item: BackupPoint) => {
    setRestoreOpen(item);
  };

  const confirmRestore = () => {
    if (!restoreOpen) return;
    setBusyId(restoreOpen.id);
    notify({ title: t(language, 'backups.restoreStarted'), message: t(language, 'backups.restoreStartedDesc'), kind: 'info', duration: 3200 });
    send(`backups-restore|${restoreOpen.id}`);
    setRestoreOpen(null);
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.length === 0) return;
    setSelectedIds((prev) => {
      const allVisibleSelected = filtered.every((item) => prev.has(item.id));
      if (allVisibleSelected) {
        const next = new Set(prev);
        filtered.forEach((item) => next.delete(item.id));
        return next;
      }

      const next = new Set(prev);
      filtered.forEach((item) => next.add(item.id));
      return next;
    });
  };

  return (
    <div className="tfy-themed-page tfy-page-backups h-full overflow-hidden flex flex-col gap-5">
      <div className="shrink-0">
        <div>
          <p className="section-title">{t(language, 'backups.kicker')}</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-white mt-3">{t(language, 'nav.backups')}</h1>
          <p className="text-gray-400 mt-3">{t(language, 'backups.subtitle')}</p>
        </div>
      </div>

      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="backup-search w-[360px] max-w-full">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(language, 'backups.search')}
            className="bg-transparent text-sm text-white outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-ghost text-xs inline-flex items-center gap-2" onClick={refresh}><RefreshCcw size={14} />{t(language, 'backups.refresh')}</button>
          <button className="btn-ghost text-xs inline-flex items-center gap-2" disabled={selectedIds.size === 0} onClick={deleteSelected}><Trash2 size={14} />{t(language, 'backups.delete')}</button>
          <button className="btn-primary text-xs inline-flex items-center gap-2 no-glow text-black" onClick={openCreate}><Plus size={14} />{t(language, 'backups.createNew')}</button>
        </div>
      </div>

      <div className="liquid-card rounded-2xl p-4 flex-1 overflow-hidden min-h-0 tfy-diagonal-glow">
        <div className="grid grid-cols-[32px_1.6fr_1fr_120px_80px] gap-4 text-xs uppercase tracking-[0.2em] text-gray-500 px-2 mb-3">
          <button
            className={`backup-checkbox ${filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id)) ? 'selected' : ''}`}
            onClick={toggleAll}
            aria-label="Select all"
          />
          <span>{t(language, 'backups.name')}</span>
          <span>{t(language, 'backups.date')}</span>
          <span>{t(language, 'backups.type')}</span>
          <span>{t(language, 'backups.use')}</span>
        </div>
        <div className="space-y-2 overflow-y-auto no-scrollbar h-[calc(100%-2.5rem)] pr-1">
          {filtered.map((item) => (
            <div key={item.id} className="backup-row">
              <button
                className={`backup-checkbox ${selectedIds.has(item.id) ? 'selected' : ''}`}
                onClick={() => toggleRow(item.id)}
                aria-label="Select restore point"
              />
              <div className="text-white font-medium truncate">{item.name}</div>
              <div className="text-gray-400 text-sm">{item.createdAt || t(language, 'common.unknown')}</div>
              <span className={`backup-tag ${item.type === 'automatic' ? 'auto' : 'windows'}`}>
                {item.type === 'automatic' ? t(language, 'backups.typeAutomatic') : t(language, 'backups.typeWindows')}
              </span>
              <div className="flex items-center gap-2">
                <button className="backup-action" onClick={() => restoreBackup(item)} disabled={busyId === item.id} title="Restore">
                  <Play size={14} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-gray-500 py-6 text-center">{t(language, 'backups.none')}</div>
          )}
        </div>
      </div>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t(language, 'backups.createTitle')}
        className="tfy-modal-deep"
      >
        <div className="space-y-4 details-main-card rounded-2xl p-4 md:p-5">
          <p className="text-gray-300 leading-relaxed">{t(language, 'backups.createDesc')}</p>
          <div className="rounded-xl px-4 py-3 text-sm backup-note-theme">{t(language, 'backups.createNote')}</div>
          <div>
            <label className="text-sm text-gray-300">{t(language, 'backups.name')}</label>
            <input
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none backup-name-input"
              placeholder={t(language, 'backups.enterName')}
            />
          </div>
          <button className="btn-primary w-full text-black action-anim-btn" disabled={creating} onClick={createBackup}>
            {creating ? t(language, 'backups.creating') : t(language, 'backups.createPoint')}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(restoreOpen)}
        onClose={() => setRestoreOpen(null)}
        title={t(language, 'backups.restoreTitle')}
        className="tfy-modal-deep"
      >
        <div className="space-y-4 details-main-card rounded-2xl p-4 md:p-5">
          <p className="text-gray-300 leading-relaxed">{t(language, 'backups.restoreDesc')}</p>
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{t(language, 'backups.restoreNote')}</span>
          </div>
          <div className="text-sm text-gray-400">
            {t(language, 'backups.name')}: <span className="text-white">{restoreOpen?.name ?? '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost w-full action-anim-btn" onClick={() => setRestoreOpen(null)}>{t(language, 'debloat.cancel')}</button>
            <button className="btn-primary theme-primary-btn w-full text-black action-anim-btn" onClick={confirmRestore}>{t(language, 'backups.restoreAction')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
