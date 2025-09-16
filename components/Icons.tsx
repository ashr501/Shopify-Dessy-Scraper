
import React from 'react';

interface IconProps {
  className?: string;
}

export const SwatchIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.475 2.118A2.25 2.25 0 0 0 7.5 21H9a2.25 2.25 0 0 0 2.25-2.25M9.53 16.122a3 3 0 0 0 5.78 1.128 2.25 2.25 0 0 1 2.475 2.118A2.25 2.25 0 0 0 16.5 21H15a2.25 2.25 0 