import BracketPoolABI from './abis/BracketPool.json';
import BracketPoolFactoryABI from './abis/BracketPoolFactory.json';

export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`;

export const USDC_ADDRESSES = {
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const,
  mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
};

export const contracts = {
  factory: { address: FACTORY_ADDRESS, abi: BracketPoolFactoryABI },
  pool: { abi: BracketPoolABI },
} as const;

export { BracketPoolABI, BracketPoolFactoryABI };
