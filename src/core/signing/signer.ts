import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { parseSignature, type Hex } from "viem";

export interface SignatureComponents {
  signer: string;
  r: string;
  s: string;
  v: number;
}

export const createSigner = (privateKey: string): PrivateKeyAccount => {
  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  return privateKeyToAccount(key as Hex);
};

export const signTypedData = async (
  privateKey: string,
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  },
): Promise<SignatureComponents> => {
  const account = createSigner(privateKey);
  const sig = await account.signTypedData(typedData as Parameters<typeof account.signTypedData>[0]);
  const parsed = parseSignature(sig);

  return {
    signer: account.address,
    r: parsed.r,
    s: parsed.s,
    v: Number(parsed.v),
  };
};
