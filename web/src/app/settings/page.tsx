import React, { useState, useEffect } from 'react';
import { getUserSettings, updateUserSettings } from '../../lib/api/settings.js';
import { UserSettingsDTO } from '../../types/user.js';
import { Settings, Save, CheckCircle2, Shield, Send } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettingsDTO>({
    theme: 'dark',
    soundEnabled: true,
    minWallUsd: 50000,
    telegramChatId: '',
    emailRecipient: '',
    webhookUrl: ''
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getUserSettings().then((res) => {
      if (res) setSettings((prev) => ({ ...prev, ...res }));
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between bg-[#181A20] p-4 rounded-xl border border-[#2B2F36]">
        <div className="flex items-center space-x-2">
          <Settings className="text-[#F0B90B]" size={18} />
          <h2 className="font-bold text-white text-sm uppercase tracking-wide">Platform Settings & Notifications</h2>
        </div>
        {saved && (
          <span className="text-xs text-[#0ECB81] font-bold flex items-center space-x-1">
            <CheckCircle2 size={14} />
            <span>Settings Saved!</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Core preferences */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-4 space-y-4">
          <div className="text-xs font-bold text-white uppercase tracking-wider">Trading Screener Engine</div>
          <div>
            <label className="block text-[11px] font-bold text-[#848E9C] uppercase mb-1">
              Minimum Liquidity Wall Threshold ($ USD)
            </label>
            <input
              type="number"
              value={settings.minWallUsd}
              onChange={(e) => setSettings({ ...settings, minWallUsd: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono text-xs"
            />
          </div>
        </div>

        {/* External Notifications */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-4 space-y-4">
          <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
            <Send size={14} className="text-[#F0B90B]" />
            <span>External Alert Channels</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#848E9C] uppercase mb-1">
                Telegram Chat / Group ID
              </label>
              <input
                type="text"
                placeholder="-100123456789"
                value={settings.telegramChatId || ''}
                onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#848E9C] uppercase mb-1">
                Email Recipient
              </label>
              <input
                type="email"
                placeholder="alerts@trader.com"
                value={settings.emailRecipient || ''}
                onChange={(e) => setSettings({ ...settings, emailRecipient: e.target.value })}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-[#848E9C] uppercase mb-1">
                Webhook URL (POST JSON)
              </label>
              <input
                type="url"
                placeholder="https://api.yourdomain.com/webhook/alerts"
                value={settings.webhookUrl || ''}
                onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-bold rounded-lg text-xs flex items-center space-x-2 transition shadow-lg"
        >
          <Save size={14} />
          <span>Save All Settings</span>
        </button>
      </form>
    </div>
  );
}
