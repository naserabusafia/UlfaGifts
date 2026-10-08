import React from 'react';
import { itemGiftNames } from '../services/merchantOrderService';

interface GiftPiecesProps {
  item: { productName: string; giftCount?: number };
  className?: string;
}

/** A link's product name, or a numbered list of every gift when one link is shared by several. */
export const GiftPieces: React.FC<GiftPiecesProps> = ({ item, className = 'font-extrabold text-foreground' }) => {
  const names = itemGiftNames(item);
  if (names.length <= 1) return <p className={className}>{item.productName}</p>;
  return (
    <ol className="space-y-1.5">
      {names.map((name, index) => (
        <li key={index} className={`flex items-center gap-2 ${className}`}>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-black text-primary">{index + 1}</span>
          <span className="min-w-0 break-words">{name}</span>
        </li>
      ))}
    </ol>
  );
};
