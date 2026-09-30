import React from 'react';

export type BentoCardVariant = 'dark' | 'lime' | 'white' | 'subtle';

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BentoCardVariant;
  colSpan?: 1 | 2;
  radius?: number | string;
  padding?: number | string;
  children?: React.ReactNode;
}

const variantStyles: Record<
  BentoCardVariant,
  { background: string; color: string; borderRadius: string }
> = {
  dark: {
    background: 'var(--color-dark, #23372A)',
    color: '#F1F4EA',
    borderRadius: '28px',
  },
  lime: {
    background: 'var(--color-lime, #D4F27A)',
    color: 'var(--text-primary, #1E2A20)',
    borderRadius: '24px',
  },
  white: {
    background: 'var(--color-white, #FFFFFF)',
    color: 'var(--text-primary, #1E2A20)',
    borderRadius: '24px',
  },
  subtle: {
    background: 'var(--color-neutral-bg, #F4F5EF)',
    color: 'var(--text-primary, #1E2A20)',
    borderRadius: '24px',
  },
};

export const BentoCard: React.FC<BentoCardProps> = ({
  variant = 'white',
  colSpan = 1,
  radius,
  padding = '16px',
  className = '',
  style,
  onClick,
  children,
  ...rest
}) => {
  const baseVariant = variantStyles[variant] || variantStyles.white;

  const cardStyle: React.CSSProperties = {
    background: baseVariant.background,
    color: baseVariant.color,
    borderRadius: radius !== undefined ? radius : baseVariant.borderRadius,
    padding: padding,
    gridColumn: colSpan === 2 ? 'span 2' : undefined,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxSizing: 'border-box',
    cursor: onClick ? 'pointer' : undefined,
    ...style,
  };

  const combinedClassName = [
    'bento-card',
    `bento-card--${variant}`,
    onClick ? 'bento-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e as any);
              }
            }
          : undefined
      }
      className={combinedClassName}
      style={cardStyle}
      data-testid="bento-card"
      data-variant={variant}
      {...rest}
    >
      {children}
    </div>
  );
};

export default BentoCard;
