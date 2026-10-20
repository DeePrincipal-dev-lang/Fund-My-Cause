import { renderHook, act, waitFor } from '@testing-library/react';
import { useWallet } from './useWallet';

jest.mock('../lib/soroban/wallet', () => ({
  connectWallet: jest.fn(),
  disconnectWallet: jest.fn(),
  signTransaction: jest.fn(),
  submitTransaction: jest.fn(),
  getConnectedPublicKey: jest.fn(),
}));

import {
  connectWallet,
  disconnectWallet,
  signTransaction,
  submitTransaction,
  getConnectedPublicKey,
} from '../lib/soroban/wallet';

const mockedConnect = connectWallet as jest.MockedFunction<typeof connectWallet>;
const mockedDisconnect = disconnectWallet as jest.MockedFunction<typeof disconnectWallet>;
const mockedSign = signTransaction as jest.MockedFunction<typeof signTransaction>;
const mockedSubmit = submitTransaction as jest.MockedFunction<typeof submitTransaction>;
const mockedGetKey = getConnectedPublicKey as jest.MockedFunction<typeof getConnectedPublicKey>;

describe('useWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetKey.mockResolvedValue(null);
  });

  it('starts disconnected when no public key is present', async () => {
    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.publicKey).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('restores an existing connection on mount', async () => {
    mockedGetKey.mockResolvedValue('GABC123');

    const { result } = renderHook(() => useWallet());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.publicKey).toBe('GABC123');
    expect(result.current.isConnected).toBe(true);
  });

  it('connects the wallet and stores the public key', async () => {
    mockedConnect.mockResolvedValue('GPUBKEY');

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.connect();
    });

    expect(mockedConnect).toHaveBeenCalledTimes(1);
    expect(result.current.publicKey).toBe('GPUBKEY');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('captures connection errors', async () => {
    mockedConnect.mockRejectedValue(new Error('user rejected'));

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toBe('user rejected');
    expect(result.current.isConnected).toBe(false);
  });

  it('disconnects the wallet and clears state', async () => {
    mockedGetKey.mockResolvedValue('GPUBKEY');
    mockedDisconnect.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockedDisconnect).toHaveBeenCalledTimes(1);
    expect(result.current.publicKey).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('signs a transaction through the wallet module', async () => {
    mockedSign.mockResolvedValue('signed-xdr');

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let signed: string | undefined;
    await act(async () => {
      signed = await result.current.sign('unsigned-xdr');
    });

    expect(mockedSign).toHaveBeenCalledWith('unsigned-xdr');
    expect(signed).toBe('signed-xdr');
  });

  it('submits a transaction through the wallet module', async () => {
    mockedSubmit.mockResolvedValue({ hash: 'abc' });

    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let response: unknown;
    await act(async () => {
      response = await result.current.submit('signed-xdr');
    });

    expect(mockedSubmit).toHaveBeenCalledWith('signed-xdr');
    expect(response).toEqual({ hash: 'abc' });
  });
});
