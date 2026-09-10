'use client';

import React from 'react';
import Image from 'next/image';

export type BrandLockup = 'horizontal' | 'stacked' | 'symbol' | 'wordmark';
export type BrandTheme = 'dark' | 'light' | 'white' | 'blue' | 'black';

interface BrandLogoProps {
  lockup?: BrandLockup;
  theme?: BrandTheme;
  size?: number;
  responsive?: boolean;
  className?: string;
  alt?: string;
  priority?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  lockup = 'horizontal',
  theme = 'dark',
  size,
  responsive,
  className = '',
  alt = 'MyScreener',
  priority = false,
}) => {
  let src = '';
  let defaultWidth = 140;
  let defaultHeight = 40;

  if (lockup === 'horizontal') {
    defaultHeight = size || 36;
    defaultWidth = Math.round(defaultHeight * (840 / 240)); // 3.5 aspect ratio
    switch (theme) {
      case 'light':
        src = '/brand/myscreener-horizontal-on-light.svg';
        break;
      case 'white':
        src = '/brand/myscreener-horizontal-white.svg';
        break;
      case 'blue':
        src = '/brand/myscreener-horizontal-blue.svg';
        break;
      case 'black':
        src = '/brand/myscreener-horizontal-black.svg';
        break;
      case 'dark':
      default:
        src = '/brand/myscreener-horizontal-on-dark.svg';
        break;
    }
  } else if (lockup === 'stacked') {
    defaultHeight = size || 80;
    defaultWidth = Math.round(defaultHeight * (512 / 420));
    switch (theme) {
      case 'light':
        src = '/brand/myscreener-stacked-on-light.svg';
        break;
      case 'dark':
      default:
        src = '/brand/myscreener-stacked-on-dark.svg';
        break;
    }
  } else if (lockup === 'symbol') {
    const dim = size || 36;
    defaultWidth = dim;
    defaultHeight = dim;
    const isSmall = responsive ?? dim < 48;

    if (theme === 'white') {
      src = '/brand/myscreener-symbol-white.svg';
    } else if (theme === 'blue') {
      src = '/brand/myscreener-symbol-blue.svg';
    } else if (theme === 'black') {
      src = '/brand/myscreener-symbol-black.svg';
    } else {
      src = isSmall
        ? '/brand/myscreener-symbol-gradient-responsive.svg'
        : '/brand/myscreener-symbol-gradient-depth.svg';
    }
  } else if (lockup === 'wordmark') {
    defaultHeight = size || 24;
    defaultWidth = Math.round(defaultHeight * 5.2);
    switch (theme) {
      case 'light':
        src = '/brand/myscreener-wordmark-ink.svg';
        break;
      case 'blue':
        src = '/brand/myscreener-wordmark-blue.svg';
        break;
      case 'black':
        src = '/brand/myscreener-wordmark-black.svg';
        break;
      case 'white':
      case 'dark':
      default:
        src = '/brand/myscreener-wordmark-white.svg';
        break;
    }
  }

  return (
    <div
      className={`inline-flex items-center justify-center select-none flex-shrink-0 ${className}`}
      style={{ width: defaultWidth, height: defaultHeight }}
    >
      <Image
        src={src}
        alt={alt}
        width={defaultWidth}
        height={defaultHeight}
        priority={priority}
        className="w-full h-full object-contain pointer-events-none"
        unoptimized
      />
    </div>
  );
};
