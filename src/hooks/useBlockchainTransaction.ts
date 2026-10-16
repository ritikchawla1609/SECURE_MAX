import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';

export type TxState = 
  | 'IDLE' 
  | 'PREPARING' 
  | 'WALLET_CONFIRMATION_REQUIRED' 
  | 'SUBMITTED' 
  | 'CONFIRMING' 
  | 'CONFIRMED' 
  | 'REJECTED' 
  | 'FAILED'
  | 'WRONG_NETWORK'
  | 'WALLET_DISCONNECTED';

export function useBlockchainTransaction() {
  const [txState, setTxState] = useState<TxState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { isConnected, chain } = useAccount();
  const { writeContract, data: hash, isPending: isWritePending, isError: isWriteError, error: writeError } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isReceiptError, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  // Track wallet interaction state
  useEffect(() => {
    if (!isConnected) {
      setTxState('WALLET_DISCONNECTED');
      return;
    }
    
    // In a real app we'd verify the specific chain ID needed
    if (chain?.id !== 11155111 && chain?.id !== 31337) { // Sepolia or Hardhat
      // setTxState('WRONG_NETWORK');
    }

    if (isWritePending) {
      setTxState('WALLET_CONFIRMATION_REQUIRED');
    } else if (isWriteError) {
      if (writeError?.message?.includes('User rejected')) {
        setTxState('REJECTED');
        setErrorMessage('User rejected the transaction in the wallet.');
      } else {
        setTxState('FAILED');
        setErrorMessage(writeError?.message || 'Transaction preparation failed');
      }
    } else if (hash && !isConfirming && !isConfirmed && txState === 'WALLET_CONFIRMATION_REQUIRED') {
      setTxState('SUBMITTED');
    }
  }, [isWritePending, isWriteError, writeError, hash, isConnected, chain, txState, isConfirming, isConfirmed]);

  // Track confirmation state
  useEffect(() => {
    if (isConfirming) {
      setTxState('CONFIRMING');
    } else if (isConfirmed) {
      setTxState('CONFIRMED');
    } else if (isReceiptError) {
      setTxState('FAILED');
      setErrorMessage(receiptError?.message || 'Transaction reverted during confirmation');
    }
  }, [isConfirming, isConfirmed, isReceiptError, receiptError]);

  const execute = async (config: any) => {
    try {
      setTxState('PREPARING');
      setErrorMessage(null);
      writeContract(config);
    } catch (e: any) {
      setTxState('FAILED');
      setErrorMessage(e.message);
    }
  };

  return {
    execute,
    txState,
    hash,
    errorMessage,
    reset: () => {
      setTxState('IDLE');
      setErrorMessage(null);
    }
  };
}
