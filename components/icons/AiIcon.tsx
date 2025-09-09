import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {}

export const AiIcon: React.FC<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 3L9.5 8.5L4 11L9.5 13.5L12 19L14.5 13.5L20 11L14.5 8.5L12 3Z" />
    <path d="M5 3L6.5 6" />
    <path d="M19 3L17.5 6" />
    <path d="M5 21L6.5 18" />
    <path d="M19 21L17.5 18" />
  </svg>
);
