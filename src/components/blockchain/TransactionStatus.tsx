'use client';

import * as React from 'react';
import { TxState } from '@/hooks/useBlockchainTransaction';
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface TransactionStatusProps {
  state: TxState;
  hash?: string;
  errorMessage?: string | null;
  chainId?: number;
}

export function TransactionStatus({ state, hash, errorMessage, chainId = 11155111 }: TransactionStatusProps) {
  if (state === 'IDLE') return null;

  const getExplorerLink = (hash: string) => {
    if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${hash}`;
    return `#`;
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Transaction Status</span>
        <Badge variant="outline" className={
          state === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
          state === 'FAILED' || state === 'REJECTED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
          'bg-primary/10 text-primary border-primary/20'
        }>
          {state.replace(/_/g, ' ')}
        </Badge>
      </div>

      {['PREPARING', 'WALLET_CONFIRMATION_REQUIRED', 'SUBMITTED', 'CONFIRMING'].includes(state) && (
        <Alert className="bg-primary/5 border-primary/20">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <AlertTitle className="text-primary">Processing</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            {state === 'WALLET_CONFIRMATION_REQUIRED' && 'Please check your wallet to confirm the transaction.'}
            {state === 'CONFIRMING' && 'Transaction submitted to network. Waiting for block confirmations...'}
          </AlertDescription>
        </Alert>
      )}

      {state === 'CONFIRMED' && (
        <Alert className="bg-emerald-500/5 border-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="text-emerald-500">Confirmed</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            The transaction was successfully mined.
          </AlertDescription>
        </Alert>
      )}

      {(state === 'FAILED' || state === 'REJECTED') && (
        <Alert variant="destructive" className="bg-destructive/5">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Transaction Failed</AlertTitle>
          <AlertDescription className="text-xs">
            {errorMessage || 'The transaction could not be completed.'}
          </AlertDescription>
        </Alert>
      )}

      {hash && (state === 'SUBMITTED' || state === 'CONFIRMING' || state === 'CONFIRMED') && (
        <div className="text-xs flex items-center gap-2 p-2 rounded-md bg-accent/30 border border-border/50">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Tx Hash:</span>
          <a 
            href={getExplorerLink(hash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-mono text-primary hover:underline truncate max-w-[200px]"
          >
            {hash}
          </a>
        </div>
      )}
    </div>
  );
}
