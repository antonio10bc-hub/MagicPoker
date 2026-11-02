import { CSSProperties, useState } from 'react';
import { useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { applyBackup, Backup, exportBackup, readBackup } from '@/lib/backup';
import { PxButton } from '@/components/pixel/ui';
import { Dialog, DialogBody, Section } from './Dialog';

// --- COPIA DE SEGURIDAD (desde Ajustes) ---
// Guardar: el código de todo el juego al portapapeles (si el navegador no deja, se
// enseña para copiarlo a mano). Cargar: se pega un código, se confirma y este
// dispositivo queda exactamente como la copia (se recarga la página).

/** Cuadro de texto dentro del escenario: se puede seleccionar y escribir */
const FIELD: CSSProperties = {
  width: '100%', height: 34, resize: 'none', outline: 'none', padding: 3, fontSize: 8, lineHeight: '9px',
  color: 'var(--ink-cream)', background: 'rgba(11,13,12,0.6)', borderRadius: 2,
  boxShadow: 'inset 0 0 0 1px rgba(185,207,200,0.15)', userSelect: 'text', WebkitUserSelect: 'text', wordBreak: 'break-all',
};

export const BackupModal = () => {
  const t = useTranslations();
  const [copied, setCopied] = useState<'ok' | 'manual' | null>(null);
  const [code, setCode] = useState('');
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);

  const copy = async () => {
    playSound('click');
    const next = await exportBackup();
    setCode(next);
    try {
      await navigator.clipboard.writeText(next);
      setCopied('ok');
      playSfx('sparkle', 0.6);
    } catch {
      setCopied('manual');
    }
  };

  const paste = async () => {
    playSound('click');
    try { setText(await navigator.clipboard.readText()); setInvalid(false); } catch { /* sin permiso: se pega a mano */ }
  };

  const load = async () => {
    const backup = await readBackup(text);
    if (!backup) { playSfx('deselect', 0.7); setInvalid(true); return; }
    playSfx('open', 0.6);
    setPending(backup);
  };

  const confirm = () => {
    if (!pending) return;
    playSound('click');
    applyBackup(pending);
    window.location.reload();
  };

  if (pending) {
    const date = new Date(pending.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    return (
      <Dialog title={t.backup_title} size="sm"
        footer={<span className="flex gap-[4px]">
          <PxButton size="md" className="flex-1" onClick={() => { playSound('click'); setPending(null); }}>{t.cancel}</PxButton>
          <PxButton size="md" className="flex-1 px-btn-danger" onClick={confirm}>{t.backup_confirm_go}</PxButton>
        </span>}>
        <DialogBody scroll={false}>
          <p className="leading-[11px]">{t.backup_confirm.replace('{date}', date)}</p>
        </DialogBody>
      </Dialog>
    );
  }

  return (
    <Dialog title={t.backup_title} size="md">
      <DialogBody className="t-micro gap-[6px]">
        <Section title={t.backup_copy_sec} className="flex flex-col gap-[4px]">
          <p className="t-note">{t.backup_desc}</p>
          <PxButton size="md" tone="green" aria-label="backup copy" onClick={copy}><span className="text-outline">{t.backup_copy}</span></PxButton>
          {copied === 'ok' && <p className="t-note" style={{ color: 'var(--ink-volt)' }}>{t.backup_copied}</p>}
          {copied === 'manual' && (
            <>
              <p className="t-note" style={{ color: 'var(--ink-ember)' }}>{t.backup_copy_fail}</p>
              <textarea readOnly value={code} style={FIELD} onFocus={e => e.currentTarget.select()} />
            </>
          )}
        </Section>
        <Section title={t.backup_paste_sec} className="flex flex-col gap-[4px]">
          <p className="t-note">{t.backup_paste_hint}</p>
          <textarea aria-label="backup code" value={text} placeholder={t.backup_paste_ph} style={FIELD} spellCheck={false}
            onChange={e => { setText(e.target.value); setInvalid(false); }} />
          {invalid && <p className="t-note" style={{ color: 'var(--ink-orange)' }}>{t.backup_invalid}</p>}
          <span className="flex gap-[4px]">
            <PxButton size="md" className="flex-1" onClick={paste}>{t.backup_paste}</PxButton>
            <PxButton size="md" className="flex-1 px-btn-danger" aria-label="backup load" disabled={!text.trim()} onClick={load}>{t.backup_load}</PxButton>
          </span>
        </Section>
      </DialogBody>
    </Dialog>
  );
};
