import { PinataSDK } from 'pinata';

export async function pinJSON(data: unknown, name: string): Promise<string> {
  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: 'gateway.pinata.cloud',
  });

  const upload = await pinata.upload.json(data).addMetadata({ name });
  return upload.IpfsHash;
}
