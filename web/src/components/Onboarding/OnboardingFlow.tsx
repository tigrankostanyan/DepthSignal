'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, ChevronLeft, X, Sparkles, Shield, Bell, List } from 'lucide-react';

const ONBOARDING_KEY = 'qs_onboarding_completed';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content?: React.ReactNode;
}

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if onboarding has already been completed
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setIsVisible(true);
    } else if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to MyScreener',
      description: 'Precision is the visual language. Intelligence, made visible.',
      icon: <Sparkles className="w-8 h-8 text-[#24C4E8]" />,
      content: (
        <div className="text-center">
          <p className="text-main text-sm leading-relaxed">
            MyScreener helps you detect large liquidity walls across 8+ exchanges in real-time with enterprise depth analytics.
            <br /><br />
            <span className="text-[#24C4E8] font-semibold">Let's get you started in 3 quick steps.</span>
          </p>
        </div>
      ),
    },
    {
      id: 'walls',
      title: 'Understanding Walls',
      description: 'Walls are large orders that can indicate support/resistance levels.',
      icon: <Shield className="w-8 h-8 text-[#24C4E8]" />,
      content: (
        <div className="space-y-3 text-sm text-main">
          <div className="bg-primary rounded-lg p-3 border border-divider">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-accent/20 text-accent rounded text-xs font-bold">FORMING</span>
              <span className="text-muted">→</span>
              <span className="text-muted">Wall just appeared (waiting to confirm)</span>
            </div>
          </div>
          <div className="bg-surface rounded-lg p-3 border border-divider">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-bid/20 text-bid rounded text-xs font-bold">CONFIRMED</span>
              <span className="text-muted">→</span>
              <span className="text-muted">Wall persisted for minimum duration</span>
            </div>
          </div>
          <div className="bg-surface rounded-lg p-3 border border-divider">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-ask/20 text-ask rounded text-xs font-bold">REMOVED</span>
              <span className="text-muted">→</span>
              <span className="text-muted">Wall disappeared (cancelled or expired)</span>
            </div>
          </div>
          <p className="text-muted text-xs mt-2">
            🎯 <strong>Support Wall</strong> = large bid order below price<br />
            🎯 <strong>Resistance Wall</strong> = large ask order above price
          </p>
        </div>
      ),
    },
    {
      id: 'alerts',
      title: 'Setting Up Alerts',
      description: 'Get notified when walls form or when price breaks through key levels.',
      icon: <Bell className="w-8 h-8 text-accent" />,
      content: (
        <div className="space-y-3 text-sm text-main">
          <div className="bg-surface rounded-lg p-3 border border-divider">
            <p className="font-medium text-white">Create your first alert:</p>
            <ol className="list-decimal list-inside text-muted mt-2 space-y-1">
              <li>Go to the <span className="text-accent">Alerts</span> tab</li>
              <li>Click <span className="text-accent">+ Create Alert</span></li>
              <li>Pick a symbol (e.g., BTCUSDT)</li>
              <li>Choose a condition: <span className="text-bid">PRICE_ABOVE</span> or <span className="text-ask">WALL_FORMED</span></li>
              <li>Set your threshold and save!</li>
            </ol>
          </div>
          <p className="text-muted text-xs">
            💡 You'll get instant notifications in-app, and optionally via Telegram or email.
          </p>
        </div>
      ),
    },
    {
      id: 'watchlists',
      title: 'Watchlists & Focus',
      description: 'Track your favorite symbols and dive deep into market data.',
      icon: <List className="w-8 h-8 text-[#24C4E8]" />,
      content: (
        <div className="space-y-3 text-sm text-main">
          <div className="bg-primary rounded-lg p-3 border border-divider">
            <p className="font-medium text-white">Watchlists:</p>
            <p className="text-muted mt-1">Add any symbol to your watchlist for quick access. Filter by exchange or market type.</p>
          </div>
          <div className="bg-primary rounded-lg p-3 border border-divider">
            <p className="font-medium text-white">Focus View:</p>
            <p className="text-muted mt-1">Click any symbol in the screener table to open the Focus view — see order book depth, chart, and real-time walls.</p>
          </div>
          <p className="text-muted text-xs">
            🚀 You're ready to start trading smarter with MyScreener!
          </p>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsVisible(false);
    if (onComplete) onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-[#0B1E33] border border-divider rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-brand-gradient" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand/15 border border-[#24C4E8]/30 rounded-lg flex items-center justify-center">
              {step.icon}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Step {currentStep + 1} of {steps.length}
              </h2>
              <p className="text-[10px] text-muted">{step.title}</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-muted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 min-h-[220px]">
          <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
          <p className="text-xs text-muted mb-4">{step.description}</p>
          {step.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-divider bg-primary">
          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === currentStep ? 'bg-[#24C4E8] w-6' : 'bg-[#1A3654]'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 rounded-lg border border-divider text-muted hover:text-white hover:border-[#168FD6] transition-colors text-xs font-medium"
              >
                <ChevronLeft size={14} className="inline" /> Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-lg bg-brand-gradient hover:opacity-90 text-white font-bold transition-all text-xs flex items-center gap-1 shadow-md cursor-pointer"
            >
              {isLastStep ? (
                <>Get Started <Check size={14} /></>
              ) : (
                <>Next <ChevronRight size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}