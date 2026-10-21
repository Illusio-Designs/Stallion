import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { RupeeIcon as RupeeGlyph } from '@hugeicons/core-free-icons';

// Indian rupee sign from Hugeicons, same size and stroke as the other icons.
const RupeeIcon = ({ size = 24, strokeWidth = 1.8, ...rest }) => (
  <HugeiconsIcon icon={RupeeGlyph} size={size} strokeWidth={strokeWidth} {...rest} />
);

export default RupeeIcon;
