'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Key } from 'lucide-react';

export function AssignAssetButton({ assetId, assigneeDid }: { assetId: string, assigneeDid: string }) {
  const [txState, setTxState] = useState<'IDLE' | 'CONFIRMING' | 'CONFIRMED'>('IDLE');

  const handleAssign = async () => {
    setTxState('CONFIRMING');
    try {
      const res = await fetch('/api/assets/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          assetId,
          targetUserId: assigneeDid,
          canRead: true,
          canDecrypt: true,
        }),
      });
      if (res.ok) {
        setTxState('CONFIRMED');
      } else {
        setTxState('IDLE');
      }
    } catch {
      setTxState('IDLE');
    }
  };

  const getButtonText = () => {
    if (txState === 'CONFIRMING') return 'Simulating Tx...';
    if (txState === 'CONFIRMED') return 'Asset Allocated!';
    return 'Allocate (Gas Sponsored)';
  };

  return (
    <div className="flex flex-col gap-2">
      <Button 
        onClick={handleAssign} 
        disabled={txState !== 'IDLE'}
        size="sm" 
        className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50"
      >
        <Key className="w-4 h-4 mr-2" /> 
        {getButtonText()}
      </Button>
      {txState === 'CONFIRMED' && (
        <span className="text-[10px] text-emerald-400 font-mono truncate max-w-[200px]">
          Tx Sponsored by Backend
        </span>
      )}
    </div>
  );
}
