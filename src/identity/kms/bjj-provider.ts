import { IKeyProvider, KeyID, KEYType } from './index';
import * as providerHelpers from './provider-helpers';
import * as babyjub from '../bjj/eddsa-babyjub';

export class BjjProvider implements IKeyProvider {
  keyType: KEYType;
  private privateKey: babyjub.PrivateKey;
  constructor(keyType: KEYType) {
    this.keyType = keyType;
  }
  async newPrivateKeyFromSeed(key: Uint8Array): Promise<KeyID> {
    // bjj private key from seed buffer
    console.log(key);
    console.log(key.length);
    const newKey: Uint8Array = new Uint8Array(32);
    newKey.set(Uint8Array.from(key), 0);
    newKey.fill(key.length, 32, 0);
    console.log(newKey);
    debugger;
    const privateKey: babyjub.PrivateKey = babyjub.createNewPrivateKeySeed(key);
    this.privateKey = privateKey;
    const publicKey = await privateKey.public();
    return <KeyID>{
      Type: this.keyType,
      ID: providerHelpers.keyPath(this.keyType, await publicKey.toString())
    };
  }

  async publicKey(keyID: KeyID): Promise<babyjub.PublicKey> {
    return await this.privateKey.public();
  }

  static decodeBJJPubKey() {}
}
