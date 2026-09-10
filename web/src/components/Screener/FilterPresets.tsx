'use client';

import React, { useState } from 'react';
import { Bookmark, Loader2 } from 'lucide-react';
import type { SavedFilterPreset } from '@/types/index';
import { Modal } from '@/components/ui/Modal';

interface FilterPresetsProps {
  presets: SavedFilterPreset[];
  onApplyPreset: (preset: SavedFilterPreset) => void;
  onSaveCurrentPreset: (name: string) => void | Promise<void>;
}

const inputCls =
  'w-full bg-primary border border-divider rounded px-3 py-2 text-white text-sm focus:border-[#168FD6] focus:outline-none';

export const FilterPresets: React.FC<FilterPresetsProps> = ({
  presets,
  onApplyPreset,
  onSaveCurrentPreset,
}) => {
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('My Custom Preset');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const openSave = () => {
    setPresetName('My Custom Preset');
    setSaveError(null);
    setIsSaveOpen(true);
  };

  const confirmSave = async () => {
    const name = presetName.trim();
    if (!name) {
      setSaveError('Please enter a preset name.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSaveCurrentPreset(name);
      setIsSaveOpen(false);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save preset.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border-b border-divider bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
          Saved Filter Presets
        </span>
        <button
          onClick={openSave}
          className="flex items-center space-x-1 text-accent hover:text-[#24C4E8] font-semibold text-[11px] transition cursor-pointer"
        >
          <Bookmark size={12} />
          <span>Save Current</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => onApplyPreset(p)}
            className="px-2.5 py-1 rounded bg-surface hover:bg-panel text-muted hover:text-white border border-divider text-xs font-medium transition cursor-pointer"
          >
            {p.name}
          </button>
        ))}
      </div>

      <Modal
        open={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        title="Save Filter Preset"
        description="Give this screener configuration a name so you can re-apply it later."
        footer={
          <>
            <button
              onClick={() => setIsSaveOpen(false)}
              className="px-3 py-1.5 rounded bg-panel hover:bg-panel text-white text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-60 cursor-pointer"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              <span>Save</span>
            </button>
          </>
        }
      >
        <input
          autoFocus
          type="text"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmSave();
          }}
          placeholder="My Custom Preset"
          className={inputCls}
        />
        {saveError && <p className="mt-2 text-xs text-ask">{saveError}</p>}
      </Modal>
    </div>
  );
};
